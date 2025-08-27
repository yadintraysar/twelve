#!/usr/bin/env node

const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

class QuaternionProcessor {
    constructor() {
        this.smoothingTau = 0.9; // seconds
        this.medianWindow = 5;
        this.deadband = 1.5; // degrees
        
        // State thresholds
        this.tiltThresholds = { tilting: 8, aggressive: 15 };
        this.tiltHysteresis = { tilting: 6, aggressive: 13 };
        this.rateThresholds = { tilting: 12, aggressive: 20 };
        this.rateHysteresis = 4;
        
        // Dwell times (ms)
        this.dwellTimes = {
            tiltingMag: 500,
            aggressiveMag: 300,
            tiltingRate: 400,
            aggressiveRate: 250,
            debounce: 1000
        };
        
        // State tracking
        this.currentState = 'still';
        this.stateStartTime = Date.now();
        this.lastPacketTime = Date.now();
        
        // Smoothing state
        this.smoothedQuat = null;
        this.rollHistory = [];
        this.pitchHistory = [];
        this.gyroHistory = [];
        
        // Calibration
        this.baselineRoll = 0;
        this.baselinePitch = 0;
        this.isCalibrating = false;
        this.calibrationSamples = [];
        
        // Trigger tracking
        this.triggers = {
            tiltMag: { active: false, startTime: 0 },
            aggressiveMag: { active: false, startTime: 0 },
            tiltRate: { active: false, startTime: 0 },
            aggressiveRate: { active: false, startTime: 0 }
        };
    }
    
    // Quaternion math utilities
    normalize(q) {
        const mag = Math.sqrt(q.x*q.x + q.y*q.y + q.z*q.z + q.w*q.w);
        if (mag === 0) return { x: 0, y: 0, z: 0, w: 1 };
        return { x: q.x/mag, y: q.y/mag, z: q.z/mag, w: q.w/mag };
    }
    
    slerp(q1, q2, t) {
        let dot = q1.x*q2.x + q1.y*q2.y + q1.z*q2.z + q1.w*q2.w;
        
        // If dot is negative, slerp won't take the shorter path
        if (dot < 0.0) {
            q2 = { x: -q2.x, y: -q2.y, z: -q2.z, w: -q2.w };
            dot = -dot;
        }
        
        // If quaternions are very similar, use linear interpolation
        if (dot > 0.9995) {
            const result = {
                x: q1.x + t * (q2.x - q1.x),
                y: q1.y + t * (q2.y - q1.y),
                z: q1.z + t * (q2.z - q1.z),
                w: q1.w + t * (q2.w - q1.w)
            };
            return this.normalize(result);
        }
        
        const theta = Math.acos(Math.abs(dot));
        const sinTheta = Math.sin(theta);
        const a = Math.sin((1.0 - t) * theta) / sinTheta;
        const b = Math.sin(t * theta) / sinTheta;
        
        return {
            x: a * q1.x + b * q2.x,
            y: a * q1.y + b * q2.y,
            z: a * q1.z + b * q2.z,
            w: a * q1.w + b * q2.w
        };
    }
    
    quatToEuler(q) {
        // Roll (x-axis rotation)
        const sinr_cosp = 2 * (q.w * q.x + q.y * q.z);
        const cosr_cosp = 1 - 2 * (q.x * q.x + q.y * q.y);
        const roll = Math.atan2(sinr_cosp, cosr_cosp);
        
        // Pitch (y-axis rotation)
        const sinp = 2 * (q.w * q.y - q.z * q.x);
        const pitch = Math.abs(sinp) >= 1 ? 
            Math.sign(sinp) * Math.PI / 2 : 
            Math.asin(sinp);
        
        // Yaw (z-axis rotation)
        const siny_cosp = 2 * (q.w * q.z + q.x * q.y);
        const cosy_cosp = 1 - 2 * (q.y * q.y + q.z * q.z);
        const yaw = Math.atan2(siny_cosp, cosy_cosp);
        
        return {
            roll: roll * 180 / Math.PI,
            pitch: pitch * 180 / Math.PI,
            yaw: yaw * 180 / Math.PI
        };
    }
    
    medianFilter(values) {
        if (values.length === 0) return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }
    
    applyDeadband(value) {
        return Math.abs(value) < this.deadband ? 0 : value;
    }
    
    calculateGyroRMS(gyroData) {
        if (gyroData.length === 0) return 0;
        const sumSquares = gyroData.reduce((sum, g) => 
            sum + g.roll*g.roll + g.pitch*g.pitch, 0);
        return Math.sqrt(sumSquares / gyroData.length);
    }
    
    updateTriggers(tiltMag, gyroRMS, now) {
        // Magnitude-based triggers
        const tiltTrigger = tiltMag >= this.tiltThresholds.tilting;
        const aggressiveTrigger = tiltMag >= this.tiltThresholds.aggressive;
        
        // Rate-based triggers
        const rateTiltTrigger = gyroRMS >= this.rateThresholds.tilting;
        const rateAggressiveTrigger = gyroRMS >= this.rateThresholds.aggressive;
        
        // Update magnitude triggers
        this.updateTrigger('tiltMag', tiltTrigger, this.dwellTimes.tiltingMag, now);
        this.updateTrigger('aggressiveMag', aggressiveTrigger, this.dwellTimes.aggressiveMag, now);
        
        // Update rate triggers
        this.updateTrigger('tiltRate', rateTiltTrigger, this.dwellTimes.tiltingRate, now);
        this.updateTrigger('aggressiveRate', rateAggressiveTrigger, this.dwellTimes.aggressiveRate, now);
        
        // Apply hysteresis for clearing
        if (this.triggers.tiltMag.active && tiltMag < this.tiltHysteresis.tilting) {
            this.triggers.tiltMag.active = false;
        }
        if (this.triggers.aggressiveMag.active && tiltMag < this.tiltHysteresis.aggressive) {
            this.triggers.aggressiveMag.active = false;
        }
        if (this.triggers.tiltRate.active && gyroRMS < this.rateHysteresis) {
            this.triggers.tiltRate.active = false;
        }
        if (this.triggers.aggressiveRate.active && gyroRMS < this.rateHysteresis) {
            this.triggers.aggressiveRate.active = false;
        }
    }
    
    updateTrigger(name, condition, dwellTime, now) {
        const trigger = this.triggers[name];
        
        if (condition && !trigger.active) {
            if (trigger.startTime === 0) {
                trigger.startTime = now;
            } else if (now - trigger.startTime >= dwellTime) {
                trigger.active = true;
            }
        } else if (!condition) {
            trigger.startTime = 0;
            // Note: active flag cleared by hysteresis logic
        }
    }
    
    determineState() {
        // Check for aggressive state first (higher priority)
        if (this.triggers.aggressiveMag.active || this.triggers.aggressiveRate.active) {
            return 'aggressive';
        }
        
        // Check for tilting state
        if (this.triggers.tiltMag.active || this.triggers.tiltRate.active) {
            return 'tilting';
        }
        
        return 'still';
    }
    
    processIMU(quat, accel, gyro, timestamp) {
        const now = Date.now();
        this.lastPacketTime = now;
        
        // Normalize quaternion
        const normalizedQuat = this.normalize(quat);
        
        // Apply SLERP smoothing
        if (this.smoothedQuat === null) {
            this.smoothedQuat = normalizedQuat;
        } else {
            const dt = Math.min((timestamp - (this.lastTimestamp || timestamp)) / 1000, 0.1);
            const alpha = 1 - Math.exp(-dt / this.smoothingTau);
            this.smoothedQuat = this.slerp(this.smoothedQuat, normalizedQuat, alpha);
        }
        
        this.lastTimestamp = timestamp;
        
        // Convert to Euler angles
        const euler = this.quatToEuler(this.smoothedQuat);
        
        // Apply calibration offset
        const rawRoll = euler.roll - this.baselineRoll;
        const rawPitch = euler.pitch - this.baselinePitch;
        
        // Update history for median filtering
        this.rollHistory.push(rawRoll);
        this.pitchHistory.push(rawPitch);
        if (this.rollHistory.length > this.medianWindow) {
            this.rollHistory.shift();
            this.pitchHistory.shift();
        }
        
        // Apply median filter and deadband
        const filteredRoll = this.applyDeadband(this.medianFilter(this.rollHistory));
        const filteredPitch = this.applyDeadband(this.medianFilter(this.pitchHistory));
        
        // Update gyro history for RMS calculation
        this.gyroHistory.push({ 
            roll: gyro.x, 
            pitch: gyro.y, 
            timestamp: now 
        });
        
        // Keep only last 300ms of gyro data
        this.gyroHistory = this.gyroHistory.filter(g => now - g.timestamp <= 300);
        
        const gyroRMS = this.calculateGyroRMS(this.gyroHistory);
        const tiltMag = Math.sqrt(filteredRoll*filteredRoll + filteredPitch*filteredPitch);
        
        // Handle calibration
        if (this.isCalibrating) {
            this.calibrationSamples.push({ roll: euler.roll, pitch: euler.pitch });
            if (this.calibrationSamples.length >= 50) { // ~5 seconds at 10Hz
                this.finishCalibration();
            }
        } else if (this.calibrationSamples.length === 0 && tiltMag < 2.0 && gyroRMS < 2.0) {
            // Auto-start calibration if things look stable
            this.startCalibration();
        }
        
        // Update state machine
        this.updateTriggers(tiltMag, gyroRMS, now);
        const newState = this.determineState();
        
        // Apply debounce when returning to still
        if (newState !== this.currentState) {
            if (newState === 'still' && now - this.stateStartTime < this.dwellTimes.debounce) {
                // Don't change to still yet, keep current state
            } else {
                this.currentState = newState;
                this.stateStartTime = now;
            }
        }
        
        return {
            timestamp,
            quaternion: this.smoothedQuat,
            euler: {
                roll: filteredRoll,
                pitch: filteredPitch,
                yaw: euler.yaw
            },
            acceleration: accel,
            gyroRMS,
            tiltMagnitude: tiltMag,
            state: this.currentState,
            isCalibrating: this.isCalibrating
        };
    }
    
    startCalibration() {
        this.isCalibrating = true;
        this.calibrationSamples = [];
        console.log('Starting auto-calibration...');
    }
    
    finishCalibration() {
        if (this.calibrationSamples.length === 0) return;
        
        const avgRoll = this.calibrationSamples.reduce((s, c) => s + c.roll, 0) / this.calibrationSamples.length;
        const avgPitch = this.calibrationSamples.reduce((s, c) => s + c.pitch, 0) / this.calibrationSamples.length;
        
        this.baselineRoll = avgRoll;
        this.baselinePitch = avgPitch;
        this.isCalibrating = false;
        this.calibrationSamples = [];
        
        console.log(`Calibration complete: Roll offset: ${avgRoll.toFixed(2)}°, Pitch offset: ${avgPitch.toFixed(2)}°`);
    }
    
    recalibrate() {
        this.startCalibration();
    }
    
    updateSettings(settings) {
        if (settings.smoothingTau) this.smoothingTau = settings.smoothingTau;
        if (settings.tiltThresholds) Object.assign(this.tiltThresholds, settings.tiltThresholds);
        if (settings.rateThresholds) Object.assign(this.rateThresholds, settings.rateThresholds);
    }
    
    isSignalLost() {
        return Date.now() - this.lastPacketTime > 1000;
    }
}

class IMUServer {
    constructor(port = 8080) {
        this.port = port;
        this.processor = new QuaternionProcessor();
        this.clients = new Set();
        this.lastBroadcast = 0;
        this.broadcastInterval = 50; // 20 Hz max
        
        this.setupServer();
        this.setupWebSocket();
        this.startDataInput();
    }
    
    setupServer() {
        this.server = http.createServer((req, res) => {
            if (req.url === '/') {
                req.url = '/index.html';
            }
            
            if (req.url === '/recalibrate' && req.method === 'POST') {
                this.processor.recalibrate();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
                return;
            }
            
            if (req.url === '/settings' && req.method === 'POST') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', () => {
                    try {
                        const settings = JSON.parse(body);
                        this.processor.updateSettings(settings);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                    } catch (e) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid JSON' }));
                    }
                });
                return;
            }
            
            // Serve static files
            const filePath = path.join(__dirname, 'public', req.url.slice(1));
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(404);
                    res.end('Not Found');
                    return;
                }
                
                const ext = path.extname(filePath);
                const contentType = {
                    '.html': 'text/html',
                    '.js': 'application/javascript',
                    '.css': 'text/css'
                }[ext] || 'text/plain';
                
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(data);
            });
        });
    }
    
    setupWebSocket() {
        this.wss = new WebSocket.Server({ server: this.server });
        
        this.wss.on('connection', (ws) => {
            this.clients.add(ws);
            console.log('Client connected, total clients:', this.clients.size);
            
            ws.on('close', () => {
                this.clients.delete(ws);
                console.log('Client disconnected, total clients:', this.clients.size);
            });
            
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    if (data.type === 'recalibrate') {
                        this.processor.recalibrate();
                    }
                } catch (e) {
                    console.error('Invalid WebSocket message:', e.message);
                }
            });
        });
    }
    
    broadcast(data) {
        const now = Date.now();
        if (now - this.lastBroadcast < this.broadcastInterval) return;
        
        const message = JSON.stringify(data);
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
        
        this.lastBroadcast = now;
    }
    
    parseIMUBlock(text) {
        // Parse IMU data blocks from ZED output
        const imuRegex = /IMU:\s*Orientation \(Ox, Oy, Oz, Ow\): \[([^\]]+)\]\s*Acceleration \[m\/s\^2\]: \[([^\]]+)\]\s*Angular velocity \[deg\/s\]: \[([^\]]+)\]/g;
        
        const matches = [];
        let match;
        
        while ((match = imuRegex.exec(text)) !== null) {
            try {
                const orientation = match[1].split(',').map(s => parseFloat(s.trim()));
                const acceleration = match[2].split(',').map(s => parseFloat(s.trim()));
                const angularVelocity = match[3].split(',').map(s => parseFloat(s.trim()));
                
                if (orientation.length === 4 && acceleration.length === 3 && angularVelocity.length === 3) {
                    matches.push({
                        quaternion: {
                            x: orientation[0],
                            y: orientation[1], 
                            z: orientation[2],
                            w: orientation[3]
                        },
                        acceleration: {
                            x: acceleration[0],
                            y: acceleration[1],
                            z: acceleration[2]
                        },
                        gyro: {
                            x: angularVelocity[0],
                            y: angularVelocity[1],
                            z: angularVelocity[2]
                        },
                        timestamp: Date.now()
                    });
                }
            } catch (e) {
                // Skip malformed blocks silently
                continue;
            }
        }
        
        return matches;
    }
    
    startDataInput() {
        let buffer = '';
        
        // Read from STDIN
        process.stdin.setEncoding('utf8');
        process.stdin.on('readable', () => {
            let chunk;
            while (null !== (chunk = process.stdin.read())) {
                buffer += chunk;
                this.processBuffer(buffer);
                
                // Keep only last 10KB to prevent memory issues
                if (buffer.length > 10240) {
                    buffer = buffer.slice(-5120);
                }
            }
        });
        
        process.stdin.on('end', () => {
            console.log('STDIN ended');
        });
        
        // Fallback: poll data.txt if it exists
        setInterval(() => {
            if (fs.existsSync('data.txt')) {
                try {
                    const data = fs.readFileSync('data.txt', 'utf8');
                    this.processBuffer(data);
                } catch (e) {
                    // Ignore file read errors
                }
            }
        }, 100);
        
        // Periodic signal loss check
        setInterval(() => {
            if (this.processor.isSignalLost()) {
                this.broadcast({
                    type: 'signal_lost',
                    timestamp: Date.now()
                });
            }
        }, 1000);
    }
    
    processBuffer(buffer) {
        const imuData = this.parseIMUBlock(buffer);
        
        imuData.forEach(data => {
            try {
                const processed = this.processor.processIMU(
                    data.quaternion,
                    data.acceleration, 
                    data.gyro,
                    data.timestamp
                );
                
                this.broadcast({
                    type: 'imu_data',
                    ...processed
                });
            } catch (e) {
                console.error('Error processing IMU data:', e.message);
            }
        });
    }
    
    start() {
        this.server.listen(this.port, () => {
            console.log(`IMU Viewer server running on http://localhost:${this.port}`);
            console.log('Waiting for IMU data on STDIN...');
            console.log('Usage: cat data.txt | node server.js');
            console.log('   or: tail -f /path/to/imu/output | node server.js');
        });
    }
}

// Start the server
const server = new IMUServer(8080);
server.start();


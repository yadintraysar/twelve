#!/usr/bin/env python3

import sys
import json
import time
import math
import re
import threading
import queue
import asyncio
import websockets
import http.server
import socketserver
from pathlib import Path
from collections import deque
import statistics

class QuaternionProcessor:
    def __init__(self):
        self.smoothing_tau = 0.9  # seconds
        self.median_window = 5
        self.deadband = 1.5  # degrees
        
        # State thresholds
        self.tilt_thresholds = {'tilting': 8, 'aggressive': 15}
        self.tilt_hysteresis = {'tilting': 6, 'aggressive': 13}
        self.rate_thresholds = {'tilting': 12, 'aggressive': 20}
        self.rate_hysteresis = 4
        
        # Dwell times (seconds)
        self.dwell_times = {
            'tilting_mag': 0.5,
            'aggressive_mag': 0.3,
            'tilting_rate': 0.4,
            'aggressive_rate': 0.25,
            'debounce': 1.0
        }
        
        # State tracking
        self.current_state = 'still'
        self.state_start_time = time.time()
        self.last_packet_time = time.time()
        
        # Smoothing state
        self.smoothed_quat = None
        self.roll_history = deque(maxlen=self.median_window)
        self.pitch_history = deque(maxlen=self.median_window)
        self.gyro_history = deque(maxlen=100)  # ~10 seconds at 10Hz
        
        # Calibration
        self.baseline_roll = 0
        self.baseline_pitch = 0
        self.is_calibrating = False
        self.calibration_samples = []
        
        # Trigger tracking
        self.triggers = {
            'tilt_mag': {'active': False, 'start_time': 0},
            'aggressive_mag': {'active': False, 'start_time': 0},
            'tilt_rate': {'active': False, 'start_time': 0},
            'aggressive_rate': {'active': False, 'start_time': 0}
        }
        
        self.last_timestamp = None
    
    def normalize(self, q):
        """Normalize quaternion"""
        mag = math.sqrt(q['x']**2 + q['y']**2 + q['z']**2 + q['w']**2)
        if mag == 0:
            return {'x': 0, 'y': 0, 'z': 0, 'w': 1}
        return {k: v/mag for k, v in q.items()}
    
    def slerp(self, q1, q2, t):
        """Spherical linear interpolation between quaternions"""
        dot = q1['x']*q2['x'] + q1['y']*q2['y'] + q1['z']*q2['z'] + q1['w']*q2['w']
        
        # If dot is negative, slerp won't take the shorter path
        if dot < 0.0:
            q2 = {k: -v for k, v in q2.items()}
            dot = -dot
        
        # If quaternions are very similar, use linear interpolation
        if dot > 0.9995:
            result = {
                k: q1[k] + t * (q2[k] - q1[k]) 
                for k in q1.keys()
            }
            return self.normalize(result)
        
        theta = math.acos(abs(dot))
        sin_theta = math.sin(theta)
        a = math.sin((1.0 - t) * theta) / sin_theta
        b = math.sin(t * theta) / sin_theta
        
        return {
            k: a * q1[k] + b * q2[k] 
            for k in q1.keys()
        }
    
    def quat_to_euler(self, q):
        """Convert quaternion to Euler angles (roll, pitch, yaw)"""
        # Roll (x-axis rotation)
        sinr_cosp = 2 * (q['w'] * q['x'] + q['y'] * q['z'])
        cosr_cosp = 1 - 2 * (q['x']**2 + q['y']**2)
        roll = math.atan2(sinr_cosp, cosr_cosp)
        
        # Pitch (y-axis rotation)
        sinp = 2 * (q['w'] * q['y'] - q['z'] * q['x'])
        if abs(sinp) >= 1:
            pitch = math.copysign(math.pi / 2, sinp)
        else:
            pitch = math.asin(sinp)
        
        # Yaw (z-axis rotation)
        siny_cosp = 2 * (q['w'] * q['z'] + q['x'] * q['y'])
        cosy_cosp = 1 - 2 * (q['y']**2 + q['z']**2)
        yaw = math.atan2(siny_cosp, cosy_cosp)
        
        return {
            'roll': math.degrees(roll),
            'pitch': math.degrees(pitch),
            'yaw': math.degrees(yaw)
        }
    
    def median_filter(self, values):
        """Apply median filter to values"""
        if not values:
            return 0
        return statistics.median(values)
    
    def apply_deadband(self, value):
        """Apply deadband to suppress small values"""
        return 0.0 if abs(value) < self.deadband else value
    
    def calculate_gyro_rms(self, gyro_data):
        """Calculate RMS of roll/pitch gyro over time window"""
        if not gyro_data:
            return 0
        sum_squares = sum(g['roll']**2 + g['pitch']**2 for g in gyro_data)
        return math.sqrt(sum_squares / len(gyro_data))
    
    def update_triggers(self, tilt_mag, gyro_rms, now):
        """Update state triggers based on magnitude and rate"""
        # Magnitude-based triggers
        tilt_trigger = tilt_mag >= self.tilt_thresholds['tilting']
        aggressive_trigger = tilt_mag >= self.tilt_thresholds['aggressive']
        
        # Rate-based triggers
        rate_tilt_trigger = gyro_rms >= self.rate_thresholds['tilting']
        rate_aggressive_trigger = gyro_rms >= self.rate_thresholds['aggressive']
        
        # Update triggers
        self.update_trigger('tilt_mag', tilt_trigger, self.dwell_times['tilting_mag'], now)
        self.update_trigger('aggressive_mag', aggressive_trigger, self.dwell_times['aggressive_mag'], now)
        self.update_trigger('tilt_rate', rate_tilt_trigger, self.dwell_times['tilting_rate'], now)
        self.update_trigger('aggressive_rate', rate_aggressive_trigger, self.dwell_times['aggressive_rate'], now)
        
        # Apply hysteresis for clearing
        if self.triggers['tilt_mag']['active'] and tilt_mag < self.tilt_hysteresis['tilting']:
            self.triggers['tilt_mag']['active'] = False
        if self.triggers['aggressive_mag']['active'] and tilt_mag < self.tilt_hysteresis['aggressive']:
            self.triggers['aggressive_mag']['active'] = False
        if self.triggers['tilt_rate']['active'] and gyro_rms < self.rate_hysteresis:
            self.triggers['tilt_rate']['active'] = False
        if self.triggers['aggressive_rate']['active'] and gyro_rms < self.rate_hysteresis:
            self.triggers['aggressive_rate']['active'] = False
    
    def update_trigger(self, name, condition, dwell_time, now):
        """Update individual trigger with dwell time"""
        trigger = self.triggers[name]
        
        if condition and not trigger['active']:
            if trigger['start_time'] == 0:
                trigger['start_time'] = now
            elif now - trigger['start_time'] >= dwell_time:
                trigger['active'] = True
        elif not condition:
            trigger['start_time'] = 0
    
    def determine_state(self):
        """Determine current state based on active triggers"""
        if self.triggers['aggressive_mag']['active'] or self.triggers['aggressive_rate']['active']:
            return 'aggressive'
        if self.triggers['tilt_mag']['active'] or self.triggers['tilt_rate']['active']:
            return 'tilting'
        return 'still'
    
    def process_imu(self, quat, accel, gyro, timestamp):
        """Process IMU data and return filtered result"""
        now = time.time()
        self.last_packet_time = now
        
        # Normalize quaternion
        normalized_quat = self.normalize(quat)
        
        # Apply SLERP smoothing
        if self.smoothed_quat is None:
            self.smoothed_quat = normalized_quat
        else:
            dt = min((timestamp - (self.last_timestamp or timestamp)) / 1000, 0.1)
            alpha = 1 - math.exp(-dt / self.smoothing_tau)
            self.smoothed_quat = self.slerp(self.smoothed_quat, normalized_quat, alpha)
        
        self.last_timestamp = timestamp
        
        # Convert to Euler angles
        euler = self.quat_to_euler(self.smoothed_quat)
        
        # Apply calibration offset
        raw_roll = euler['roll'] - self.baseline_roll
        raw_pitch = euler['pitch'] - self.baseline_pitch
        
        # Update history for median filtering
        self.roll_history.append(raw_roll)
        self.pitch_history.append(raw_pitch)
        
        # Apply median filter and deadband
        filtered_roll = self.apply_deadband(self.median_filter(self.roll_history))
        filtered_pitch = self.apply_deadband(self.median_filter(self.pitch_history))
        
        # Update gyro history for RMS calculation
        self.gyro_history.append({
            'roll': gyro['x'],
            'pitch': gyro['y'], 
            'timestamp': now
        })
        
        # Keep only last 300ms of gyro data
        cutoff_time = now - 0.3
        self.gyro_history = deque(
            (g for g in self.gyro_history if g['timestamp'] >= cutoff_time),
            maxlen=100
        )
        
        gyro_rms = self.calculate_gyro_rms(self.gyro_history)
        tilt_mag = math.sqrt(filtered_roll**2 + filtered_pitch**2)
        
        # Handle calibration
        if self.is_calibrating:
            self.calibration_samples.append({
                'roll': euler['roll'], 
                'pitch': euler['pitch']
            })
            if len(self.calibration_samples) >= 50:  # ~5 seconds at 10Hz
                self.finish_calibration()
        elif len(self.calibration_samples) == 0 and tilt_mag < 2.0 and gyro_rms < 2.0:
            self.start_calibration()
        
        # Update state machine
        self.update_triggers(tilt_mag, gyro_rms, now)
        new_state = self.determine_state()
        
        # Apply debounce when returning to still
        if new_state != self.current_state:
            if new_state == 'still' and now - self.state_start_time < self.dwell_times['debounce']:
                pass  # Don't change to still yet
            else:
                self.current_state = new_state
                self.state_start_time = now
        
        return {
            'timestamp': timestamp,
            'quaternion': self.smoothed_quat,
            'euler': {
                'roll': filtered_roll,
                'pitch': filtered_pitch,
                'yaw': euler['yaw']
            },
            'acceleration': accel,
            'gyroRMS': gyro_rms,
            'tiltMagnitude': tilt_mag,
            'state': self.current_state,
            'isCalibrating': self.is_calibrating
        }
    
    def start_calibration(self):
        """Start calibration process"""
        self.is_calibrating = True
        self.calibration_samples = []
        print('Starting auto-calibration...')
    
    def finish_calibration(self):
        """Finish calibration and compute baseline"""
        if not self.calibration_samples:
            return
        
        avg_roll = sum(c['roll'] for c in self.calibration_samples) / len(self.calibration_samples)
        avg_pitch = sum(c['pitch'] for c in self.calibration_samples) / len(self.calibration_samples)
        
        self.baseline_roll = avg_roll
        self.baseline_pitch = avg_pitch
        self.is_calibrating = False
        self.calibration_samples = []
        
        print(f'Calibration complete: Roll offset: {avg_roll:.2f}°, Pitch offset: {avg_pitch:.2f}°')
    
    def recalibrate(self):
        """Start manual recalibration"""
        self.start_calibration()
    
    def update_settings(self, settings):
        """Update processor settings"""
        if 'smoothingTau' in settings:
            self.smoothing_tau = settings['smoothingTau']
        if 'tiltThresholds' in settings:
            self.tilt_thresholds.update(settings['tiltThresholds'])
        if 'rateThresholds' in settings:
            self.rate_thresholds.update(settings['rateThresholds'])
    
    def is_signal_lost(self):
        """Check if signal has been lost"""
        return time.time() - self.last_packet_time > 1.0

class IMUServer:
    def __init__(self, port=8080):
        self.port = port
        self.processor = QuaternionProcessor()
        self.clients = set()
        self.last_broadcast = 0
        self.broadcast_interval = 0.05  # 20 Hz max
        self.data_queue = queue.Queue()
        
        # Start input thread
        self.input_thread = threading.Thread(target=self.read_input, daemon=True)
        self.input_thread.start()
        
        # Start processing thread
        self.process_thread = threading.Thread(target=self.process_data, daemon=True)
        self.process_thread.start()
    
    def parse_imu_block(self, text):
        """Parse IMU data blocks from ZED output"""
        pattern = r'IMU:\s*Orientation \(Ox, Oy, Oz, Ow\): \[([^\]]+)\]\s*Acceleration \[m/s\^2\]: \[([^\]]+)\]\s*Angular velocity \[deg/s\]: \[([^\]]+)\]'
        
        matches = []
        for match in re.finditer(pattern, text):
            try:
                orientation = [float(x.strip()) for x in match.group(1).split(',')]
                acceleration = [float(x.strip()) for x in match.group(2).split(',')]
                angular_velocity = [float(x.strip()) for x in match.group(3).split(',')]
                
                if len(orientation) == 4 and len(acceleration) == 3 and len(angular_velocity) == 3:
                    matches.append({
                        'quaternion': {
                            'x': orientation[0],
                            'y': orientation[1],
                            'z': orientation[2],
                            'w': orientation[3]
                        },
                        'acceleration': {
                            'x': acceleration[0],
                            'y': acceleration[1],
                            'z': acceleration[2]
                        },
                        'gyro': {
                            'x': angular_velocity[0],
                            'y': angular_velocity[1],
                            'z': angular_velocity[2]
                        },
                        'timestamp': int(time.time() * 1000)
                    })
            except (ValueError, IndexError):
                continue
        
        return matches
    
    def read_input(self):
        """Read input from STDIN"""
        buffer = ""
        
        for line in sys.stdin:
            buffer += line
            
            # Process buffer when it gets large enough
            if len(buffer) > 1000:
                imu_data = self.parse_imu_block(buffer)
                for data in imu_data:
                    self.data_queue.put(data)
                
                # Keep only last 500 chars to prevent memory issues
                buffer = buffer[-500:]
    
    def process_data(self):
        """Process IMU data from queue"""
        while True:
            try:
                data = self.data_queue.get(timeout=1.0)
                
                processed = self.processor.process_imu(
                    data['quaternion'],
                    data['acceleration'],
                    data['gyro'],
                    data['timestamp']
                )
                
                self.broadcast_data({
                    'type': 'imu_data',
                    **processed
                })
                
            except queue.Empty:
                # Check for signal loss
                if self.processor.is_signal_lost():
                    self.broadcast_data({
                        'type': 'signal_lost',
                        'timestamp': int(time.time() * 1000)
                    })
            except Exception as e:
                print(f'Error processing IMU data: {e}')
    
    def broadcast_data(self, data):
        """Broadcast data to WebSocket clients"""
        now = time.time()
        if now - self.last_broadcast < self.broadcast_interval:
            return
        
        message = json.dumps(data)
        
        # Store for WebSocket server
        self.last_message = message
        self.last_broadcast = now
    
    async def websocket_handler(self, websocket, path):
        """Handle WebSocket connections"""
        self.clients.add(websocket)
        print(f'Client connected, total clients: {len(self.clients)}')
        
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    if data.get('type') == 'recalibrate':
                        self.processor.recalibrate()
                except json.JSONDecodeError:
                    print('Invalid WebSocket message')
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self.clients.discard(websocket)
            print(f'Client disconnected, total clients: {len(self.clients)}')
    
    async def broadcast_loop(self):
        """Broadcast data to all WebSocket clients"""
        while True:
            if hasattr(self, 'last_message') and self.clients:
                message = self.last_message
                disconnected = set()
                
                for client in self.clients:
                    try:
                        await client.send(message)
                    except websockets.exceptions.ConnectionClosed:
                        disconnected.add(client)
                
                self.clients -= disconnected
            
            await asyncio.sleep(0.05)  # 20 Hz
    
    def start(self):
        """Start the server"""
        print(f'IMU Viewer server starting on http://localhost:{self.port}')
        print('Waiting for IMU data on STDIN...')
        print('Usage: cat data.txt | python3 server.py')
        print('   or: tail -f /path/to/imu/output | python3 server.py')
        
        # Start WebSocket server
        start_server = websockets.serve(
            self.websocket_handler, 
            'localhost', 
            self.port
        )
        
        # Create HTTP server for static files
        server_instance = self
        
        class HTTPHandler(http.server.SimpleHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, directory=str(Path(__file__).parent / 'public'), **kwargs)
            
            def do_POST(self):
                if self.path == '/recalibrate':
                    server_instance.processor.recalibrate()
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(b'{"success": true}')
                elif self.path == '/settings':
                    content_length = int(self.headers['Content-Length'])
                    post_data = self.rfile.read(content_length)
                    try:
                        settings = json.loads(post_data)
                        server_instance.processor.update_settings(settings)
                        self.send_response(200)
                        self.send_header('Content-type', 'application/json')
                        self.end_headers()
                        self.wfile.write(b'{"success": true}')
                    except json.JSONDecodeError:
                        self.send_response(400)
                        self.send_header('Content-type', 'application/json')
                        self.end_headers()
                        self.wfile.write(b'{"error": "Invalid JSON"}')
        
        # Start HTTP server on port 8081
        http_server = socketserver.TCPServer(('localhost', 8081), HTTPHandler)
        http_thread = threading.Thread(target=http_server.serve_forever, daemon=True)
        http_thread.start()
        
        print(f'HTTP server running on http://localhost:8081')
        
        # Run WebSocket server and broadcast loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(asyncio.gather(
            start_server,
            self.broadcast_loop()
        ))

if __name__ == '__main__':
    server = IMUServer(8080)
    try:
        server.start()
    except KeyboardInterrupt:
        print('\nShutting down...')
        sys.exit(0)

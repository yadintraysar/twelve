#!/bin/bash

# ZED Camera Multi-Stream Startup Script
# Starts all 4 ZED cameras (IDs 0-3) streaming to different ports
# Target IP: 192.168.1.39 (Mac receiver)

echo "Starting ZED Camera Multi-Stream Setup..."
echo "Target IP: 192.168.1.39"
echo "Cameras: 1 (port 5002), 2 (port 5004) - Camera 0 & 3 DISABLED"
echo ""

# Set display for GUI applications
export DISPLAY=:0

# Camera ID 0 - Port 5001 (has issues but will attempt) - COMMENTED OUT FOR NOW
## echo "Starting Camera ID 0 (S/N 51370096) on port 5001..."
## gst-launch-1.0 zedsrc camera-fps=30 camera-resolution=2 stream-type=0 do-timestamp=true enable-positional-tracking=false od-enabled=false depth-mode=0 camera-id=0 camera-disable-self-calib=true sdk-verbose=1 ! queue ! videoconvert ! x264enc byte-stream=true tune=zerolatency speed-preset=ultrafast bitrate=2000 ! h264parse ! rtph264pay config-interval=-1 pt=96 ! queue ! udpsink clients=192.168.1.39:5001 max-bitrate=2000000 sync=false async=false &
## PID_CAM0=$!
## echo "Camera 0 started with PID: $PID_CAM0"

## # Wait longer between camera starts for proper initialization
## echo "Waiting 10 seconds for Camera 0 to fully initialize..."
## sleep 10

PID_CAM0=""  # Set empty for now since camera 0 is disabled

# Camera ID 1 - Port 5002 (working with some warnings)
echo "Starting Camera ID 1 (S/N 59919470) on port 5002..."
gst-launch-1.0 zedsrc camera-fps=30 camera-resolution=2 stream-type=0 do-timestamp=true enable-positional-tracking=false od-enabled=false depth-mode=0 camera-id=1 camera-disable-self-calib=true sdk-verbose=1 ! queue ! videoconvert ! x264enc byte-stream=true tune=zerolatency speed-preset=ultrafast bitrate=2000 ! h264parse ! rtph264pay config-interval=-1 pt=96 ! queue ! udpsink clients=192.168.1.39:5002 max-bitrate=2000000 sync=false async=false &
PID_CAM1=$!
echo "Camera 1 started with PID: $PID_CAM1"

# Wait longer between camera starts for proper initialization
echo "Waiting 10 seconds for Camera 1 to fully initialize..."
sleep 10

# Camera ID 2 - Port 5004 (working cleanly)
echo "Starting Camera ID 2 (S/N 51553791) on port 5004..."
gst-launch-1.0 zedsrc camera-fps=30 camera-resolution=2 stream-type=0 do-timestamp=true enable-positional-tracking=false od-enabled=false depth-mode=0 camera-id=2 camera-disable-self-calib=true sdk-verbose=1 ! queue ! videoconvert ! x264enc byte-stream=true tune=zerolatency speed-preset=ultrafast bitrate=2000 ! h264parse ! rtph264pay config-interval=-1 pt=96 ! queue ! udpsink clients=192.168.1.39:5004 max-bitrate=2000000 sync=false async=false &
PID_CAM2=$!
echo "Camera 2 started with PID: $PID_CAM2"

# Camera ID 3 - Port 5003 (best performance) - COMMENTED OUT FOR NOW
## echo "Waiting 10 seconds for Camera 2 to fully initialize..."
## sleep 10
## echo "Starting Camera ID 3 (S/N 57942132) on port 5003..."
## gst-launch-1.0 zedsrc camera-fps=30 camera-resolution=2 stream-type=0 do-timestamp=true enable-positional-tracking=false od-enabled=false depth-mode=0 camera-id=3 camera-disable-self-calib=true sdk-verbose=1 ! queue ! videoconvert ! x264enc byte-stream=true tune=zerolatency speed-preset=ultrafast bitrate=2000 ! h264parse ! rtph264pay config-interval=-1 pt=96 ! queue ! udpsink clients=192.168.1.39:5003 max-bitrate=2000000 sync=false async=false &
## PID_CAM3=$!
## echo "Camera 3 started with PID: $PID_CAM3"

PID_CAM3=""  # Set empty for now since camera 3 is disabled

echo ""
echo "Cameras 1, 2 started successfully! (Camera 0 & 3 disabled for now)"
echo "Process IDs:"
echo "  Camera 0: DISABLED"
echo "  Camera 1: $PID_CAM1" 
echo "  Camera 2: $PID_CAM2"
echo "  Camera 3: DISABLED"
echo ""
echo "Streaming to 192.168.1.39 on ports:"
echo "  Camera 0 → DISABLED (Port 5001)"
echo "  Camera 1 → Port 5002"
echo "  Camera 2 → Port 5004"
echo "  Camera 3 → DISABLED (Port 5003)"
echo ""
echo "To stop all streams, run: kill $PID_CAM1 $PID_CAM2"
echo "Or use: pkill -f 'gst-launch.*zedsrc'"
echo ""
echo "Note: Camera 0 is currently disabled due to corrupted frame issues."
echo "      Only cameras 1 and 2 are active."

# Keep script running to monitor processes
echo "Press Ctrl+C to stop all streams..."
wait




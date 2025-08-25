#!/bin/bash

# ZED Global Localization Launch Script
# Launches ZED Global Localization with map server for web visualization
# Works with your existing ZED camera setup (Camera IDs 0-3)

echo "=== ZED Global Localization Setup ==="
echo "Date: $(date)"
echo "ZED SDK Version: 5.0"
echo "Platform: NVIDIA Jetson JetPack 6.0 GA"
echo ""

# Set display for GUI applications
export DISPLAY=:0

# Check if ZED cameras are available
echo "Checking ZED camera availability..."
/usr/local/zed/tools/ZED_Diagnostic | grep -i "camera"

echo ""
echo "Available ZED cameras from your setup:"
echo "  Camera 0 (S/N 51370096) - Has issues but may work"
echo "  Camera 1 (S/N 59919470) - Working with warnings" 
echo "  Camera 2 (S/N 51553791) - Working cleanly"
echo "  Camera 3 (S/N 57942132) - Best performance (recommended)"
echo ""

# Prompt user for camera selection
read -p "Which ZED camera ID would you like to use for Global Localization (0-3)? [3]: " CAMERA_ID
CAMERA_ID=${CAMERA_ID:-3}

echo "Selected Camera ID: $CAMERA_ID"
echo ""

# Check GNSS/GPS options
echo "=== GNSS/GPS Configuration ==="
echo "Global Localization can work in two modes:"
echo "1. ZED Visual-Inertial Odometry only (no external GPS)"
echo "2. ZED + External GNSS sensor (via gpsd)"
echo ""

# Check if gpsd is running
if pgrep -x "gpsd" > /dev/null; then
    echo "✅ GPSD is running"
    GPS_MODE="enabled"
else
    echo "ℹ️  GPSD is not running - will use ZED-only mode"
    GPS_MODE="disabled"
fi

echo ""
echo "=== Starting Map Server ==="
echo "Starting web-based map visualization server..."

# Start map server in background
cd "/home/nvidia/Desktop/zed-sdk/global localization/map server"
python3 -m http.server 8000 --bind 0.0.0.0 > /dev/null 2>&1 &
MAP_SERVER_PID=$!

sleep 2
echo "✅ Map server started (PID: $MAP_SERVER_PID)"
echo "📍 Map available at: http://192.168.1.254:8000"
echo "📍 Also accessible at: http://localhost:8000"
echo ""

# Start Global Localization
echo "=== Starting ZED Global Localization ==="
echo "Camera ID: $CAMERA_ID"
echo "GPS Mode: $GPS_MODE"
echo ""

cd "/home/nvidia/Desktop/zed-sdk/global localization/live/cpp/build"

# Launch with selected camera
echo "Launching ZED Global Localization..."
echo "This will open a 3D visualization window showing the camera path."
echo "The web browser map will update in real-time at http://192.168.1.254:8000"
echo ""

# Note about camera selection
echo "Note: The application will use the first available ZED camera."
echo "If you need a specific camera, disconnect others or modify the source code."
echo ""

# Set to max performance mode
echo "Setting Jetson to maximum performance mode..."
sudo nvpmodel -m 0 2>/dev/null || echo "Note: Could not set nvpmodel (may require sudo)"

echo "Starting in 3 seconds..."
sleep 3

# Launch the application (it will automatically find the first available camera)
if [ "$GPS_MODE" = "enabled" ]; then
    echo "Running with GNSS integration..."
    ./ZED_Live_Global_Localization
else
    echo "Running with ZED Visual-Inertial Odometry only..."
    ./ZED_Live_Global_Localization
fi

# Cleanup function
cleanup() {
    echo ""
    echo "=== Cleanup ==="
    echo "Stopping map server (PID: $MAP_SERVER_PID)..."
    kill $MAP_SERVER_PID 2>/dev/null
    echo "Global Localization stopped."
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

echo ""
echo "=== Global Localization Running ==="
echo "Press Ctrl+C to stop all processes"
echo ""
echo "Visualization:"
echo "  - 3D Path: OpenGL window"
echo "  - Map View: http://192.168.1.254:8000"
echo "  - KML Export: Available in application directory"
echo ""

# Keep script running
wait

#!/bin/bash

# Simple ZED Global Localization Runner
echo "=== ZED Global Localization ==="
echo "Starting with Camera 3 (S/N 57942132) - Your best camera"
echo ""

# Start map server for web visualization
echo "Starting map server..."
cd "/home/nvidia/Desktop/zed-sdk/global localization/map server"
python3 -m http.server 8000 --bind 0.0.0.0 > /dev/null 2>&1 &
MAP_PID=$!
echo "✅ Map server running at: http://192.168.1.254:8000"
echo ""

# Set performance mode
sudo nvpmodel -m 0 2>/dev/null || echo "Note: Could not set performance mode"

# Run global localization
echo "Starting ZED Global Localization..."
echo "📍 3D visualization will open in a window"
echo "📍 Web map available at: http://192.168.1.254:8000"
echo "📍 Press Ctrl+C to stop"
echo ""

cd "/home/nvidia/Desktop/zed-sdk/global localization/live/cpp/build"
export DISPLAY=:0

# Cleanup function
cleanup() {
    echo ""
    echo "Stopping map server..."
    kill $MAP_PID 2>/dev/null
    echo "Done."
    exit 0
}

trap cleanup SIGINT SIGTERM

# Run the application
./ZED_Live_Global_Localization

cleanup

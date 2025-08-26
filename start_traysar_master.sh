#!/bin/bash

# Master ZED System Startup Script
# Runs all three components of the ZED system in parallel

echo "Starting ZED Master System..."
echo "Components:"
echo "  1. HTTP Map Server (port 8000)"
echo "  2. ZED Live Global Localization"
echo "  3. ZED Camera Streams"
echo ""

# Array to store PIDs for cleanup
PIDS=()

# Function to cleanup all processes on exit
cleanup() {
    echo ""
    echo "Shutting down all ZED system components..."
    
    # Kill all background processes
    for pid in "${PIDS[@]}"; do
        if kill -0 $pid 2>/dev/null; then
            echo "Stopping process $pid..."
            kill $pid
        fi
    done
    
    # Also kill any remaining ZED-related processes
    pkill -f "python3 -m http.server 8000" 2>/dev/null
    pkill -f "ZED_Live_Global_Localization" 2>/dev/null
    pkill -f "gst-launch.*zedsrc" 2>/dev/null
    
    echo "All components stopped."
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# 1. Start HTTP Map Server
echo "Starting HTTP Map Server..."
cd "/home/nvidia/Desktop/zed-sdk/global localization/map server" && python3 -m http.server 8000 | cat &
PID_HTTP=$!
PIDS+=($PID_HTTP)
echo "HTTP Map Server started with PID: $PID_HTTP"

# Small delay to ensure server starts
sleep 2

# 2. Start ZED Live Global Localization
echo "Starting ZED Live Global Localization..."
(cd "/home/nvidia/Desktop/zed-sdk/global localization/live/cpp/build" && export DISPLAY=:0 && export CAM_STREAM_HOST=192.168.1.39 && export CAM_STREAM_PORT=5001 && export CAM_STREAM_ENCODER=nv && ./ZED_Live_Global_Localization) &
PID_LOCALIZATION=$!
PIDS+=($PID_LOCALIZATION)
echo "ZED Live Global Localization started with PID: $PID_LOCALIZATION"

# Small delay before starting camera streams
sleep 3

# 3. Start ZED Camera Streams using existing script
echo "Starting ZED Camera Streams..."
cd "/home/nvidia/Desktop"
./start_all_zed_streams.sh &
PID_CAMERAS=$!
PIDS+=($PID_CAMERAS)
echo "ZED Camera Streams started with PID: $PID_CAMERAS"

echo ""
echo "All ZED system components started successfully!"
echo "Process IDs:"
echo "  HTTP Map Server: $PID_HTTP"
echo "  ZED Live Global Localization: $PID_LOCALIZATION"
echo "  ZED Camera Streams: $PID_CAMERAS"
echo ""
echo "HTTP Map Server running on: http://localhost:8000"
echo "Camera streams targeting: 192.168.1.39"
echo ""
echo "Press Ctrl+C to stop all components..."

# Wait for all background processes
wait

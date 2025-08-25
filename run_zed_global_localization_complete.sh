#!/bin/bash

# Complete ZED Global Localization Setup
# Runs both the map server and global localization application together

echo "🚀 ZED Global Localization - Complete Setup"
echo "📍 Starting position: 40.7672618, -73.9844867 (Central Park, NYC)"
echo "📷 Using Camera: S/N 57942132 (your best ZED camera)"
echo ""

# Set performance mode
echo "⚡ Setting Jetson to maximum performance..."
sudo nvpmodel -m 0 2>/dev/null || echo "Note: Could not set performance mode"

# Start map server in background
echo "🗺️  Starting map server..."
cd "/home/nvidia/Desktop/zed-sdk/global localization/map server"
python3 -m http.server 8000 --bind 0.0.0.0 > /dev/null 2>&1 &
MAP_PID=$!

# Wait a moment for server to start
sleep 2

echo "✅ Map server running at: http://192.168.1.254:8000"
echo "✅ Also accessible at: http://localhost:8000"
echo ""

# Start global localization
echo "🎯 Starting ZED Global Localization..."
echo "📊 3D visualization will open in OpenGL window"
echo "🌍 Web map overlay available in browser"
echo ""
echo "Press Ctrl+C to stop everything..."
echo ""

cd "/home/nvidia/Desktop/zed-sdk/global localization/live/cpp/build"
export DISPLAY=:0

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Stopping all processes..."
    echo "   Stopping map server (PID: $MAP_PID)..."
    kill $MAP_PID 2>/dev/null
    echo "   Stopping global localization..."
    echo "✅ All processes stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Run the global localization application
./ZED_Live_Global_Localization

# If we reach here, the app exited normally
cleanup

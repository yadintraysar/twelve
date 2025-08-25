#!/bin/bash

# ZED Camera Multi-Stream Receiver Script for Mac
# Receives all 4 ZED camera streams from Jetson (192.168.1.254)
# Each stream will open in a separate window

echo "Starting ZED Camera Multi-Stream Receiver for Mac..."
echo "Source IP: 192.168.1.254 (Jetson)"
echo "Receiving on ports: 5001 (Cam 0), 5002 (Cam 1), 5004 (Cam 2) - Cam 3 DISABLED"
echo ""

# Check if GStreamer is available
if ! command -v gst-launch-1.0 &> /dev/null; then
    echo "ERROR: GStreamer not found. Please install with:"
    echo "brew install gstreamer gst-plugins-base gst-plugins-good gst-plugins-bad gst-plugins-ugly gst-libav"
    exit 1
fi

# Camera 0 - Port 5001 (may have corrupted frames but should work)
echo "Starting receiver for Camera 0 on port 5001..."
gst-launch-1.0 udpsrc port=5001 ! application/x-rtp,clock-rate=90000,payload=96 ! queue ! rtph264depay ! h264parse ! avdec_h264 ! queue ! autovideoconvert ! fpsdisplaysink text-overlay=false video-sink=osxvideosink name="Camera 0 (S/N 51370096)" &
PID_RX0=$!
echo "Camera 0 receiver started with PID: $PID_RX0"

# Wait a moment between starts
sleep 1

# Camera 1 - Port 5002 (working with some warnings)
echo "Starting receiver for Camera 1 on port 5002..."
gst-launch-1.0 udpsrc port=5002 ! application/x-rtp,clock-rate=90000,payload=96 ! queue ! rtph264depay ! h264parse ! avdec_h264 ! queue ! autovideoconvert ! fpsdisplaysink text-overlay=false video-sink=osxvideosink name="Camera 1 (S/N 59919470)" &
PID_RX1=$!
echo "Camera 1 receiver started with PID: $PID_RX1"

# Wait a moment between starts
sleep 1

# Camera 2 - Port 5004 (working cleanly)
echo "Starting receiver for Camera 2 on port 5004..."
gst-launch-1.0 udpsrc port=5004 ! application/x-rtp,clock-rate=90000,payload=96 ! queue ! rtph264depay ! h264parse ! avdec_h264 ! queue ! autovideoconvert ! fpsdisplaysink text-overlay=false video-sink=osxvideosink name="Camera 2 (S/N 51553791)" &
PID_RX2=$!
echo "Camera 2 receiver started with PID: $PID_RX2"

# Wait a moment between starts
sleep 1

# Camera 3 - Port 5003 (best performance) - COMMENTED OUT FOR NOW
## echo "Starting receiver for Camera 3 on port 5003..."
## gst-launch-1.0 udpsrc port=5003 ! application/x-rtp,clock-rate=90000,payload=96 ! queue ! rtph264depay ! h264parse ! avdec_h264 ! queue ! autovideoconvert ! fpsdisplaysink text-overlay=false video-sink=osxvideosink name="Camera 3 (S/N 57942132)" &
## PID_RX3=$!
## echo "Camera 3 receiver started with PID: $PID_RX3"

PID_RX3=""  # Set empty for now since camera 3 is disabled

echo ""
echo "Camera receivers 0, 1, 2 started successfully! (Camera 3 disabled for now)"
echo "Process IDs:"
echo "  Camera 0 Receiver: $PID_RX0"
echo "  Camera 1 Receiver: $PID_RX1"
echo "  Camera 2 Receiver: $PID_RX2" 
echo "  Camera 3 Receiver: DISABLED"
echo ""
echo "Receiving from 192.168.1.254 on ports:"
echo "  Camera 0 ← Port 5001"
echo "  Camera 1 ← Port 5002"
echo "  Camera 2 ← Port 5004"
echo "  Camera 3 ← DISABLED (Port 5003)"
echo ""
echo "Each camera stream should open in a separate window."
echo ""
echo "To stop all receivers, run: kill $PID_RX0 $PID_RX1 $PID_RX2"
echo "Or use: pkill -f 'gst-launch.*udpsrc'"
echo ""
echo "Troubleshooting:"
echo "- If no video appears, check that the Jetson streams are running first"
echo "- Verify network connectivity: ping 192.168.1.254"
echo "- Check firewall settings if streams don't connect"
echo ""
echo "Press Ctrl+C to stop all receivers..."

# Function to handle cleanup on script exit
cleanup() {
    echo ""
    echo "Stopping all receivers..."
    kill $PID_RX0 $PID_RX1 $PID_RX2 2>/dev/null
    echo "All receivers stopped."
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Keep script running to monitor processes
wait

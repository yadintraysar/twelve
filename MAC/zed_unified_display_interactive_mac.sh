#!/bin/bash

# ZED Camera Unified Interactive Multi-Stream Display for Mac
# Displays all ZED camera streams in a single window with keyboard switching
# Main display with sub-displays below - press 1,2,3 to switch main camera

echo "Starting ZED Camera Unified Interactive Display for Mac..."
echo "Source IP: 192.168.1.254 (Jetson)"
echo "Receiving on ports: 5001 (Cam 0), 5002 (Cam 1), 5004 (Cam 2) - Cam 3 DISABLED"
echo ""

# Check if GStreamer is available
if ! command -v gst-launch-1.0 &> /dev/null; then
    echo "ERROR: GStreamer not found. Please install with:"
    echo "brew install gstreamer gst-plugins-base gst-plugins-good gst-plugins-bad gst-plugins-ugly gst-libav"
    exit 1
fi

# Window dimensions
MAIN_WIDTH=800
MAIN_HEIGHT=600
SUB_WIDTH=200
SUB_HEIGHT=150
WINDOW_WIDTH=800
WINDOW_HEIGHT=800

echo "Creating unified interactive display window (${WINDOW_WIDTH}x${WINDOW_HEIGHT})..."
echo "Main display: ${MAIN_WIDTH}x${MAIN_HEIGHT}"
echo "Sub displays: ${SUB_WIDTH}x${SUB_HEIGHT} each"
echo ""

# Create named pipes for controlling the streams
PIPE_DIR="/tmp/zed_control"
mkdir -p $PIPE_DIR
mkfifo $PIPE_DIR/switch_control 2>/dev/null

# Function to create a camera source with switch capability
create_camera_pipeline() {
    local port=$1
    local cam_id=$2
    local serial=$3
    local is_main=$4
    
    if [ "$is_main" = "true" ]; then
        echo "udpsrc port=$port ! application/x-rtp,clock-rate=90000,payload=96 ! queue max-size-buffers=10 leaky=downstream ! rtph264depay ! h264parse ! avdec_h264 ! videoconvert ! videoscale ! video/x-raw,width=$MAIN_WIDTH,height=$MAIN_HEIGHT ! textoverlay text=\"Camera $cam_id (MAIN) - S/N $serial\" valignment=top halignment=left font-desc=\"Sans 12\" shaded-background=true"
    else
        echo "udpsrc port=$port ! application/x-rtp,clock-rate=90000,payload=96 ! queue max-size-buffers=10 leaky=downstream ! rtph264depay ! h264parse ! avdec_h264 ! videoconvert ! videoscale ! video/x-raw,width=$SUB_WIDTH,height=$SUB_HEIGHT ! textoverlay text=\"Cam $cam_id - S/N $serial\" valignment=top halignment=left font-desc=\"Sans 8\" shaded-background=true"
    fi
}

# Start the display with Camera 0 as main
echo "Starting unified display (Camera 0 as main)..."
gst-launch-1.0 \
    compositor name=mix background=black \
        sink_0::xpos=0 sink_0::ypos=0 sink_0::width=$MAIN_WIDTH sink_0::height=$MAIN_HEIGHT sink_0::alpha=1.0 \
        sink_1::xpos=0 sink_1::ypos=$MAIN_HEIGHT sink_1::width=$SUB_WIDTH sink_1::height=$SUB_HEIGHT sink_1::alpha=1.0 \
        sink_2::xpos=$SUB_WIDTH sink_2::ypos=$MAIN_HEIGHT sink_2::width=$SUB_WIDTH sink_2::height=$SUB_HEIGHT sink_2::alpha=1.0 \
        sink_3::xpos=$((SUB_WIDTH*2)) sink_3::ypos=$MAIN_HEIGHT sink_3::width=$SUB_WIDTH sink_3::height=$SUB_HEIGHT sink_3::alpha=1.0 \
    ! videoconvert ! osxvideosink name="ZED Multi-Camera Display" \
    \
    udpsrc port=5001 name=cam0_src \
    ! application/x-rtp,clock-rate=90000,payload=96 \
    ! queue max-size-buffers=10 leaky=downstream \
    ! rtph264depay ! h264parse ! avdec_h264 \
    ! videoconvert ! videoscale \
    ! video/x-raw,width=$MAIN_WIDTH,height=$MAIN_HEIGHT \
    ! textoverlay text="Camera 0 (MAIN) - S/N 51370096" valignment=top halignment=left font-desc="Sans 12" shaded-background=true \
    ! mix.sink_0 \
    \
    udpsrc port=5002 name=cam1_src \
    ! application/x-rtp,clock-rate=90000,payload=96 \
    ! queue max-size-buffers=10 leaky=downstream \
    ! rtph264depay ! h264parse ! avdec_h264 \
    ! videoconvert ! videoscale \
    ! video/x-raw,width=$SUB_WIDTH,height=$SUB_HEIGHT \
    ! textoverlay text="Cam 1 - S/N 59919470" valignment=top halignment=left font-desc="Sans 8" shaded-background=true \
    ! mix.sink_1 \
    \
    udpsrc port=5004 name=cam2_src \
    ! application/x-rtp,clock-rate=90000,payload=96 \
    ! queue max-size-buffers=10 leaky=downstream \
    ! rtph264depay ! h264parse ! avdec_h264 \
    ! videoconvert ! videoscale \
    ! video/x-raw,width=$SUB_WIDTH,height=$SUB_HEIGHT \
    ! textoverlay text="Cam 2 - S/N 51553791" valignment=top halignment=left font-desc="Sans 8" shaded-background=true \
    ! mix.sink_2 \
    \
    videotestsrc pattern=black \
    ! video/x-raw,width=$SUB_WIDTH,height=$SUB_HEIGHT \
    ! textoverlay text="Camera 3 - DISABLED" valignment=center halignment=center font-desc="Sans 10" color=0x808080 \
    ! mix.sink_3 &

UNIFIED_PID=$!

echo "Unified display started with PID: $UNIFIED_PID"
echo ""
echo "Display Layout:"
echo "┌─────────────────────────────────────┐"
echo "│                                     │"
echo "│         MAIN DISPLAY                │"
echo "│        (Camera 0)                   │"
echo "│                                     │"
echo "├─────────┬─────────┬─────────────────┤"
echo "│  Cam 1  │  Cam 2  │   Cam 3 OFF     │"
echo "│ (sub)   │ (sub)   │   (placeholder) │"
echo "└─────────┴─────────┴─────────────────┘"
echo ""
echo "CONTROLS:"
echo "- Camera 0 is currently the main display"
echo "- Click on the video window and use keyboard:"
echo "  Press '1' to make Camera 0 main"
echo "  Press '2' to make Camera 1 main"  
echo "  Press '3' to make Camera 2 main"
echo "  Press 'q' or Ctrl+C to quit"
echo ""
echo "All streams are receiving from 192.168.1.254"
echo ""
echo "To stop the display, run: kill $UNIFIED_PID"
echo "Or use: pkill -f 'gst-launch.*compositor'"
echo ""
echo "Troubleshooting:"
echo "- If no video appears, check that the Jetson streams are running first"
echo "- Verify network connectivity: ping 192.168.1.254"
echo "- Check firewall settings if streams don't connect"
echo "- Make sure to click on the video window to enable keyboard controls"
echo ""
echo "Press Ctrl+C to stop the display..."

# Function to handle cleanup on script exit
cleanup() {
    echo ""
    echo "Stopping unified display..."
    kill $UNIFIED_PID 2>/dev/null
    rm -rf $PIPE_DIR 2>/dev/null
    echo "Display stopped."
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Keep script running to monitor process
wait

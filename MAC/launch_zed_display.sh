#!/bin/bash

# ZED Camera Unified Display Launcher for Mac
# Launches the unified display application with all necessary checks

echo "ZED Camera Unified Display Launcher"
echo "==================================="
echo ""

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 not found. Please install Python 3."
    exit 1
fi

# Check if OpenCV is available
if ! python3 -c "import cv2" &> /dev/null; then
    echo "ERROR: OpenCV for Python not found. Please install with:"
    echo "pip3 install opencv-python"
    echo ""
    echo "You may also need GStreamer support:"
    echo "brew install gstreamer gst-plugins-base gst-plugins-good gst-plugins-bad gst-plugins-ugly gst-libav"
    echo "pip3 install opencv-contrib-python"
    exit 1
fi

# Check if NumPy is available
if ! python3 -c "import numpy" &> /dev/null; then
    echo "ERROR: NumPy not found. Please install with:"
    echo "pip3 install numpy"
    exit 1
fi

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_APP="$SCRIPT_DIR/zed_display_app.py"

# Check if the Python app exists
if [ ! -f "$PYTHON_APP" ]; then
    echo "ERROR: ZED display app not found at: $PYTHON_APP"
    exit 1
fi

# Make the Python app executable
chmod +x "$PYTHON_APP"

echo "All dependencies found!"
echo ""
echo "Launching ZED Unified Display Application..."
echo "Source: Jetson at 192.168.1.254"
echo "Active cameras: 0, 1, 2 (Camera 3 disabled)"
echo ""
echo "Application will open in a new window."
echo "Controls:"
echo "  - Click on sub-displays to switch main camera"
echo "  - Press '1', '2', '3' to switch to specific cameras"
echo "  - Press 'q' or ESC to quit"
echo ""
echo "Starting application..."
echo ""

# Launch the Python application
python3 "$PYTHON_APP" "$@"

echo ""
echo "Application closed."

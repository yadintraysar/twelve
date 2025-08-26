#!/bin/bash

# Setup script for ZED Display on Mac
# Run this after transferring the MAC folder to your Mac

echo "Setting up ZED Display files on Mac..."
echo "======================================"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Making scripts executable..."
chmod +x *.sh *.py

echo "Checking file permissions..."
ls -la *.sh *.py

echo ""
echo "Checking dependencies..."
echo ""

# Check if Python 3 is available
if command -v python3 &> /dev/null; then
    echo "✓ Python 3 found: $(python3 --version)"
else
    echo "✗ Python 3 not found. Please install Python 3."
    echo "  You can install from: https://www.python.org/downloads/"
    echo "  Or use Homebrew: brew install python3"
fi

# Check if pip3 is available
if command -v pip3 &> /dev/null; then
    echo "✓ pip3 found"
else
    echo "✗ pip3 not found. Please install pip3."
fi

# Check if Homebrew is available
if command -v brew &> /dev/null; then
    echo "✓ Homebrew found"
else
    echo "✗ Homebrew not found. Install from: https://brew.sh"
    echo "  Homebrew is needed for GStreamer installation"
fi

echo ""
echo "Next steps:"
echo "1. Install GStreamer (if not already installed):"
echo "   brew install gstreamer gst-plugins-base gst-plugins-good gst-plugins-bad gst-plugins-ugly gst-libav"
echo ""
echo "2. Install Python dependencies:"
echo "   pip3 install -r requirements.txt"
echo ""
echo "3. Run the display application:"
echo "   ./launch_zed_display.sh"
echo ""
echo "Setup complete!"


# ZED Camera Unified Display for Mac

This folder contains the macOS receiver applications for displaying ZED camera streams from the Jetson device in a unified interface.

## Files

- `launch_zed_display.sh` - **Main launcher script** (start here!)
- `zed_display_app.py` - Python-based unified display with interactive switching
- `zed_unified_display_mac.sh` - GStreamer-only unified display (basic)
- `zed_unified_display_interactive_mac.sh` - GStreamer unified display with keyboard controls
- `requirements.txt` - Python dependencies

## Quick Start

1. **Install dependencies:**
   ```bash
   # Install GStreamer
   brew install gstreamer gst-plugins-base gst-plugins-good gst-plugins-bad gst-plugins-ugly gst-libav
   
   # Install Python packages
   pip3 install -r requirements.txt
   ```

2. **Launch the unified display:**
   ```bash
   ./launch_zed_display.sh
   ```

## Display Layout

```
┌─────────────────────────────────────┐
│                                     │
│         MAIN DISPLAY                │
│        (Camera 0 default)           │
│                                     │
├─────────┬─────────┬─────────────────┤
│  Cam 1  │  Cam 2  │   Cam 3 OFF     │
│ (sub)   │ (sub)   │   (placeholder) │
└─────────┴─────────┴─────────────────┘
```

## Controls (Python App)

- **Click** on sub-displays to switch main camera
- **Press '1'** to make Camera 0 main
- **Press '2'** to make Camera 1 main  
- **Press '3'** to make Camera 2 main
- **Press 'q'** or **ESC** to quit

## Options

### Python App (Recommended)
- Full interactive switching
- Click-to-switch functionality
- Better error handling
- Real-time status display

### GStreamer Only
- Lower resource usage
- More basic interface
- Use if Python/OpenCV isn't available

## Troubleshooting

- Ensure Jetson streams are running first
- Check network connectivity: `ping 192.168.1.254`
- Verify firewall settings allow UDP ports 5001, 5002, 5004
- For Python app: Make sure OpenCV has GStreamer support

## Camera Configuration

- **Camera 0**: Port 5001, S/N 51370096
- **Camera 1**: Port 5002, S/N 59919470  
- **Camera 2**: Port 5004, S/N 51553791
- **Camera 3**: DISABLED (Port 5003, S/N 57942132)

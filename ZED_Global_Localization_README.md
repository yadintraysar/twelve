# ZED Global Localization Setup

## Overview
This setup provides real-time global localization using your ZED camera connected to the NVIDIA Jetson. The system combines ZED visual-inertial odometry with optional GNSS data for accurate positioning on a real-world map.

## What's Included

### 1. ZED Global Localization Application
- **Location**: `/home/nvidia/Desktop/zed-sdk/global localization/live/cpp/build/ZED_Live_Global_Localization`
- **Features**:
  - Real-time 3D path visualization
  - Global positioning with map integration
  - KML export for trajectory data
  - GNSS fusion capability

### 2. Launch Script
- **File**: `launch_zed_global_localization.sh`
- **Features**:
  - Automatic camera selection (recommends Camera 3 - S/N 57942132)
  - Map server startup
  - Performance optimization
  - Graceful cleanup

### 3. Web-based Map Visualization
- **URL**: http://192.168.1.254:8000 (or http://localhost:8000)
- **Features**:
  - Real-time position tracking
  - Interactive map interface
  - Trajectory history

## Your ZED Camera Setup

| Camera ID | Serial Number | Status | Recommendation |
|-----------|--------------|---------|----------------|
| 0 | S/N 51370096 | ❌ Issues | Avoid - frequent corrupted frames |
| 1 | S/N 59919470 | ⚠️ Working | Usable with warnings |
| 2 | S/N 51553791 | ✅ Working | Good performance |
| 3 | S/N 57942132 | ✅ Best | **Recommended** - cleanest output |

## Quick Start

### Option 1: Using the Launch Script (Recommended)
```bash
cd /home/nvidia/Desktop
./launch_zed_global_localization.sh
```

### Option 2: Manual Launch
```bash
# Start map server
cd "/home/nvidia/Desktop/zed-sdk/global localization/map server"
python3 -m http.server 8000 --bind 0.0.0.0 &

# Start global localization (Camera 3 recommended)
cd "/home/nvidia/Desktop/zed-sdk/global localization/live/cpp/build"
export DISPLAY=:0
./ZED_Live_Global_Localization --camera 3
```

## Operation Modes

### 1. ZED-Only Mode (Default)
- Uses ZED's visual-inertial odometry
- No external GPS required
- Provides relative positioning and mapping
- Good for indoor or GPS-denied environments

### 2. ZED + GNSS Mode
- Combines ZED odometry with external GPS
- Requires GNSS sensor and gpsd configuration
- Provides absolute global positioning
- Best for outdoor navigation applications

## Visualization

### 3D OpenGL Window
- Shows real-time camera path in 3D space
- Displays position and orientation data
- Interactive camera controls

### Web Map Interface
- Access at: http://192.168.1.254:8000
- Real-time position updates
- Satellite/street map views
- Trajectory history

## Integration with Your Existing Setup

This global localization system works alongside your existing ZED streaming setup:

### Existing Streaming (Continues to Work)
- `start_all_zed_streams.sh` - Multi-camera streaming to Mac
- `receive_all_zed_streams_mac.sh` - Mac receiver
- GStreamer pipeline with modified error handling

### New Global Localization (Additional Capability)
- Uses one ZED camera for localization
- Runs independently of streaming
- Can use the same camera simultaneously if needed

## Performance Optimization

The system automatically:
- Sets Jetson to maximum performance mode (`nvpmodel -m 0`)
- Uses optimized ZED SDK settings
- Enables GPU acceleration where available

## Output Files

The application generates:
- **KML files**: For trajectory visualization in Google Earth
- **Log files**: Detailed positioning data
- **Real-time data**: Sent to web map interface

## Troubleshooting

### Common Issues

1. **"Camera not found"**
   - Check camera connections
   - Try different camera IDs (0-3)
   - Use ZED Diagnostic: `/usr/local/zed/tools/ZED_Diagnostic`

2. **"No display"**
   - Ensure `export DISPLAY=:0` is set
   - Check X11 forwarding if using SSH

3. **Web map not loading**
   - Verify map server is running on port 8000
   - Check firewall settings
   - Try localhost:8000 instead of IP address

4. **Poor performance**
   - Ensure Jetson is in max performance mode
   - Close unnecessary applications
   - Use Camera 3 for best results

### Diagnostic Commands
```bash
# Check ZED cameras
/usr/local/zed/tools/ZED_Diagnostic

# Check GPS daemon
systemctl status gpsd

# Check running processes
ps aux | grep -E "(ZED_Live|python.*8000)"

# Test camera directly
gst-launch-1.0 zedsrc camera-id=3 ! autovideosink
```

## Next Steps

1. **Test the basic setup**: Run the launch script and verify 3D visualization
2. **Configure GNSS** (optional): Set up external GPS sensor with gpsd
3. **Integrate with applications**: Use the positioning data in your robotics/navigation projects
4. **Customize parameters**: Modify ZED settings for your specific use case

## Support

- ZED SDK Documentation: https://www.stereolabs.com/docs/
- Global Localization API: https://www.stereolabs.com/docs/global-localization/
- GitHub Repository: https://github.com/stereolabs/zed-sdk

Your setup is now ready for real-time global localization with ZED cameras!

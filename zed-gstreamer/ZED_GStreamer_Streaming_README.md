# ZED Camera GStreamer IP Streaming Setup

## Overview
This document summarizes the successful setup of ZED camera streaming over IP using GStreamer on NVIDIA Jetson, with modifications to handle corrupted frames gracefully.

## Hardware Setup
- **Platform**: NVIDIA Jetson (tegra-ubuntu)
- **Network**: 192.168.1.x subnet
- **Jetson IP**: 192.168.1.254
- **Mac IP**: 192.168.1.39
- **Available ZED Cameras**: 4 cameras (IDs 0-3)

## Camera Status
| Camera ID | Serial Number | Status | Notes |
|-----------|--------------|---------|-------|
| 0 | S/N 51370096 | ❌ Issues | Frequent corrupted frames, may have hardware problems |
| 1 | S/N 59919470 | ✅ Working | Some corrupted frame warnings but streams reliably |
| 2 | S/N 51553791 | ✅ Working | Clean streaming |
| 3 | S/N 57942132 | ✅ Best | No corrupted frame warnings, cleanest output |

## Key Modifications Made

### 1. ZED GStreamer Plugin Installation
- **Repository**: https://github.com/stereolabs/zed-gstreamer
- **Location**: `/home/nvidia/Desktop/zed-gstreamer/`
- **Build**: Standard CMake build process

### 2. Critical Source Code Modification
**File**: `/home/nvidia/Desktop/zed-gstreamer/gst-zed-src/gstzedsrc.cpp`
**Lines**: 2768-2782

**Problem**: ZED cameras would stop streaming entirely when encountering corrupted frames (common when cameras are occluded).

**Solution**: Modified error handling to skip corrupted frames instead of stopping the pipeline:

```cpp
if (ret != sl::ERROR_CODE::SUCCESS) {
    // Handle corrupted frames gracefully - just skip and continue
    if (ret == sl::ERROR_CODE::CORRUPTED_FRAME) {
        GST_WARNING_OBJECT(src, "Skipping corrupted frame: '%s' - %s", 
                           sl::toString(ret).c_str(), sl::toVerbose(ret).c_str());
        return GST_FLOW_OK;  // Continue pipeline instead of stopping
    }
    
    // For other errors, still fail as before
    GST_ELEMENT_ERROR(src, RESOURCE, FAILED,
                      ("Grabbing failed with error: '%s' - %s", sl::toString(ret).c_str(),
                       sl::toVerbose(ret).c_str()),
                      (NULL));
    return GST_FLOW_ERROR;
}
```

## Working Commands

### Jetson (Sender) Commands
```bash
# Camera ID 1 - Port 5002
export DISPLAY=:0 && gst-launch-1.0 zedsrc camera-fps=30 camera-resolution=2 stream-type=0 do-timestamp=true enable-positional-tracking=false od-enabled=false depth-mode=0 camera-id=1 camera-disable-self-calib=true sdk-verbose=1 ! queue ! videoconvert ! x264enc byte-stream=true tune=zerolatency speed-preset=ultrafast bitrate=2000 ! h264parse ! rtph264pay config-interval=-1 pt=96 ! queue ! udpsink clients=192.168.1.39:5002 max-bitrate=2000000 sync=false async=false &

# Camera ID 2 - Port 5004  
export DISPLAY=:0 && gst-launch-1.0 zedsrc camera-fps=30 camera-resolution=2 stream-type=0 do-timestamp=true enable-positional-tracking=false od-enabled=false depth-mode=0 camera-id=2 camera-disable-self-calib=true sdk-verbose=1 ! queue ! videoconvert ! x264enc byte-stream=true tune=zerolatency speed-preset=ultrafast bitrate=2000 ! h264parse ! rtph264pay config-interval=-1 pt=96 ! queue ! udpsink clients=192.168.1.39:5004 max-bitrate=2000000 sync=false async=false &

# Camera ID 3 - Port 5003 (RECOMMENDED - cleanest output)
export DISPLAY=:0 && gst-launch-1.0 zedsrc camera-fps=30 camera-resolution=2 stream-type=0 do-timestamp=true enable-positional-tracking=false od-enabled=false depth-mode=0 camera-id=3 camera-disable-self-calib=true sdk-verbose=1 ! queue ! videoconvert ! x264enc byte-stream=true tune=zerolatency speed-preset=ultrafast bitrate=2000 ! h264parse ! rtph264pay config-interval=-1 pt=96 ! queue ! udpsink clients=192.168.1.39:5003 max-bitrate=2000000 sync=false async=false &
```

### Mac (Receiver) Commands
```bash
# Receive from Camera ID 1
gst-launch-1.0 udpsrc port=5002 ! application/x-rtp,clock-rate=90000,payload=96 ! queue ! rtph264depay ! h264parse ! avdec_h264 ! queue ! autovideoconvert ! fpsdisplaysink &

# Receive from Camera ID 2  
gst-launch-1.0 udpsrc port=5004 ! application/x-rtp,clock-rate=90000,payload=96 ! queue ! rtph264depay ! h264parse ! avdec_h264 ! queue ! autovideoconvert ! fpsdisplaysink &

# Receive from Camera ID 3 (RECOMMENDED)
gst-launch-1.0 udpsrc port=5003 ! application/x-rtp,clock-rate=90000,payload=96 ! queue ! rtph264depay ! h264parse ! avdec_h264 ! queue ! autovideoconvert ! fpsdisplaysink &
```

## Key Parameters Explained

### ZED-Specific Parameters
- `camera-id=X`: Selects which ZED camera to use (0-3)
- `camera-disable-self-calib=true`: Disables self-calibration (reduces initialization issues)
- `depth-mode=0`: Sets depth mode to NONE (reduces processing overhead)
- `sdk-verbose=1`: Enables detailed ZED SDK logging
- `camera-resolution=2`: HD1200@30 (1200p at 30fps)
- `stream-type=0`: RGB left image only

### Network Parameters
- `clients=192.168.1.39:PORT`: Target IP and port for streaming
- `max-bitrate=2000000`: Maximum bitrate limit
- `sync=false async=false`: Reduces latency

### Encoding Parameters
- `tune=zerolatency`: Optimizes for low latency
- `speed-preset=ultrafast`: Fastest encoding (trades quality for speed)
- `bitrate=2000`: Target bitrate in kbps

## Troubleshooting

### Common Issues
1. **"no element zedsrc"**: ZED GStreamer plugin not installed
2. **Network connectivity**: Check IP addresses and firewall settings
3. **Corrupted frames**: Now handled gracefully with our modification
4. **Camera not found**: Try different camera IDs (0-3)

### Diagnostic Commands
```bash
# List available cameras
gst-inspect-1.0 | grep -i zed

# Test network connectivity
ping 192.168.1.39

# Check video devices
ls /dev/video*
```

## Recommendations
1. **Use Camera ID 3** for best performance (S/N 57942132)
2. **Always include `camera-disable-self-calib=true`** to avoid calibration issues
3. **Monitor for corrupted frame warnings** - they indicate camera occlusion but won't stop streaming
4. **Use different ports** (5001-5004) for multiple simultaneous streams

## Build Process (If Modifications Needed)
```bash
cd /home/nvidia/Desktop/zed-gstreamer/build
make -j$(nproc)
sudo make install
```

## Success Metrics
- ✅ Streams run continuously without stopping on corrupted frames
- ✅ Multiple cameras can stream simultaneously on different ports  
- ✅ Network streaming works reliably between Jetson and Mac
- ✅ Low latency configuration achieved with zerolatency tuning

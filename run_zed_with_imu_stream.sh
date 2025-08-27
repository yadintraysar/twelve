#!/bin/bash

# ZED Global Localization with IMU streaming to imu-viewer server
# Usage: ./run_zed_with_imu_stream.sh

export DISPLAY=:0
export CAM_STREAM_HOST=192.168.1.39
export CAM_STREAM_PORT=5001
export CAM_STREAM_ENCODER=nv

ZED_EXECUTABLE="/home/nvidia/Desktop/zed-sdk/global localization/live/cpp/build/ZED_Live_Global_Localization"
IMU_SERVER_DIR="/home/nvidia/Desktop/imu-viewer"

echo "Starting ZED Global Localization with IMU streaming..."
echo "Camera stream: ${CAM_STREAM_HOST}:${CAM_STREAM_PORT} (encoder: ${CAM_STREAM_ENCODER})"
echo "IMU WebSocket: ws://0.0.0.0:6080"
echo "IMU HTTP: http://0.0.0.0:6081"
echo ""

# Always (re)start IMU server bound to 0.0.0.0 for remote access
pkill -f "simple_server.py" 2>/dev/null || true
sleep 0.5

cd "${IMU_SERVER_DIR}" && (
  # Start server in background
  nohup python3 simple_server.py > /tmp/imu_server.log 2>&1 &
) && \
"${ZED_EXECUTABLE}" --stream-imu | nc -u -w0 127.0.0.1 9 >/dev/null 2>&1 || true

# Also stream directly to the server's STDIN if running interactively
"${ZED_EXECUTABLE}" --stream-imu | python3 simple_server.py


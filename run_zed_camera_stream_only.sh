#!/bin/bash

# Run ZED camera streaming from the Global Localization app (in-process GStreamer)
# Does not start the web map server. Streams LEFT image over RTP/H264.

HOST=${1:-192.168.1.39}
PORT=${2:-5005}
ENCODER=${3:-nv}    # nv (Jetson HW) or x264

export CAM_STREAM_HOST="$HOST"
export CAM_STREAM_PORT="$PORT"
export CAM_STREAM_ENCODER="$ENCODER"

export DISPLAY=:0

cd "/home/nvidia/Desktop/zed-sdk/global localization/live/cpp/build" || exit 1

echo "Streaming LEFT view to ${HOST}:${PORT} (encoder=${ENCODER})..."
./ZED_Live_Global_Localization | cat

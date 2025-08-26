#!/bin/bash
set -euo pipefail

HOST=${1:-}
PORT=${2:-5001}
FPS=${3:-30}
RES=${4:-HD720}
BITRATE=${5:-4000000}
SERIAL=${6:-0}

if [[ -z "${HOST}" ]]; then
  echo "Usage: $0 <HOST_IP> [PORT] [FPS] [RESOLUTION(VGA|HD720|HD1080|HD2K)] [BITRATE] [SERIAL]"
  exit 1
fi

exec python3 /home/nvidia/Desktop/zed_appsrc_sender.py \
  --host "${HOST}" \
  --port "${PORT}" \
  --fps "${FPS}" \
  --resolution "${RES}" \
  --bitrate "${BITRATE}" \
  --serial "${SERIAL}"



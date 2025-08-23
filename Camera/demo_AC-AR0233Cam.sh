#!/bin/bash

CAMERA=$1
#NRU=$(lsmod | grep nru | awk '{print $1}')
NRU=$(lsmod | grep nv_nru | awk '{print $1}' | head -n 1)

if [ -n "$NRU" ]; then
  echo nvidia | sudo -S rmmod $NRU 2>/dev/null 
fi

if [ "$CAMERA" = "AR0233" ]; then
  NRU="nv_nru2mp.ko"
else
  echo "Not support camera."
  exit 1
fi

echo "Initializing ..."
cd /home/nvidia/Desktop/Camera
echo nvidia | sudo -S sudo insmod $NRU 2>/dev/null
echo nvidia | sudo -S sudo ./init_8xAR0233.sh
echo nvidia | sudo -S sudo ./mv_addr.sh

./gst-launch_all.sh
sleep 0.5


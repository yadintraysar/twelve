#!/usr/bin/env python3

"""
ZED Camera Unified Display Application for Mac
Displays all ZED camera streams in a single window with interactive switching
Main display with sub-displays below - click on sub-displays to switch main camera
"""

import cv2
import numpy as np
import threading
import time
import sys
import socket
from typing import Dict, Optional, Tuple
import argparse

class ZEDStreamReceiver:
    def __init__(self, jetson_ip: str = "192.168.1.254"):
        self.jetson_ip = jetson_ip
        self.streams = {
            0: {"port": 5001, "serial": "51370096", "name": "Camera 0", "active": True},
            1: {"port": 5002, "serial": "59919470", "name": "Camera 1", "active": True}, 
            2: {"port": 5004, "serial": "51553791", "name": "Camera 2", "active": True},
            3: {"port": 5003, "serial": "57942132", "name": "Camera 3", "active": False}  # Disabled
        }
        
        self.main_camera = 0  # Which camera is currently main display
        self.frames = {}  # Store latest frames from each camera
        self.capture_threads = {}
        self.running = False
        
        # Display settings
        self.main_width = 800
        self.main_height = 600
        self.sub_width = 200
        self.sub_height = 150
        self.window_width = 800
        self.window_height = 800
        
        # Create placeholder frames
        self.create_placeholder_frames()
        
    def create_placeholder_frames(self):
        """Create placeholder frames for inactive cameras"""
        # Main placeholder (black with text)
        main_placeholder = np.zeros((self.main_height, self.main_width, 3), dtype=np.uint8)
        cv2.putText(main_placeholder, "No Signal", 
                   (self.main_width//2-80, self.main_height//2), 
                   cv2.FONT_HERSHEY_SIMPLEX, 2, (128, 128, 128), 2)
        self.main_placeholder = main_placeholder
        
        # Sub placeholder (black with text)
        sub_placeholder = np.zeros((self.sub_height, self.sub_width, 3), dtype=np.uint8)
        cv2.putText(sub_placeholder, "No Signal", 
                   (20, self.sub_height//2), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (128, 128, 128), 1)
        self.sub_placeholder = sub_placeholder
        
        # Disabled camera placeholder
        disabled_placeholder = np.zeros((self.sub_height, self.sub_width, 3), dtype=np.uint8)
        cv2.putText(disabled_placeholder, "DISABLED", 
                   (30, self.sub_height//2-10), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.4, (64, 64, 64), 1)
        cv2.putText(disabled_placeholder, "Camera 3", 
                   (40, self.sub_height//2+10), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.4, (64, 64, 64), 1)
        self.disabled_placeholder = disabled_placeholder
        
    def create_gstreamer_pipeline(self, camera_id: int) -> str:
        """Create GStreamer pipeline for receiving RTP stream"""
        port = self.streams[camera_id]["port"]
        pipeline = (
            f"udpsrc port={port} ! "
            "application/x-rtp,clock-rate=90000,payload=96 ! "
            "queue max-size-buffers=10 leaky=downstream ! "
            "rtph264depay ! h264parse ! avdec_h264 ! "
            "videoconvert ! appsink drop=true max-buffers=2"
        )
        return pipeline
        
    def capture_stream(self, camera_id: int):
        """Capture frames from a specific camera stream"""
        if not self.streams[camera_id]["active"]:
            return
            
        pipeline = self.create_gstreamer_pipeline(camera_id)
        cap = cv2.VideoCapture(pipeline, cv2.CAP_GSTREAMER)
        
        if not cap.isOpened():
            print(f"Warning: Could not open stream for Camera {camera_id}")
            return
            
        print(f"Started capture thread for Camera {camera_id}")
        
        while self.running:
            ret, frame = cap.read()
            if ret:
                self.frames[camera_id] = frame.copy()
            else:
                # If we lose the stream, wait a bit and try to reconnect
                time.sleep(0.1)
                
        cap.release()
        print(f"Stopped capture thread for Camera {camera_id}")
        
    def start_capture_threads(self):
        """Start capture threads for all active cameras"""
        self.running = True
        for camera_id, stream_info in self.streams.items():
            if stream_info["active"]:
                thread = threading.Thread(target=self.capture_stream, args=(camera_id,))
                thread.daemon = True
                thread.start()
                self.capture_threads[camera_id] = thread
                
    def stop_capture_threads(self):
        """Stop all capture threads"""
        self.running = False
        for thread in self.capture_threads.values():
            thread.join(timeout=1.0)
            
    def get_frame(self, camera_id: int, is_main: bool = False) -> np.ndarray:
        """Get the latest frame from a camera, resized appropriately"""
        if camera_id in self.frames:
            frame = self.frames[camera_id].copy()
            if is_main:
                frame = cv2.resize(frame, (self.main_width, self.main_height))
                # Add main camera label
                cv2.putText(frame, f"{self.streams[camera_id]['name']} (MAIN) - S/N {self.streams[camera_id]['serial']}", 
                           (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
            else:
                frame = cv2.resize(frame, (self.sub_width, self.sub_height))
                # Add sub camera label
                cv2.putText(frame, f"Cam {camera_id} - S/N {self.streams[camera_id]['serial']}", 
                           (5, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 0), 1)
            return frame
        else:
            # Return placeholder if no frame available
            if not self.streams[camera_id]["active"]:
                return self.disabled_placeholder.copy()
            elif is_main:
                placeholder = self.main_placeholder.copy()
                cv2.putText(placeholder, f"{self.streams[camera_id]['name']} - Connecting...", 
                           (150, self.main_height//2 + 50), 
                           cv2.FONT_HERSHEY_SIMPLEX, 1, (128, 128, 128), 2)
                return placeholder
            else:
                placeholder = self.sub_placeholder.copy()
                cv2.putText(placeholder, f"Cam {camera_id}", 
                           (60, self.sub_height//2 - 20), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.4, (128, 128, 128), 1)
                cv2.putText(placeholder, "Connecting...", 
                           (40, self.sub_height//2 + 10), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.3, (128, 128, 128), 1)
                return placeholder
                
    def create_display_frame(self) -> np.ndarray:
        """Create the unified display frame"""
        # Create main canvas
        display = np.zeros((self.window_height, self.window_width, 3), dtype=np.uint8)
        
        # Get main camera frame
        main_frame = self.get_frame(self.main_camera, is_main=True)
        display[0:self.main_height, 0:self.main_width] = main_frame
        
        # Get sub camera frames
        sub_y = self.main_height
        for i, camera_id in enumerate([0, 1, 2, 3]):
            if camera_id != self.main_camera:  # Don't show main camera in sub-displays
                sub_frame = self.get_frame(camera_id, is_main=False)
                x_pos = i * self.sub_width
                if x_pos + self.sub_width <= self.window_width:
                    display[sub_y:sub_y+self.sub_height, x_pos:x_pos+self.sub_width] = sub_frame
                    
                    # Add click indicator border if this is a clickable sub-display
                    if self.streams[camera_id]["active"]:
                        cv2.rectangle(display, (x_pos, sub_y), 
                                    (x_pos+self.sub_width-1, sub_y+self.sub_height-1), 
                                    (0, 255, 255), 1)
                        
        # Add instructions at bottom
        instructions_y = self.main_height + self.sub_height + 10
        if instructions_y < self.window_height - 60:
            cv2.putText(display, "Click on sub-displays to switch main camera", 
                       (10, instructions_y), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            cv2.putText(display, "Press 'q' to quit, '1'/'2'/'3' to switch cameras", 
                       (10, instructions_y + 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            cv2.putText(display, f"Main: Camera {self.main_camera} | Receiving from {self.jetson_ip}", 
                       (10, instructions_y + 40), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (128, 255, 128), 1)
                       
        return display
        
    def handle_mouse_click(self, event, x, y, flags, param):
        """Handle mouse clicks on sub-displays"""
        if event == cv2.EVENT_LBUTTONDOWN:
            # Check if click is in sub-display area
            if y >= self.main_height and y < self.main_height + self.sub_height:
                clicked_sub = x // self.sub_width
                
                # Map clicked sub-display to camera ID
                sub_cameras = [i for i in [0, 1, 2, 3] if i != self.main_camera and self.streams[i]["active"]]
                if clicked_sub < len(sub_cameras):
                    new_main = sub_cameras[clicked_sub]
                    print(f"Switching main display to Camera {new_main}")
                    self.main_camera = new_main
                    
    def run(self):
        """Main display loop"""
        print("Starting ZED Unified Display Application...")
        print(f"Connecting to Jetson at {self.jetson_ip}")
        print("Active cameras:", [f"Camera {i}" for i, info in self.streams.items() if info["active"]])
        print()
        
        # Start capture threads
        self.start_capture_threads()
        
        # Create display window
        cv2.namedWindow("ZED Multi-Camera Display", cv2.WINDOW_AUTOSIZE)
        cv2.setMouseCallback("ZED Multi-Camera Display", self.handle_mouse_click)
        
        print("Display started! Controls:")
        print("- Click on sub-displays to switch main camera")
        print("- Press '1', '2', '3' to switch to specific cameras")
        print("- Press 'q' or ESC to quit")
        print()
        
        try:
            while True:
                # Create and show display frame
                display_frame = self.create_display_frame()
                cv2.imshow("ZED Multi-Camera Display", display_frame)
                
                # Handle keyboard input
                key = cv2.waitKey(1) & 0xFF
                if key == ord('q') or key == 27:  # 'q' or ESC
                    break
                elif key == ord('1') and self.streams[0]["active"]:
                    self.main_camera = 0
                    print("Switched main display to Camera 0")
                elif key == ord('2') and self.streams[1]["active"]:
                    self.main_camera = 1
                    print("Switched main display to Camera 1")
                elif key == ord('3') and self.streams[2]["active"]:
                    self.main_camera = 2
                    print("Switched main display to Camera 2")
                    
        except KeyboardInterrupt:
            print("\nReceived interrupt signal...")
            
        finally:
            print("Shutting down...")
            self.stop_capture_threads()
            cv2.destroyAllWindows()
            print("Display stopped.")

def main():
    parser = argparse.ArgumentParser(description="ZED Camera Unified Display")
    parser.add_argument("--jetson-ip", default="192.168.1.254", 
                       help="IP address of the Jetson device (default: 192.168.1.254)")
    args = parser.parse_args()
    
    try:
        app = ZEDStreamReceiver(jetson_ip=args.jetson_ip)
        app.run()
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

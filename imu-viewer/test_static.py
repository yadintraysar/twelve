#!/usr/bin/env python3
"""
Test script to demonstrate the IMU viewer with static data.
This should show the "Still" state since the data represents no movement.
"""

import subprocess
import time
import sys
import os

def test_static_data():
    print("Testing IMU Viewer with static data...")
    print("This test uses your provided static ZED data sample.")
    print()
    
    # Start the server in background
    print("1. Starting server...")
    server_process = subprocess.Popen(
        [sys.executable, 'simple_server.py'],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    # Give server time to start
    time.sleep(2)
    
    print("2. Server started. Open http://localhost:8081 in your browser")
    print("3. Feeding static IMU data...")
    print()
    
    # Read test data
    with open('test_data.txt', 'r') as f:
        test_data = f.read()
    
    # Send data to server
    try:
        server_process.stdin.write(test_data)
        server_process.stdin.flush()
        
        print("✓ Static data sent to server")
        print("✓ Expected result: State should remain 'Still'")
        print("✓ Roll/Pitch should be near 0° due to deadband filtering")
        print("✓ The 3D cube should look steady (not shaking)")
        print()
        print("Press Ctrl+C to stop the test...")
        
        # Keep server running
        server_process.wait()
        
    except KeyboardInterrupt:
        print("\nStopping test...")
        server_process.terminate()
        server_process.wait()
        print("✓ Test completed")

if __name__ == '__main__':
    if not os.path.exists('test_data.txt'):
        print("Error: test_data.txt not found")
        print("Make sure you're running this from the imu-viewer directory")
        sys.exit(1)
    
    test_static_data()


# Heavy-Duty IMU Viewer

A localhost web application for visualizing IMU orientation data from construction equipment. Designed to ignore vibration and only show real tilt movements.

## Quick Start

1. **Install dependencies:**
   ```bash
   cd /home/nvidia/Desktop/imu-viewer
   pip3 install websockets
   ```

2. **Start the server:**
   ```bash
   python3 simple_server.py
   ```

3. **Open the viewer:**
   Navigate to `http://localhost:6081` in your browser

4. **Pipe IMU data from your ZED system:**
   ```bash
   # From your ZED Live Global Localization output:
   ./start_traysar_master.sh | grep "IMU:" | python3 simple_server.py
   
   # Or if you have a data file:
   cat imu_data.txt | python3 simple_server.py
   
   # Or stream live data:
   tail -f /path/to/zed/output.log | grep "IMU:" | python3 simple_server.py
   ```

## Features

- **Heavy-duty noise filtering** - ignores construction equipment vibration
- **3D orientation visualization** - real-time cube showing device tilt
- **State detection** - Still / Tilting / Aggressive Tilt with high thresholds
- **Auto-calibration** - automatically zeros when device is stable
- **Manual re-zero** - recalibrate when equipment is known to be level
- **Advanced settings** - adjust thresholds and filtering parameters

## State Logic

- **Still**: Default state, tilt magnitude < 8° and gyro RMS < 12°/s
- **Tilting**: Tilt magnitude ≥ 8° for ≥ 500ms OR gyro RMS ≥ 12°/s for ≥ 400ms  
- **Aggressive**: Tilt magnitude ≥ 15° for ≥ 300ms OR gyro RMS ≥ 20°/s for ≥ 250ms

High thresholds and dwell times prevent false triggers from equipment shake.

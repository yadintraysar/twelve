import argparse
import time

import pyzed.sl as sl


class TimestampTracker:
    def __init__(self):
        self.imu_us = 0
        self.mag_us = 0
        self.baro_us = 0

    def is_new_imu(self, imu_data: sl.IMUData) -> bool:
        ts = imu_data.timestamp.get_microseconds()
        if ts > self.imu_us:
            self.imu_us = ts
            return True
        return False

    def is_new_mag(self, mag_data: sl.MagnetometerData) -> bool:
        ts = mag_data.timestamp.get_microseconds()
        if ts > self.mag_us:
            self.mag_us = ts
            return True
        return False

    def is_new_baro(self, baro_data: sl.BarometerData) -> bool:
        ts = baro_data.timestamp.get_microseconds()
        if ts > self.baro_us:
            self.baro_us = ts
            return True
        return False


def print_available_sensors(info: sl.CameraInformation) -> None:
    cfg = info.sensors_configuration
    print("\nAvailable sensors:")
    if cfg.accelerometer_parameters.is_available or cfg.gyroscope_parameters.is_available:
        print(" - IMU: accelerometer={}, gyroscope={}".format(
            cfg.accelerometer_parameters.is_available, cfg.gyroscope_parameters.is_available
        ))
    if hasattr(cfg, "magnetometer_parameters"):
        print(" - Magnetometer:", cfg.magnetometer_parameters.is_available)
    if hasattr(cfg, "barometer_parameters"):
        print(" - Barometer:", cfg.barometer_parameters.is_available)


def main():
    parser = argparse.ArgumentParser(description="Print sensor readings from a ZED camera (optimized for ZED X Mini)")
    parser.add_argument("--camera-id", type=int, default=0, help="Camera ID to open (default: 0)")
    parser.add_argument("--duration", type=float, default=5.0, help="Duration to read sensors in seconds (default: 5.0)")
    parser.add_argument("--rate-hz", type=float, default=50.0, help="Print loop max rate in Hz (default: 50)")
    args = parser.parse_args()

    zed = sl.Camera()

    init_params = sl.InitParameters()
    init_params.depth_mode = sl.DEPTH_MODE.NONE
    try:
        # Select specific camera by ID (works for USB and GMSL setups)
        init_params.input.set_from_camera_id(args.camera_id)
    except Exception:
        # Older SDKs may not expose set_from_camera_id on Python; ignore if not present
        pass

    err = zed.open(init_params)
    if err != sl.ERROR_CODE.SUCCESS:
        print("Failed to open camera {}: {}".format(args.camera_id, repr(err)))
        zed.close()
        return 1

    info = zed.get_camera_information()
    print("Camera Model:", info.camera_model)
    print("Serial Number:", info.serial_number)
    print("Camera FW:", info.camera_configuration.firmware_version)
    print("Sensors FW:", info.sensors_configuration.firmware_version)
    print_available_sensors(info)

    sensors = sl.SensorsData()
    ts = TimestampTracker()

    t_end = time.time() + args.duration
    sleep_dt = 1.0 / max(1.0, args.rate_hz)

    # Note: Sensors run in a separate capture thread; no need to call grab()
    while time.time() < t_end:
        if zed.get_sensors_data(sensors, sl.TIME_REFERENCE.CURRENT) == sl.ERROR_CODE.SUCCESS:
            # IMU (always present on ZED X Mini)
            imu = sensors.get_imu_data()
            if ts.is_new_imu(imu):
                q = imu.get_pose().get_orientation().get()
                acc = imu.get_linear_acceleration()
                gyro = imu.get_angular_velocity()
                print("IMU:")
                print("  Orientation (Ox, Oy, Oz, Ow): [{:.6f}, {:.6f}, {:.6f}, {:.6f}]".format(q[0], q[1], q[2], q[3]))
                print("  Acceleration [m/s^2]: [{:.4f}, {:.4f}, {:.4f}]".format(acc[0], acc[1], acc[2]))
                print("  Angular velocity [deg/s]: [{:.4f}, {:.4f}, {:.4f}]".format(gyro[0], gyro[1], gyro[2]))

                # Magnetometer (not present on ZED X Mini; printed only if available)
                if hasattr(info.sensors_configuration, "magnetometer_parameters") and info.sensors_configuration.magnetometer_parameters.is_available:
                    mag = sensors.get_magnetometer_data()
                    if ts.is_new_mag(mag):
                        mf = mag.get_magnetic_field_calibrated()
                        print("Magnetometer:")
                        print("  Magnetic field [uT]: [{:.4f}, {:.4f}, {:.4f}]".format(mf[0], mf[1], mf[2]))

                # Barometer (not present on ZED X Mini; printed only if available)
                if hasattr(info.sensors_configuration, "barometer_parameters") and info.sensors_configuration.barometer_parameters.is_available:
                    baro = sensors.get_barometer_data()
                    if ts.is_new_baro(baro):
                        print("Barometer:")
                        print("  Atmospheric pressure [hPa]: {:.3f}".format(baro.pressure))

        time.sleep(sleep_dt)

    zed.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())



///////////////////////////////////////////////////////////////////////////
//
// Copyright (c) 2025, STEREOLABS.
//
// All rights reserved.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//
///////////////////////////////////////////////////////////////////////////

/***************************************************************************
 ** This sample shows how to use global localization on real-world map    **
 ** with ZED camera                                                       **
 **************************************************************************/

#include <sl/Camera.hpp>
#include <sl/Fusion.hpp>
#include <chrono>
#include <iomanip>
#include <iostream>
#include <gst/gst.h>
#include <gst/app/gstappsrc.h>
#include <cstring>

#include "display/GenericDisplay.h"
#include "gnss_reader/IGNSSReader.h"
#include "gnss_reader/GPSDReader.hpp"

int main(int argc, char **argv)
{
    // Parse command line arguments
    bool stream_imu = false;
    for (int i = 1; i < argc; i++) {
        if (std::string(argv[i]) == "--stream-imu") {
            stream_imu = true;
        }
    }
    
    // Initialize GStreamer (for optional in-process streaming)
    gst_init(&argc, &argv);

    // Open the camera
    sl::Camera zed;
    sl::InitParameters init_params;
    init_params.camera_resolution = sl::RESOLUTION::HD1080;
    init_params.camera_fps = 30;
    init_params.input.setFromCameraID(0);  // Use camera ID 0
    init_params.sdk_verbose = 1;
    sl::ERROR_CODE camera_open_error = zed.open(init_params);
    if (camera_open_error != sl::ERROR_CODE::SUCCESS)
    {
        std::cerr << "[ZED][ERROR] Can't open ZED camera" << std::endl;
        return EXIT_FAILURE;
    }
    // Enable positional tracking:
    auto positional_init = zed.enablePositionalTracking();
    if (positional_init != sl::ERROR_CODE::SUCCESS)
    {
        std::cerr << "[ZED][ERROR] Can't start tracking of camera" << std::endl;
        return EXIT_FAILURE;
    }
    // Create Fusion object:
    sl::Fusion fusion;
    sl::InitFusionParameters init_fusion_param;
    init_fusion_param.coordinate_units = sl::UNIT::METER;
    sl::FUSION_ERROR_CODE fusion_init_code = fusion.init(init_fusion_param);
    if (fusion_init_code != sl::FUSION_ERROR_CODE::SUCCESS)
    {
        std::cerr << "[Fusion][ERROR] Failed to initialize fusion, error: " << fusion_init_code << std::endl;
        return EXIT_FAILURE;
    }

    // Enable odometry publishing:
    zed.startPublishing();
    
    // Set hardcoded initial position (New York City - Central Park area)
    double latitude = 40.7672618;
    double longitude = -73.9844867;
    double altitude = 50.0; // Approximate altitude in meters
    
    std::cout << "Using hardcoded initial position: " << latitude 
              << ", " << longitude << std::endl;

    // Subscribe to Odometry
    auto cam_info = zed.getCameraInformation();
    sl::CameraIdentifier uuid(cam_info.serial_number);
    fusion.subscribe(uuid);
    // Enable positional tracking for Fusion object (with GNSS)
    sl::PositionalTrackingFusionParameters positional_tracking_fusion_parameters;
    positional_tracking_fusion_parameters.enable_GNSS_fusion = true;
    sl::FUSION_ERROR_CODE tracking_error_code = fusion.enablePositionalTracking(positional_tracking_fusion_parameters);
    if(tracking_error_code != sl::FUSION_ERROR_CODE::SUCCESS){
        std::cout << "[Fusion][ERROR] Could not start tracking, error: " << tracking_error_code << std::endl;
        return EXIT_FAILURE;
    }


    // Report available sensors once
    const auto &sensor_cfg = cam_info.sensors_configuration;
    std::cout << "Sensors available:" << std::endl;
    std::cout << "  IMU (accel=" << sensor_cfg.accelerometer_parameters.isAvailable
              << ", gyro=" << sensor_cfg.gyroscope_parameters.isAvailable << ")" << std::endl;
    std::cout << "  Magnetometer=" << sensor_cfg.magnetometer_parameters.isAvailable << std::endl;
    std::cout << "  Barometer=" << sensor_cfg.barometer_parameters.isAvailable << std::endl;

    // Setup viewer:
    GenericDisplay viewer;
    viewer.init(argc, argv);
    std::cout << "Start grabbing data... Global localization running with hardcoded initial position" << std::endl;
    
    // In-process GStreamer streaming setup (LEFT image)
    const char* host_env = std::getenv("CAM_STREAM_HOST");
    const char* port_env = std::getenv("CAM_STREAM_PORT");
    const char* enc_env  = std::getenv("CAM_STREAM_ENCODER"); // "x264" or "nv"
    std::string host = host_env ? host_env : "192.168.1.39";
    int stream_port = port_env ? std::atoi(port_env) : 5001;
    std::string encoder = enc_env ? enc_env : "nv";

    GstElement* pipeline = nullptr;
    GstElement* appsrc = nullptr;
    GstClockTime pts = 0;
    // Use actual camera resolution (HD1080 = 1920x1080)
    const int stream_width = 1920;
    const int stream_height = 1080;
    const int stream_fps = 30;

    auto build_pipeline = [&](const std::string& enc) -> std::string {
        std::ostringstream ss;
        ss << "appsrc name=mysrc is-live=true format=time do-timestamp=true ";
        ss << "caps=\"video/x-raw,format=RGBA,width=" << stream_width << ",height=" << stream_height << ",framerate=" << stream_fps << "/1\" ";
        ss << "! queue max-size-buffers=4 leaky=downstream ";
        if (enc == "x264") {
            ss << "! videoconvert ! x264enc byte-stream=true tune=zerolatency speed-preset=ultrafast bitrate=2000 ";
        } else {
            ss << "! nvvidconv ! video/x-raw(memory:NVMM),format=NV12 ";
            ss << "! nvv4l2h264enc insert-sps-pps=true idrinterval=30 iframeinterval=30 bitrate=4000000 preset-level=1 maxperf-enable=1 ";
        }
        ss << "! h264parse config-interval=-1 ! rtph264pay pt=96 ";
        ss << "! udpsink host=" << host << " port=" << stream_port << " sync=false async=false";
        return ss.str();
    };

    std::string pipe_str = build_pipeline(encoder);
    GError* gst_err = nullptr;
    pipeline = gst_parse_launch(pipe_str.c_str(), &gst_err);
    if (!pipeline || gst_err) {
        if (gst_err) g_error_free(gst_err);
        // Fallback to x264 if NV encoder fails
        pipe_str = build_pipeline("x264");
        pipeline = gst_parse_launch(pipe_str.c_str(), nullptr);
    }
    if (pipeline) {
        appsrc = gst_bin_get_by_name(GST_BIN(pipeline), "mysrc");
        gst_element_set_state(pipeline, GST_STATE_PLAYING);
    }

    bool initial_position_set = false;
    // Sensors state
    sl::SensorsData sensors_data;
    sl::Timestamp last_imu_ts = 0;
    sl::Timestamp last_mag_ts = 0;
    sl::Timestamp last_baro_ts = 0;
    
    while (viewer.isAvailable())
    {
        // Grab camera:
        if (zed.grab() == sl::ERROR_CODE::SUCCESS)
        {
            sl::Pose zed_pose;
            // You can still use the classical getPosition for your application, just not that the position returned by this method
            // is the position without any GNSS/cameras fusion
            zed.getPosition(zed_pose, sl::REFERENCE_FRAME::CAMERA);

            // Fetch left image and push to viewer as overlay
            static sl::Mat left_rgba;
            sl::RuntimeParameters rt_params;
            zed.retrieveImage(left_rgba, sl::VIEW::LEFT, sl::MEM::CPU);
            viewer.updateCameraImage(left_rgba);

            // Push to GStreamer appsrc if enabled
            if (appsrc) {
                const size_t frame_size = static_cast<size_t>(left_rgba.getWidth()) * static_cast<size_t>(left_rgba.getHeight()) * 4;
                if (left_rgba.getWidth() > 0 && left_rgba.getHeight() > 0) {
                    GstBuffer* buffer = gst_buffer_new_allocate(nullptr, frame_size, nullptr);
                    GstMapInfo map;
                    gst_buffer_map(buffer, &map, GST_MAP_WRITE);
                    std::memcpy(map.data, left_rgba.getPtr<sl::uchar1>(), frame_size);
                    gst_buffer_unmap(buffer, &map);
                    GST_BUFFER_PTS(buffer) = pts;
                    GST_BUFFER_DTS(buffer) = pts;
                    GST_BUFFER_DURATION(buffer) = gst_util_uint64_scale_int(1, GST_SECOND, stream_fps);
                    pts += GST_BUFFER_DURATION(buffer);
                    gst_app_src_push_buffer(GST_APP_SRC(appsrc), buffer);
                }
            }
            
            // Set initial GNSS position using camera timestamp on first frame
            if (!initial_position_set) {
                sl::GNSSData initial_gnss;
                initial_gnss.setCoordinates(latitude, longitude, altitude, false);
                initial_gnss.longitude_std = initial_gnss.latitude_std = 0.001f;
                initial_gnss.altitude_std = 1.0f;
                initial_gnss.ts = zed_pose.timestamp; // Use ZED camera timestamp
                
                viewer.updateRawGeoPoseData(initial_gnss);
                
                auto ingest_error = fusion.ingestGNSSData(initial_gnss);
                if(ingest_error == sl::FUSION_ERROR_CODE::SUCCESS){
                    std::cout << "✅ Successfully ingested initial GNSS position" << std::endl;
                    initial_position_set = true;
                }
                // Suppress GNSS errors since we're using hardcoded coordinates
            }
        }
        // Print sensors data when new samples are available
        if (zed.getSensorsData(sensors_data, sl::TIME_REFERENCE::CURRENT) == sl::ERROR_CODE::SUCCESS)
        {
            if (sensors_data.imu.timestamp > last_imu_ts)
            {
                last_imu_ts = sensors_data.imu.timestamp;
                const auto &imu = sensors_data.imu;
                const auto &quat = imu.pose.getOrientation();
                
                if (stream_imu) {
                    // Format for imu-viewer server (exact format expected)
                    std::cout << "IMU:" << std::endl;
                    std::cout << "  Orientation (Ox, Oy, Oz, Ow): [" 
                              << std::fixed << std::setprecision(6) 
                              << quat.x << ", " << quat.y << ", " << quat.z << ", " << quat.w << "]" << std::endl;
                    std::cout << "  Acceleration [m/s^2]: [" 
                              << std::fixed << std::setprecision(4)
                              << imu.linear_acceleration.x << ", " 
                              << imu.linear_acceleration.y << ", " 
                              << imu.linear_acceleration.z << "]" << std::endl;
                    std::cout << "  Angular velocity [deg/s]: [" 
                              << std::fixed << std::setprecision(4)
                              << imu.angular_velocity.x << ", " 
                              << imu.angular_velocity.y << ", " 
                              << imu.angular_velocity.z << "]" << std::endl;
                    std::cout.flush(); // Ensure immediate output for piping
                } else {
                    // Original debug format
                    std::cout << "IMU:" << std::endl;
                    std::cout << "  Orientation: {" << quat << "}" << std::endl;
                    std::cout << "  Acceleration: {" << imu.linear_acceleration << "} [m/s^2]" << std::endl;
                    std::cout << "  Angular Velocity: {" << imu.angular_velocity << "} [deg/s]" << std::endl;

                    if (sensor_cfg.magnetometer_parameters.isAvailable && sensors_data.magnetometer.timestamp > last_mag_ts)
                    {
                        last_mag_ts = sensors_data.magnetometer.timestamp;
                        std::cout << "Magnetometer:\n  Magnetic Field: {" << sensors_data.magnetometer.magnetic_field_calibrated << "} [uT]" << std::endl;
                    }
                    if (sensor_cfg.barometer_parameters.isAvailable && sensors_data.barometer.timestamp > last_baro_ts)
                    {
                        last_baro_ts = sensors_data.barometer.timestamp;
                        std::cout << "Barometer:\n  Atmospheric pressure: " << sensors_data.barometer.pressure << " [hPa]" << std::endl;
                    }
                }
            }
        }
        
        // No GNSS data grabbing - we use hardcoded position
        // Process data and compute positions:
        if (fusion.process() == sl::FUSION_ERROR_CODE::SUCCESS)
        {
            sl::Pose fused_position;
            // Get position into the ZED CAMERA coordinate system:
            sl::POSITIONAL_TRACKING_STATE current_state = fusion.getPosition(fused_position);

            sl::FusedPositionalTrackingStatus fused_status = fusion.getFusedPositionalTrackingStatus();
         
            // Display it on OpenGL:
            viewer.updatePoseData(fused_position.pose_data, fused_status);
            
            // Get position into the GNSS coordinate system - this needs a initialization between CAMERA 
            // and GNSS. When the initialization is finish the getGeoPose will return sl::POSITIONAL_TRACKING_STATE::OK
            sl::GeoPose current_geopose;
            auto current_geopose_satus = fusion.getGeoPose(current_geopose);
            if (current_geopose_satus == sl::GNSS_FUSION_STATUS::OK)
            {
                // Display it on the Live Server:
                viewer.updateGeoPoseData(current_geopose);
            }
            else
            {
                // GNSS coordinate system to ZED coordinate system is not initialize yet
                // The initialization between the coordinates system is an optimization problem that
                // Try to fit the ZED computed path with the GNSS computed path. In order to do it just move
                // your system by the distance you specified in positional_tracking_fusion_parameters.gnss_initialisation_distance
            }
        }
    }
    if (appsrc) {
        gst_app_src_end_of_stream(GST_APP_SRC(appsrc));
    }
    if (pipeline) {
        gst_element_set_state(pipeline, GST_STATE_NULL);
        gst_object_unref(pipeline);
    }
    fusion.close();
    zed.close();

    return EXIT_SUCCESS;
}

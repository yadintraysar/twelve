#!/usr/bin/env python3
"""
ZED -> GStreamer appsrc -> H.264 RTP sender (Jetson)

Grabs RGBA frames from the ZED SDK and pushes them into a GStreamer pipeline
built around appsrc, nvvidconv, nvv4l2h264enc, and udpsink.

Usage example:
  python3 zed_appsrc_sender.py --host 192.168.1.23 --port 5001 --fps 30 --resolution HD720

Notes:
- macOS cannot run the ZED SDK natively, so this runs on the Jetson and streams
  H.264 to your Mac, which can receive with plain GStreamer.
- To extend for depth/pose later, add additional streams or a side channel.
"""

import argparse
import sys
import signal
import time
import threading
import json

try:
    import pyzed.sl as sl
except Exception as exc:  # pragma: no cover
    print("Error: pyzed (ZED SDK Python) not found. Ensure ZED SDK + Python bindings are installed.")
    print(str(exc))
    sys.exit(1)

try:
    import gi
    gi.require_version("Gst", "1.0")
    gi.require_version("GObject", "2.0")
    from gi.repository import Gst, GLib
except Exception as exc:  # pragma: no cover
    print("Error: GStreamer Python bindings not found. Install python3-gi and gst packages.")
    print(str(exc))
    sys.exit(1)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="ZED to RTP(H.264) sender using appsrc on Jetson")
    parser.add_argument("--host", required=True, help="Receiver IP (your Mac's IP)")
    parser.add_argument("--port", type=int, default=5001, help="UDP port on receiver")
    parser.add_argument("--fps", type=int, default=30, help="Capture framerate")
    parser.add_argument(
        "--resolution",
        choices=["VGA", "HD720", "HD1080", "HD2K"],
        default="HD720",
        help="ZED sensor resolution preset",
    )
    parser.add_argument("--serial", type=int, default=0, help="Optional camera serial to open (0 = default)")
    parser.add_argument("--bitrate", type=int, default=4000000, help="Encoder bitrate (bps)")
    parser.add_argument("--http-port", type=int, default=8000, help="HTTP port to expose pose JSON/UI")
    return parser.parse_args()


def resolution_choice_to_enum(choice: str) -> sl.RESOLUTION:
    if choice == "VGA":
        return sl.RESOLUTION.VGA
    if choice == "HD720":
        return sl.RESOLUTION.HD720
    if choice == "HD1080":
        return sl.RESOLUTION.HD1080
    if choice == "HD2K":
        return sl.RESOLUTION.HD2K
    return sl.RESOLUTION.HD720


def build_pipeline(host: str, port: int, width: int, height: int, fps: int, bitrate: int) -> Gst.Pipeline:
    # We push RGBA from CPU into appsrc; nvvidconv converts to NV12 in NVMM; nvv4l2h264enc encodes; RTP payload; UDP send
    pipeline_str = (
        f"appsrc name=src is-live=true format=time do-timestamp=true "
        f"caps=\"video/x-raw,format=RGBA,width={width},height={height},framerate={fps}/1\" "
        f"! queue max-size-buffers=4 leaky=downstream "
        f"! nvvidconv ! video/x-raw(memory:NVMM),format=NV12 "
        f"! nvv4l2h264enc insert-sps-pps=true iframeinterval={fps} idrinterval={fps} bitrate={bitrate} preset-level=1 "
        f"! h264parse config-interval=-1 "
        f"! rtph264pay pt=96 "
        f"! udpsink host={host} port={port} sync=false async=false"
    )

    pipeline = Gst.parse_launch(pipeline_str)
    if not isinstance(pipeline, Gst.Pipeline):
        raise RuntimeError("Failed to create GStreamer pipeline")
    return pipeline


def main() -> int:
    args = parse_args()

    Gst.init(None)
    stop_requested = False

    def handle_sigint(signum, frame):
        nonlocal stop_requested
        stop_requested = True

    signal.signal(signal.SIGINT, handle_sigint)
    signal.signal(signal.SIGTERM, handle_sigint)

    # ZED initialization with resolution fallback
    requested_res = resolution_choice_to_enum(args.resolution)
    fallback_order = [requested_res, sl.RESOLUTION.HD720, sl.RESOLUTION.HD1080, sl.RESOLUTION.VGA, sl.RESOLUTION.HD2K]
    tried = set()

    cam = sl.Camera()
    last_status = None
    opened = False
    for res in fallback_order:
        if res in tried:
            continue
        tried.add(res)
        init_params = sl.InitParameters()
        init_params.camera_resolution = res
        init_params.camera_fps = args.fps
        init_params.depth_mode = sl.DEPTH_MODE.NONE  # video-only for now; can enable later
        init_params.coordinate_units = sl.UNIT.METER
        if args.serial:
            init_params.set_from_serial_number(args.serial)

        status = cam.open(init_params)
        last_status = status
        if status == sl.ERROR_CODE.SUCCESS:
            # Enable positional tracking (no area memory file for now)
            try:
                tracking_params = sl.PositionalTrackingParameters()
                cam.enable_positional_tracking(tracking_params)
            except Exception as e:
                print(f"Warning: failed to enable positional tracking: {e}")
            opened = True
            break
        # If resolution invalid, try again with a safer fps as well
        if status == sl.ERROR_CODE.INVALID_RESOLUTION and args.fps > 15:
            init_params.camera_fps = 15
            status = cam.open(init_params)
            last_status = status
            if status == sl.ERROR_CODE.SUCCESS:
                try:
                    tracking_params = sl.PositionalTrackingParameters()
                    cam.enable_positional_tracking(tracking_params)
                except Exception as e:
                    print(f"Warning: failed to enable positional tracking: {e}")
                opened = True
                break

    if not opened:
        print(f"Failed to open ZED: {repr(last_status)}")
        return 2

    cam_info = cam.get_camera_information()
    try:
        # SDK >= 4.x/5.x: resolution is under camera_configuration
        res_obj = cam_info.camera_configuration.resolution
        width = res_obj.width
        height = res_obj.height
    except Exception:
        # Fallback for older SDKs (if any)
        width = 1280
        height = 720
    fps = args.fps

    pipeline = build_pipeline(args.host, args.port, width, height, fps, args.bitrate)
    appsrc = pipeline.get_by_name("src")
    if appsrc is None:
        print("Failed to get appsrc element")
        cam.close()
        return 3

    # Pre-allocate buffers/holders
    img = sl.Mat()
    runtime_params = sl.RuntimeParameters()
    pose = sl.Pose()

    # Shared pose state for HTTP server
    latest_pose = {"timestamp_ns": 0, "translation_m": [0.0, 0.0, 0.0], "orientation_xyzw": [0.0, 0.0, 0.0, 1.0], "status": "UNKNOWN"}
    pose_lock = threading.Lock()

    # HTTP server to expose pose and a minimal overlay page
    from http.server import BaseHTTPRequestHandler, HTTPServer

    def run_http_server():
        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                if self.path == "/pose.json":
                    with pose_lock:
                        body = json.dumps(latest_pose).encode("utf-8")
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                else:
                    # Minimal overlay page polling pose
                    html = (
                        "<!doctype html><html><head><meta charset='utf-8'><title>ZED Pose</title>"
                        "<style>body{font-family:sans-serif;margin:16px}pre{background:#f4f4f4;padding:12px;border-radius:6px}</style>"
                        "</head><body><h2>ZED Pose (HTTP :8000)</h2>"
                        "<div>Polling /pose.json at 5 Hz</div>"
                        "<pre id='out'>waiting...</pre>"
                        "<script>async function tick(){try{const r=await fetch('/pose.json');const j=await r.json();document.getElementById('out').textContent=JSON.stringify(j,null,2);}catch(e){document.getElementById('out').textContent=String(e);}finally{setTimeout(tick,200);} } tick();</script>"
                        "</body></html>"
                    ).encode("utf-8")
                    self.send_response(200)
                    self.send_header("Content-Type", "text/html; charset=utf-8")
                    self.send_header("Content-Length", str(len(html)))
                    self.end_headers()
                    self.wfile.write(html)

            def log_message(self, format, *args):
                return  # quiet

        httpd = HTTPServer(("0.0.0.0", args.http_port), Handler)
        try:
            httpd.serve_forever()
        except Exception:
            pass

    http_thread = threading.Thread(target=run_http_server, daemon=True)
    http_thread.start()

    # Start pipeline
    bus = pipeline.get_bus()
    pipeline.set_state(Gst.State.PLAYING)

    frame_count = 0
    start_time_ns = time.time_ns()
    frame_duration_ns = int(1_000_000_000 // max(1, fps))

    try:
        while not stop_requested:
            if cam.grab(runtime_params) != sl.ERROR_CODE.SUCCESS:
                # Keep looping; could add sleep(0) to yield
                continue

            cam.retrieve_image(img, sl.VIEW.LEFT, sl.MEM.CPU)
            np_img = img.get_data()  # H x W x 4 (RGBA), uint8
            # Ensure C-contiguous bytes
            frame_bytes = memoryview(np_img).tobytes()

            # Update pose (WORLD frame)
            try:
                tracking_state = cam.get_position(pose, sl.REFERENCE_FRAME.WORLD)
                # translation [x,y,z] in meters
                try:
                    t = pose.get_translation().get()
                except Exception:
                    t = [0.0, 0.0, 0.0]
                # orientation quaternion [x,y,z,w]
                try:
                    q = pose.get_orientation().get()
                except Exception:
                    q = [0.0, 0.0, 0.0, 1.0]
                with pose_lock:
                    latest_pose["timestamp_ns"] = time.time_ns()
                    latest_pose["translation_m"] = [float(t[0]), float(t[1]), float(t[2])] if len(t) >= 3 else [0.0, 0.0, 0.0]
                    latest_pose["orientation_xyzw"] = [float(q[0]), float(q[1]), float(q[2]), float(q[3])] if len(q) >= 4 else [0.0, 0.0, 0.0, 1.0]
                    latest_pose["status"] = str(tracking_state)
            except Exception as e:
                # Non-fatal; keep streaming video
                pass

            buf = Gst.Buffer.new_allocate(None, len(frame_bytes), None)
            # Timestamping
            pts = start_time_ns + frame_count * frame_duration_ns
            buf.pts = pts
            buf.dts = pts
            buf.duration = frame_duration_ns
            # Write frame bytes into buffer
            try:
                buf.fill(0, frame_bytes)
            except Exception as e:
                print(f"Warning: failed to fill GstBuffer: {e}; skipping frame")
                continue

            ret = appsrc.emit("push-buffer", buf)
            if ret != Gst.FlowReturn.OK:
                print(f"GStreamer push-buffer returned {ret}; stopping")
                break

            frame_count += 1

            # Poll bus for errors to exit promptly
            msg = bus.timed_pop_filtered(0, Gst.MessageType.ERROR | Gst.MessageType.EOS)
            if msg is not None:
                if msg.type == Gst.MessageType.ERROR:
                    err, dbg = msg.parse_error()
                    print(f"Pipeline error: {err}, debug: {dbg}")
                else:
                    print("Pipeline EOS")
                break
    finally:
        try:
            appsrc.emit("end-of-stream")
        except Exception:
            pass
        pipeline.set_state(Gst.State.NULL)
        cam.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())



"""
stream_server.py — MJPEG stream server with YOLO + ByteTrack person detection
Serves live annotated video feeds for the AirFlow Nexus dashboard.

Key design decisions:
- Each zone gets its OWN YOLO model instance — prevents shared-state corruption
  across threads (which caused the count/box mismatch).
- Uses model.track() + ByteTrack instead of bare detection — assigns a stable ID
  to each person across frames so counts are smooth and accurate even in crowds.
- NMS IoU lowered to 0.45 — allows overlapping boxes to survive in dense crowds
  (default 0.7 merges too aggressively when people stand close together).
- Minimum box area filter — removes tiny spurious detections outside the crowd.

Usage:
    pip install ultralytics flask flask-cors
    python video_analytics/stream_server.py \
        --gate      video_analytics/gate.mp4 \
        --checkin   video_analytics/checkin.mp4 \
        --disembark video_analytics/disembark.mp4

Endpoints:
    GET http://localhost:5001/stream/gate
    GET http://localhost:5001/stream/checkin
    GET http://localhost:5001/stream/disembark
    GET http://localhost:5001/health
"""

import argparse
import threading
import time
from pathlib import Path

import cv2
from flask import Flask, Response, jsonify
from flask_cors import CORS
from ultralytics import YOLO

# ── Config ─────────────────────────────────────────────────────────────────────

MODEL_NAME      = "yolov8n.pt"   # nano — fast on CPU; swap to yolov8s for better accuracy
PERSON_CLASS    = 0
CONFIDENCE      = 0.50           # higher than default → fewer ghost detections
NMS_IOU         = 0.45           # lower than default 0.7 → overlapping crowd boxes survive
MIN_BOX_AREA    = 800            # px² — ignore detections smaller than this (noise)

BOX_COLOR       = (0, 255, 0)    # bright green BGR
BOX_THICKNESS   = 2
FONT            = cv2.FONT_HERSHEY_SIMPLEX
JPEG_QUALITY    = 80
TARGET_FPS      = 12             # cap output FPS — keeps CPU load manageable

# ── Per-zone state ─────────────────────────────────────────────────────────────

videos: dict[str, str] = {}

# Each zone gets its own model (for thread-safe tracking state)
_models: dict[str, YOLO]              = {}
_frames: dict[str, bytes | None]      = {}
_locks:  dict[str, threading.Lock]    = {}


# ── Frame annotation ───────────────────────────────────────────────────────────

def annotate_frame(model: YOLO, frame) -> tuple[bytes, int]:
    """
    Run ByteTrack on frame using this zone's dedicated model.
    Draws a green box + track-ID label on each confirmed person.
    Returns (jpeg_bytes, person_count).
    """
    h, w = frame.shape[:2]

    results = model.track(
        frame,
        classes=[PERSON_CLASS],
        conf=CONFIDENCE,
        iou=NMS_IOU,
        persist=True,          # keep tracker state between frames
        tracker="bytetrack.yaml",
        verbose=False,
    )

    count = 0
    for r in results:
        if r.boxes is None:
            continue
        for box in r.boxes:
            # Filter: must be a person
            if int(box.cls[0]) != PERSON_CLASS:
                continue

            x1, y1, x2, y2 = map(int, box.xyxy[0])

            # Filter: box must be mostly inside the frame
            cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
            if not (0 <= cx <= w and 0 <= cy <= h):
                continue

            # Filter: ignore tiny detections
            area = (x2 - x1) * (y2 - y1)
            if area < MIN_BOX_AREA:
                continue

            # Only count boxes with a confirmed track ID (ByteTrack assigned)
            track_id = int(box.id[0]) if box.id is not None else None
            if track_id is None:
                continue

            count += 1
            conf_val = float(box.conf[0])

            # Draw bounding box
            cv2.rectangle(frame, (x1, y1), (x2, y2), BOX_COLOR, BOX_THICKNESS)

            # Label: "#ID  0.87"
            label = f"#{track_id}  {conf_val:.2f}"
            (lw, lh), _ = cv2.getTextSize(label, FONT, 0.45, 1)
            lx, ly = max(x1, 0), max(y1 - lh - 6, 0)
            cv2.rectangle(frame, (lx, ly), (lx + lw + 4, ly + lh + 6), BOX_COLOR, -1)
            cv2.putText(frame, label, (lx + 2, ly + lh + 1), FONT, 0.45, (0, 0, 0), 1)

    # Count overlay — top-left
    overlay = f"{count} persoane  (ID unic / cadru)"
    ow = len(overlay) * 8 + 14
    cv2.rectangle(frame, (8, 8), (ow, 34), (0, 0, 0), -1)
    cv2.putText(frame, overlay, (12, 27), FONT, 0.6, BOX_COLOR, 1)

    _, jpeg = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), JPEG_QUALITY])
    return jpeg.tobytes(), count


# ── Capture thread — one per zone ─────────────────────────────────────────────

def capture_thread(zone_id: str, video_path: str) -> None:
    frame_delay = 1.0 / TARGET_FPS
    model = _models[zone_id]   # this zone's dedicated model+tracker

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"[{zone_id}] ERROR: Cannot open {video_path}")
        return

    print(f"[{zone_id}] Opened: {video_path}")

    while True:
        t0 = time.time()
        ret, frame = cap.read()

        if not ret:
            # Loop video file
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            # Reset tracker when video loops so IDs restart cleanly
            model.predictor = None
            continue

        jpeg_bytes, count = annotate_frame(model, frame)

        with _locks[zone_id]:
            _frames[zone_id] = jpeg_bytes

        elapsed = time.time() - t0
        sleep_for = frame_delay - elapsed
        if sleep_for > 0:
            time.sleep(sleep_for)


# ── MJPEG generator ────────────────────────────────────────────────────────────

def mjpeg_generator(zone_id: str):
    while True:
        with _locks[zone_id]:
            frame = _frames.get(zone_id)

        if frame is None:
            time.sleep(0.05)
            continue

        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n"
            + frame +
            b"\r\n"
        )
        time.sleep(1.0 / TARGET_FPS)


# ── Flask app ──────────────────────────────────────────────────────────────────

app = Flask(__name__)
CORS(app)


@app.route("/stream/<zone_id>")
def stream(zone_id: str):
    if zone_id not in videos:
        return f"Unknown zone: {zone_id}", 404
    return Response(
        mjpeg_generator(zone_id),
        mimetype="multipart/x-mixed-replace; boundary=frame",
    )


@app.route("/health")
def health():
    return jsonify({"status": "ok", "zones": list(videos.keys())})


# ── Entry point ────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="IAS Airport — MJPEG stream server with ByteTrack")
    parser.add_argument("--gate",      required=True, help="Video file for Gate")
    parser.add_argument("--checkin",   required=True, help="Video file for Check In")
    parser.add_argument("--disembark", required=True, help="Video file for Disembarkation Zone")
    parser.add_argument("--port",      type=int, default=5001, help="HTTP port (default: 5001)")
    args = parser.parse_args()

    videos["gate"]      = args.gate
    videos["checkin"]   = args.checkin
    videos["disembark"] = args.disembark

    for zone_id, path in videos.items():
        if not Path(path).exists():
            print(f"WARNING: {zone_id} video not found: {path}")

    print("Loading YOLO models (one per zone for thread-safe tracking)...")
    for zone_id in videos:
        _models[zone_id] = YOLO(MODEL_NAME)
        _frames[zone_id] = None
        _locks[zone_id]  = threading.Lock()
    print("Models ready.\n")

    for zone_id, path in videos.items():
        t = threading.Thread(target=capture_thread, args=(zone_id, path), daemon=True)
        t.start()

    print(f"Stream server running on http://localhost:{args.port}")
    print("Endpoints:")
    for zone_id in videos:
        print(f"  http://localhost:{args.port}/stream/{zone_id}")
    print("\nPress Ctrl+C to stop.\n")

    app.run(host="0.0.0.0", port=args.port, threaded=True)


if __name__ == "__main__":
    main()

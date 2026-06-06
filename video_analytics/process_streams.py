"""
process_streams.py — Computer Vision pipeline for Iași Airport (LRIA)
Uses YOLOv8 (ultralytics) to count people in video feeds for 3 zones:
  • Gate
  • Check In
  • Disembarkation Zone

Output: ../public/cv-output.json  (read by the Astro API route /api/video-flow-data)

Usage:
    pip install ultralytics
    python process_streams.py --gate gate.mp4 --checkin checkin.mp4 --disembark disembark.mp4

For live RTSP streams:
    python process_streams.py --gate rtsp://cam1/stream --checkin rtsp://cam2/stream --disembark rtsp://cam3/stream

The script writes the JSON file every WRITE_INTERVAL_SEC seconds so the Astro app
can poll it without overloading the disk.
"""

import argparse
import json
import os
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

import cv2
from ultralytics import YOLO

# ── Configuration ──────────────────────────────────────────────────────────────

MODEL_NAME = "yolov8n.pt"           # nano — fastest; swap to yolov8s/m for accuracy
PERSON_CLASS_ID = 0                 # COCO class 0 = person
CONFIDENCE_THRESHOLD = 0.4
WRITE_INTERVAL_SEC = 3              # how often to flush counts to JSON
OUTPUT_PATH = Path(__file__).parent.parent / "public" / "cv-output.json"

ZONE_CAPACITY = {
    "gate1":     120,
    "gate2":     80,
    "disembark": 200,
}

ZONE_LABELS = {
    "gate1":     "Poarta",
    "gate2":     "Check In",
    "disembark": "Zona Sosiri",
}

# ── Shared state ───────────────────────────────────────────────────────────────

counts: dict[str, int] = {"gate1": 0, "gate2": 0, "disembark": 0}
prev_counts: dict[str, int] = {"gate1": 0, "gate2": 0, "disembark": 0}
lock = threading.Lock()
model = YOLO(MODEL_NAME)


# ── Alert level helper ─────────────────────────────────────────────────────────

def alert_level(count: int, capacity: int) -> str:
    pct = count / capacity
    if pct >= 0.85:
        return "critical"
    if pct >= 0.65:
        return "warning"
    return "normal"


def trend(zone_id: str) -> str:
    delta = counts[zone_id] - prev_counts[zone_id]
    if delta > 2:
        return "up"
    if delta < -2:
        return "down"
    return "stable"


# ── Writer thread ──────────────────────────────────────────────────────────────

def writer_thread() -> None:
    while True:
        time.sleep(WRITE_INTERVAL_SEC)
        with lock:
            readings = []
            now = datetime.now(timezone.utc).isoformat()
            for zone_id in ("gate1", "gate2", "disembark"):
                readings.append({
                    "zoneId": zone_id,
                    "label": ZONE_LABELS[zone_id],
                    "count": counts[zone_id],
                    "capacity": ZONE_CAPACITY[zone_id],
                    "trend": trend(zone_id),
                    "alertLevel": alert_level(counts[zone_id], ZONE_CAPACITY[zone_id]),
                    "updatedAt": now,
                })
                prev_counts[zone_id] = counts[zone_id]

            snapshot = {
                "readings": readings,
                "capturedAt": now,
                "source": "cv-live",
            }

        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT_PATH.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[{now}] Written: gate1={counts['gate1']} gate2={counts['gate2']} disembark={counts['disembark']}")


# ── Per-zone inference thread ──────────────────────────────────────────────────

def inference_thread(zone_id: str, source: str) -> None:
    """Reads frames from `source` (file path or RTSP URL) and updates shared count."""
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        print(f"[{zone_id}] ERROR: Cannot open source: {source}")
        return

    print(f"[{zone_id}] Stream opened: {source}")

    while True:
        ret, frame = cap.read()
        if not ret:
            # Loop video files; reconnect RTSP
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ret, frame = cap.read()
            if not ret:
                print(f"[{zone_id}] Reconnecting...")
                time.sleep(2)
                cap = cv2.VideoCapture(source)
                continue

        results = model(frame, classes=[PERSON_CLASS_ID], conf=CONFIDENCE_THRESHOLD, verbose=False)
        person_count = sum(
            1 for r in results for box in r.boxes if int(box.cls[0]) == PERSON_CLASS_ID
        )

        with lock:
            counts[zone_id] = person_count

        # Skip frames to reduce CPU usage on video files
        cap.grab()
        cap.grab()


# ── Entry point ────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="IAS Airport — CV People Counter")
    parser.add_argument("--gate",      required=True, help="Video file or RTSP URL for Gate")
    parser.add_argument("--checkin",   required=True, help="Video file or RTSP URL for Check In")
    parser.add_argument("--disembark", required=True, help="Video file or RTSP URL for Disembarkation Zone")
    args = parser.parse_args()

    threads = [
        threading.Thread(target=inference_thread, args=("gate1",     args.gate),      daemon=True),
        threading.Thread(target=inference_thread, args=("gate2",     args.checkin),   daemon=True),
        threading.Thread(target=inference_thread, args=("disembark", args.disembark), daemon=True),
        threading.Thread(target=writer_thread,    daemon=True),
    ]

    for t in threads:
        t.start()

    print(f"CV pipeline running. Writing to {OUTPUT_PATH}")
    print("Press Ctrl+C to stop.")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Shutting down.")


if __name__ == "__main__":
    main()

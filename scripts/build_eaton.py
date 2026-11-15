"""Build the Eaton fire replay track from NASA FIRMS detections.

Input:  data/raw/firms_*.csv  (FIRMS area API, bbox -118.25,34.12,-118.0,34.28, 2025-01-07 + 3 days)
Output: src/data/eaton-fire.json

Each detection has the time a satellite saw it. Between passes we don't know
when a spot first caught, so we estimate an arrival time: points close to the
previously burning area arrive early in the gap, points far from it arrive late.
Every point keeps its real observation time so the UI can tell the two apart.

Run: python3 -I scripts/build_eaton.py
"""

import csv
import glob
import json
import math
from datetime import datetime, timedelta, timezone

PST = timezone(timedelta(hours=-8))
IGNITION = datetime(2025, 1, 7, 18, 18, tzinfo=PST)  # reported start, Eaton Canyon
ORIGIN = (34.1975, -118.0855)  # approximate origin in Eaton Canyon (lat, lng)
WINDOW_END = datetime(2025, 1, 8, 6, 0, tzinfo=PST)
DEDUPE_KM = 0.2  # a spot already seen burning isn't new


def km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))


rows = []
for path in sorted(glob.glob("data/raw/firms_*.csv")):
    source = path.split("firms_")[1][:-4]
    for r in csv.DictReader(open(path)):
        seen = datetime.strptime(r["acq_date"] + r["acq_time"].zfill(4), "%Y-%m-%d%H%M").replace(tzinfo=timezone.utc)
        if not (IGNITION <= seen <= WINDOW_END):
            continue
        rows.append({
            "lat": float(r["latitude"]),
            "lng": float(r["longitude"]),
            "seen": seen,
            "frp": float(r.get("frp") or 0),
            "source": source,
        })

rows.sort(key=lambda r: r["seen"])

# Group into passes (detections within 10 minutes belong to one pass).
passes = []
for r in rows:
    if passes and (r["seen"] - passes[-1][0]["seen"]) <= timedelta(minutes=10):
        passes[-1].append(r)
    else:
        passes.append([r])

burning = [ORIGIN]
prev_time = IGNITION
out = []
for group in passes:
    pass_time = group[0]["seen"]
    new = []
    for r in group:
        p = (r["lat"], r["lng"])
        if any(km(p, q) < DEDUPE_KM for q in burning[1:]):
            continue
        r["gap_km"] = min(km(p, q) for q in burning)
        new.append(r)
    if new:
        far = max(r["gap_km"] for r in new) or 1
        span = (pass_time - prev_time).total_seconds()
        for r in new:
            arrival = prev_time + timedelta(seconds=span * (r["gap_km"] / far))
            out.append({
                "lng": round(r["lng"], 5),
                "lat": round(r["lat"], 5),
                "arrival": int(arrival.timestamp() * 1000),
                "seen": int(r["seen"].timestamp() * 1000),
                "frp": round(r["frp"], 1),
                "source": r["source"],
            })
            burning.append((r["lat"], r["lng"]))
    prev_time = pass_time

out.sort(key=lambda r: r["arrival"])
doc = {
    "name": "Eaton fire",
    "ignition": int(IGNITION.timestamp() * 1000),
    "windowEnd": int(WINDOW_END.timestamp() * 1000),
    "origin": {"lat": ORIGIN[0], "lng": ORIGIN[1]},
    "passes": [
        {"at": int(g[0]["seen"].timestamp() * 1000), "sources": sorted({r["source"] for r in g}), "count": len(g)}
        for g in passes
    ],
    "points": out,
    "note": "NASA FIRMS detections (VIIRS, MODIS). Arrival times between satellite passes are interpolated.",
}
with open("src/data/eaton-fire.json", "w") as f:
    json.dump(doc, f, separators=(",", ":"))

print(f"{len(rows)} detections in window, {len(passes)} passes, {len(out)} unique spots")
for g in passes:
    print(" ", g[0]["seen"].astimezone(PST).strftime("%I:%M %p"), len(g), sorted({r["source"] for r in g}))

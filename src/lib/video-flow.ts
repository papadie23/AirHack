/**
 * video-flow.ts — Airport Traffic Flow Data Layer
 * Manages crowd-density readings for 3 zones at Iași Airport (LRIA):
 *   • Gate 1 (Schengen)
 *   • Gate 2 (Non-Schengen / T3)
 *   • Disembarkation Zone (Zona Sosiri)
 *
 * In production, data comes from a CV pipeline (YOLO) writing to
 * public/cv-output.json. In demo mode the mock generator simulates
 * realistic human-count fluctuations.
 */

export type ZoneId = "gate1" | "gate2" | "disembark";

export interface ZoneReading {
  zoneId: ZoneId;
  label: string;
  count: number;       // current people count
  capacity: number;    // physical capacity of the zone
  trend: "up" | "down" | "stable";
  alertLevel: "normal" | "warning" | "critical";
  updatedAt: string;   // ISO timestamp
}

export interface TrafficSnapshot {
  readings: ZoneReading[];
  capturedAt: string;  // ISO timestamp of this snapshot
  source: "mock" | "cv-live";
}

/** Historical ring buffer — keeps last N snapshots for charting */
export interface TrafficHistory {
  timestamps: string[];
  gate1: number[];
  gate2: number[];
  disembark: number[];
}

// Zone metadata — static definitions for IAS airport zones
const ZONE_META: Record<ZoneId, { label: string; capacity: number; baseCount: number }> = {
  gate1:     { label: "Poarta",    capacity: 120, baseCount: 35 },
  gate2:     { label: "Check In", capacity: 80,  baseCount: 20 },
  disembark: { label: "Zona Sosiri",                capacity: 200, baseCount: 55 },
};

/** Thresholds (% of capacity) that trigger alert levels */
const WARN_PCT  = 0.65;
const CRIT_PCT  = 0.85;

function alertLevel(count: number, capacity: number): ZoneReading["alertLevel"] {
  const pct = count / capacity;
  if (pct >= CRIT_PCT) return "critical";
  if (pct >= WARN_PCT) return "warning";
  return "normal";
}

// ── Internal mock state (persists across calls within the process) ──
const _mockState: Record<ZoneId, { count: number; direction: number }> = {
  gate1:     { count: 35, direction: 1 },
  gate2:     { count: 20, direction: 1 },
  disembark: { count: 55, direction: -1 },
};

let _prevCounts: Record<ZoneId, number> = {
  gate1: 35, gate2: 20, disembark: 55,
};

/**
 * Advances mock state by one tick, simulating realistic fluctuations:
 * – Random walk with occasional surges (disembarkation events)
 * – Counts stay within [0, capacity]
 */
export function tickMockData(): TrafficSnapshot {
  const now = new Date().toISOString();
  const readings: ZoneReading[] = [];

  const ids: ZoneId[] = ["gate1", "gate2", "disembark"];

  for (const id of ids) {
    const meta = ZONE_META[id];
    const state = _mockState[id];

    // Occasionally flip direction
    if (Math.random() < 0.15) state.direction *= -1;

    // Delta: 0–8 people per tick, weighted by direction
    const delta = Math.floor(Math.random() * 8) * state.direction;
    let newCount = state.count + delta;

    // Disembarkation surges: random large influx every ~20 ticks
    if (id === "disembark" && Math.random() < 0.05) {
      newCount += Math.floor(Math.random() * 40) + 20;
    }

    // Clamp to zone capacity
    newCount = Math.max(0, Math.min(meta.capacity, newCount));

    const prev = _prevCounts[id];
    const trend: ZoneReading["trend"] =
      newCount > prev + 2 ? "up" :
      newCount < prev - 2 ? "down" :
      "stable";

    _prevCounts[id] = state.count;
    state.count = newCount;

    readings.push({
      zoneId: id,
      label: meta.label,
      count: newCount,
      capacity: meta.capacity,
      trend,
      alertLevel: alertLevel(newCount, meta.capacity),
      updatedAt: now,
    });
  }

  return { readings, capturedAt: now, source: "mock" };
}

/**
 * Attempts to load live CV output from public/cv-output.json.
 * Falls back to mock data if the file doesn't exist or is malformed.
 * This function is only used server-side (Node API route).
 */
export async function loadSnapshot(): Promise<TrafficSnapshot> {
  try {
    // Dynamic import of node:fs to avoid bundler issues
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const path = resolve("public/cv-output.json");
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw) as TrafficSnapshot;
    if (parsed.readings && Array.isArray(parsed.readings)) {
      return { ...parsed, source: "cv-live" };
    }
  } catch {
    // File not present or malformed — use mock
  }
  return tickMockData();
}

/** Build an empty history buffer */
export function createHistory(): TrafficHistory {
  return { timestamps: [], gate1: [], gate2: [], disembark: [] };
}

/** Append a snapshot to a history buffer (trimmed to maxPoints) */
export function appendHistory(
  history: TrafficHistory,
  snapshot: TrafficSnapshot,
  maxPoints = 20,
): TrafficHistory {
  const ts = new Date(snapshot.capturedAt).toLocaleTimeString("ro", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const g = (id: ZoneId) => snapshot.readings.find(r => r.zoneId === id)?.count ?? 0;

  const trim = <T,>(arr: T[]) => arr.slice(-(maxPoints - 1));

  return {
    timestamps: [...trim(history.timestamps), ts],
    gate1:      [...trim(history.gate1),      g("gate1")],
    gate2:      [...trim(history.gate2),      g("gate2")],
    disembark:  [...trim(history.disembark),  g("disembark")],
  };
}

/** Produce a human-readable text summary for LLM context */
export function snapshotSummary(snapshot: TrafficSnapshot): string {
  const lines = snapshot.readings.map(r => {
    const pct = Math.round((r.count / r.capacity) * 100);
    return `  ${r.label}: ${r.count}/${r.capacity} persoane (${pct}%) — ${r.alertLevel.toUpperCase()}, trend: ${r.trend}`;
  });
  return `Situație curentă (${new Date(snapshot.capturedAt).toLocaleTimeString("ro")}):\n${lines.join("\n")}`;
}

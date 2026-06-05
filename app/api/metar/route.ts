import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import {
  type MetarResponse,
  type MetarProvider,
  type NoaaMetarItem,
  parseNoaaMetar,
} from "@/lib/metar";

// Re-export types so components can import from this route (existing pattern)
export type { MetarResponse, MetarProvider, MetarWind, MetarCloud, MetarTrend } from "@/lib/metar";

const NOAA_BASE = "https://aviationweather.gov/api/data/metar";
const CHECKWX_BASE = "https://api.checkwx.com/metar";
const DEFAULT_STATION = "LRIA";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const provider = (searchParams.get("provider") ?? "noaa") as MetarProvider;
  const station = searchParams.get("station") ?? DEFAULT_STATION;

  if (provider === "fixture") {
    return fixtureResponse(station);
  }

  if (provider === "noaa") {
    return fetchNoaa(station);
  }

  if (provider === "checkwx") {
    return fetchCheckwx(station);
  }

  return fixtureResponse(station);
}

// ── NOAA Aviation Weather Center ─────────────────────────────────────────────

async function fetchNoaa(station: string): Promise<NextResponse> {
  try {
    const url = `${NOAA_BASE}?ids=${station}&format=json&hours=2`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return fallback(station, `NOAA returned ${res.status}`);
    }

    const data = await res.json() as NoaaMetarItem[];

    if (!Array.isArray(data) || data.length === 0) {
      return fallback(station, `NOAA returned no METAR for ${station}`);
    }

    const parsed = parseNoaaMetar(data[0]);
    return NextResponse.json(parsed, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return fallback(station, `NOAA fetch failed: ${msg}`);
  }
}

// ── CheckWX ──────────────────────────────────────────────────────────────────

async function fetchCheckwx(station: string): Promise<NextResponse> {
  const apiKey = process.env.CHECKWX_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "CHECKWX_API_KEY not configured",
        hint: "Add CHECKWX_API_KEY to .env.local to enable CheckWX live data",
      },
      { status: 503 }
    );
  }

  try {
    const url = `${CHECKWX_BASE}/${station}/decoded`;
    const res = await fetch(url, {
      headers: { "X-API-Key": apiKey, Accept: "application/json" },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return fallback(station, `CheckWX returned ${res.status}`);
    }

    const body = await res.json();
    // CheckWX returns { data: [...], results: N }
    const item = body?.data?.[0];
    if (!item) return fallback(station, "CheckWX returned no data");

    // CheckWX decoded response maps closely to our interface
    const parsed: MetarResponse = {
      raw: item.raw_text ?? "",
      station: item.icao ?? station,
      observedAt: item.observed ?? new Date().toISOString(),
      wind: {
        directionDeg: item.wind?.degrees ?? 0,
        speedKt: item.wind?.speed_kts ?? 0,
        gustKt: item.wind?.gust_kts ?? null,
        variableFrom: item.wind?.variable_from ?? null,
        variableTo: item.wind?.variable_to ?? null,
        isVariable: item.wind?.degrees === 0,
      },
      visibility: {
        meters: item.visibility?.meters ?? 9999,
        unlimited: (item.visibility?.meters ?? 0) >= 9000,
      },
      clouds: (item.clouds ?? []).map((c: { code: string; base_feet_agl: number; type?: string }) => ({
        cover: c.code,
        baseFt: c.base_feet_agl ?? 0,
        type: c.type ?? null,
      })),
      temperature: {
        tempC: item.temperature?.celsius ?? 0,
        dewpointC: item.dewpoint?.celsius ?? 0,
      },
      altimeter: { qnhHpa: item.altimeter?.millibars ?? 1013 },
      phenomena: (item.conditions ?? []).map((c: { code: string }) => c.code),
      trend: null,
      flightCategory: item.flight_category ?? "VFR",
      fromFixture: false,
      provider: "checkwx",
    };

    return NextResponse.json(parsed, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return fallback(station, `CheckWX fetch failed: ${msg}`);
  }
}

// ── Fallback to fixture ───────────────────────────────────────────────────────

function fixtureResponse(station: string): NextResponse {
  try {
    const name = station.toUpperCase() === "LRIA" ? "metar-lria.json" : "metar-lfpg.json";
    const filePath = path.join(process.cwd(), "fixtures", name);
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as MetarResponse;
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function fallback(station: string, warning: string): NextResponse {
  try {
    const name = station.toUpperCase() === "LRIA" ? "metar-lria.json" : "metar-lfpg.json";
    const filePath = path.join(process.cwd(), "fixtures", name);
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as MetarResponse;
    return NextResponse.json(
      { ...data, fromFixture: true, warning },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ error: warning }, { status: 502 });
  }
}

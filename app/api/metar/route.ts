import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export interface MetarWind {
  directionDeg: number;
  speedKt: number;
  gustKt: number | null;
  variableFrom: number | null;
  variableTo: number | null;
}

export interface MetarCloud {
  cover: string;
  baseFt: number;
  type: string | null;
}

export interface MetarTrend {
  type: "TEMPO" | "BECMG";
  wind: MetarWind | null;
  visibility: { meters: number; unlimited: boolean } | null;
  phenomena: string[];
  clouds: MetarCloud[];
}

export interface MetarResponse {
  raw: string;
  station: string;
  observedAt: string;
  wind: MetarWind;
  visibility: { meters: number; unlimited: boolean };
  clouds: MetarCloud[];
  temperature: { tempC: number; dewpointC: number };
  altimeter: { qnhHpa: number };
  phenomena: string[];
  trend: MetarTrend | null;
  flightCategory: "VFR" | "MVFR" | "IFR" | "LIFR";
  fromFixture: boolean;
}

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "fixtures", "metar-lfpg.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as MetarResponse;

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

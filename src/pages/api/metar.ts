import type { APIRoute } from "astro";
import path from "path";
import fs from "fs";
import { parseNoaaMetar } from "../../lib/metar";
import type { NoaaMetarItem } from "../../lib/metar";

const NOAA_BASE = "https://aviationweather.gov/api/data/metar";

export const GET: APIRoute = async ({ url }) => {
  const station = url.searchParams.get("station") ?? "LRIA";
  const provider = url.searchParams.get("provider") ?? "noaa";

  if (provider === "fixture") return fixtureResponse(station);

  try {
    const res = await fetch(`${NOAA_BASE}?ids=${station}&format=json&hours=2`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return fixtureResponse(station);
    const data = (await res.json()) as NoaaMetarItem[];
    if (!Array.isArray(data) || data.length === 0) return fixtureResponse(station);
    const parsed = parseNoaaMetar(data[0]);
    return new Response(JSON.stringify(parsed), { headers: { "Content-Type": "application/json" } });
  } catch {
    return fixtureResponse(station);
  }
};

function fixtureResponse(station: string) {
  const name = station.toUpperCase() === "LRIA" ? "metar-lria.json" : "metar-lfpg.json";
  const filePath = path.join(process.cwd(), "fixtures", name);
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
}

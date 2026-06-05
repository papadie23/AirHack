import type { APIRoute } from "astro";
import { parseOpenMeteo, IASI_LAT, IASI_LON } from "../../lib/weather";
import type { OpenMeteoResponse } from "../../lib/weather";
import path from "path";
import fs from "fs";

const OPEN_METEO_URL =
  `https://api.open-meteo.com/v1/forecast` +
  `?latitude=${IASI_LAT}&longitude=${IASI_LON}` +
  `&current=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code,relative_humidity_2m,apparent_temperature,precipitation` +
  `&wind_speed_unit=kn&timezone=Europe%2FBucharest`;

export const GET: APIRoute = async () => {
  try {
    const res = await fetch(OPEN_METEO_URL);
    if (!res.ok) return fixture();
    const data = (await res.json()) as OpenMeteoResponse;
    const parsed = parseOpenMeteo(data);
    return new Response(JSON.stringify(parsed), { headers: { "Content-Type": "application/json" } });
  } catch {
    return fixture();
  }
};

function fixture() {
  const filePath = path.join(process.cwd(), "fixtures", "weather-iasi.json");
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return new Response(JSON.stringify({ ...data, fromFixture: true }), {
    headers: { "Content-Type": "application/json" },
  });
}

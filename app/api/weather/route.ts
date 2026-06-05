import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import {
  type WeatherResponse,
  type WeatherProvider,
  type OpenMeteoResponse,
  parseOpenMeteo,
  wmoDescription,
  IASI_LAT,
  IASI_LON,
} from "@/lib/weather";

export type { WeatherResponse, WeatherProvider } from "@/lib/weather";

const OPEN_METEO_URL =
  `https://api.open-meteo.com/v1/forecast` +
  `?latitude=${IASI_LAT}&longitude=${IASI_LON}` +
  `&current=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code,relative_humidity_2m,apparent_temperature,precipitation` +
  `&wind_speed_unit=kn&timezone=Europe%2FBucharest`;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const provider = (searchParams.get("provider") ?? "open-meteo") as WeatherProvider;

  if (provider === "open-meteo") {
    return fetchOpenMeteo();
  }

  if (provider === "openweathermap") {
    return fetchOpenWeatherMap();
  }

  if (provider === "meteoblue") {
    return fetchMeteoblue();
  }

  if (provider === "accuweather") {
    return fetchAccuWeather();
  }

  return fixtureWeather();
}

// ── Open-Meteo (free, no key) ─────────────────────────────────────────────────

async function fetchOpenMeteo(): Promise<NextResponse> {
  try {
    const res = await fetch(OPEN_METEO_URL, { next: { revalidate: 0 } });

    if (!res.ok) {
      return weatherFallback(`Open-Meteo returned ${res.status}`);
    }

    const data = (await res.json()) as OpenMeteoResponse;
    const parsed = parseOpenMeteo(data);
    return NextResponse.json(parsed, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return weatherFallback(`Open-Meteo fetch failed: ${msg}`);
  }
}

// ── OpenWeatherMap ────────────────────────────────────────────────────────────

async function fetchOpenWeatherMap(): Promise<NextResponse> {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "OPENWEATHERMAP_API_KEY not configured",
        hint: "Add OPENWEATHERMAP_API_KEY to .env.local to enable OpenWeatherMap live data",
        provider: "openweathermap",
      },
      { status: 503 }
    );
  }

  try {
    const url =
      `https://api.openweathermap.org/data/2.5/weather` +
      `?lat=${IASI_LAT}&lon=${IASI_LON}&appid=${apiKey}&units=metric`;
    const res = await fetch(url, { next: { revalidate: 0 } });

    if (!res.ok) {
      return weatherFallback(`OpenWeatherMap returned ${res.status}`, "openweathermap");
    }

    const data = await res.json();
    const windSpeedMs: number = data?.wind?.speed ?? 0;
    const weatherId: number = data?.weather?.[0]?.id ?? 800;

    const response: WeatherResponse = {
      provider: "openweathermap",
      location: "Iași (LRIA)",
      timestamp: new Date((data.dt ?? 0) * 1000).toISOString(),
      temperatureC: Math.round((data?.main?.temp ?? 0) * 10) / 10,
      apparentTemperatureC: Math.round((data?.main?.feels_like ?? 0) * 10) / 10,
      windSpeedKt: Math.round(windSpeedMs * 1.944 * 10) / 10,
      windDirection: data?.wind?.deg ?? 0,
      humidity: data?.main?.humidity ?? 0,
      weatherCode: owmIdToWmo(weatherId),
      weatherDescription: data?.weather?.[0]?.description ?? "Unknown",
      precipitationMm: data?.rain?.["1h"] ?? data?.snow?.["1h"] ?? 0,
      fromFixture: false,
    };

    return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return weatherFallback(`OpenWeatherMap fetch failed: ${msg}`, "openweathermap");
  }
}

// ── Meteoblue ────────────────────────────────────────────────────────────────

async function fetchMeteoblue(): Promise<NextResponse> {
  const apiKey = process.env.METEOBLUE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "METEOBLUE_API_KEY not configured",
        hint: "Add METEOBLUE_API_KEY to .env.local to enable Meteoblue live data",
        provider: "meteoblue",
      },
      { status: 503 }
    );
  }

  try {
    // Meteoblue basic-1h endpoint
    const url =
      `https://my.meteoblue.com/packages/basic-1h` +
      `?apikey=${apiKey}&lat=${IASI_LAT}&lon=${IASI_LON}&asl=100&format=json`;
    const res = await fetch(url, { next: { revalidate: 0 } });

    if (!res.ok) {
      return weatherFallback(`Meteoblue returned ${res.status}`, "meteoblue");
    }

    const data = await res.json();
    // Map Meteoblue's basic-1h current hour fields
    const temp = data?.data_1h?.temperature?.[0] ?? 0;
    const wind = data?.data_1h?.windspeed?.[0] ?? 0; // m/s
    const windDir = data?.data_1h?.winddirection?.[0] ?? 0;
    const humidity = data?.data_1h?.relativehumidity?.[0] ?? 0;
    const pictoCode = data?.data_1h?.pictocode?.[0] ?? 1;

    // Meteoblue pictocode → rough WMO mapping
    const wmo = pictocodeToWmo(pictoCode);

    const response: WeatherResponse = {
      provider: "meteoblue",
      location: "Iași (LRIA)",
      timestamp: new Date().toISOString(),
      temperatureC: temp,
      apparentTemperatureC: temp - 1,
      windSpeedKt: Math.round((wind * 1.944) * 10) / 10, // m/s → kt
      windDirection: windDir,
      humidity,
      weatherCode: wmo,
      weatherDescription: wmoDescription(wmo),
      precipitationMm: data?.data_1h?.precipitation?.[0] ?? 0,
      fromFixture: false,
    };

    return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return weatherFallback(`Meteoblue fetch failed: ${msg}`, "meteoblue");
  }
}

// ── AccuWeather ───────────────────────────────────────────────────────────────

async function fetchAccuWeather(): Promise<NextResponse> {
  const apiKey = process.env.ACCUWEATHER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "ACCUWEATHER_API_KEY not configured",
        hint: "Add ACCUWEATHER_API_KEY to .env.local to enable AccuWeather live data",
        provider: "accuweather",
      },
      { status: 503 }
    );
  }

  try {
    // Step 1: get location key for Iași
    const locUrl =
      `https://dataservice.accuweather.com/locations/v1/cities/geoposition/search` +
      `?apikey=${apiKey}&q=${IASI_LAT},${IASI_LON}`;
    const locRes = await fetch(locUrl, { next: { revalidate: 3600 } });
    if (!locRes.ok) return weatherFallback(`AccuWeather location lookup failed`, "accuweather");
    const locData = await locRes.json();
    const locationKey: string = locData.Key;

    // Step 2: current conditions
    const condUrl =
      `https://dataservice.accuweather.com/currentconditions/v1/${locationKey}` +
      `?apikey=${apiKey}&details=true`;
    const condRes = await fetch(condUrl, { next: { revalidate: 0 } });
    if (!condRes.ok) return weatherFallback(`AccuWeather conditions failed`, "accuweather");
    const condData = await condRes.json();
    const c = condData[0];

    const response: WeatherResponse = {
      provider: "accuweather",
      location: "Iași (LRIA)",
      timestamp: new Date().toISOString(),
      temperatureC: c?.Temperature?.Metric?.Value ?? 0,
      apparentTemperatureC: c?.RealFeelTemperature?.Metric?.Value ?? 0,
      windSpeedKt: Math.round((c?.Wind?.Speed?.Metric?.Value ?? 0) * 0.539957 * 10) / 10,
      windDirection: c?.Wind?.Direction?.Degrees ?? 0,
      humidity: c?.RelativeHumidity ?? 0,
      weatherCode: acuIconToWmo(c?.WeatherIcon ?? 1),
      weatherDescription: c?.WeatherText ?? "Unknown",
      precipitationMm: c?.Precip1hr?.Metric?.Value ?? 0,
      fromFixture: false,
    };

    return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return weatherFallback(`AccuWeather fetch failed: ${msg}`, "accuweather");
  }
}

// ── Fallback ─────────────────────────────────────────────────────────────────

function fixtureWeather(provider: WeatherProvider = "open-meteo"): NextResponse {
  try {
    const filePath = path.join(process.cwd(), "fixtures", "weather-iasi.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as WeatherResponse;
    return NextResponse.json({ ...data, provider }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function weatherFallback(warning: string, provider: WeatherProvider = "open-meteo"): NextResponse {
  try {
    const filePath = path.join(process.cwd(), "fixtures", "weather-iasi.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as WeatherResponse;
    return NextResponse.json(
      { ...data, provider, fromFixture: true, warning },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ error: warning }, { status: 502 });
  }
}

// ── Code mappers ──────────────────────────────────────────────────────────────

function pictocodeToWmo(code: number): number {
  if (code <= 2) return 0;
  if (code <= 4) return 2;
  if (code <= 6) return 3;
  if (code === 7) return 45;
  if (code <= 10) return 61;
  if (code <= 13) return 95;
  if (code <= 16) return 71;
  return 3;
}

function acuIconToWmo(icon: number): number {
  if (icon <= 3) return 0;
  if (icon <= 6) return 2;
  if (icon <= 11) return 45;
  if (icon <= 14) return 61;
  if (icon === 15 || icon === 16) return 95;
  if (icon <= 20) return 71;
  if (icon <= 22) return 80;
  return 2;
}

// OWM weather condition IDs → WMO codes
// https://openweathermap.org/weather-conditions
function owmIdToWmo(id: number): number {
  if (id === 800) return 0;              // clear sky
  if (id === 801) return 1;              // few clouds
  if (id === 802) return 2;              // scattered clouds
  if (id >= 803) return 3;              // broken/overcast
  if (id >= 700 && id < 800) return 45; // atmosphere (fog, haze, etc.)
  if (id >= 600 && id < 700) return 71; // snow
  if (id >= 520 && id < 600) return 80; // shower rain
  if (id >= 500 && id < 520) return 61; // rain
  if (id >= 300 && id < 400) return 51; // drizzle
  if (id >= 200 && id < 300) return 95; // thunderstorm
  return 2;
}

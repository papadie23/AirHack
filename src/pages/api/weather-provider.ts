import type { APIRoute } from "astro";
import { parseOpenMeteo, IASI_LAT, IASI_LON } from "../../lib/weather";
import type { WeatherProvider, WeatherResponse, OpenMeteoResponse } from "../../lib/weather";
import path from "path";
import fs from "fs";

const OPEN_METEO_URL =
  `https://api.open-meteo.com/v1/forecast` +
  `?latitude=${IASI_LAT}&longitude=${IASI_LON}` +
  `&current=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code,relative_humidity_2m,apparent_temperature,precipitation` +
  `&wind_speed_unit=kn&timezone=Europe%2FBucharest`;

export const GET: APIRoute = async ({ url }) => {
  const provider = (url.searchParams.get("provider") ?? "open-meteo") as WeatherProvider;
  const useFixtures = import.meta.env.USE_FIXTURES === "true";

  if (useFixtures) return fixtureResponse(provider);

  try {
    switch (provider) {
      case "openweathermap": return await fetchOpenWeatherMap();
      case "accuweather":    return await fetchAccuWeather();
      default:               return await fetchOpenMeteo();
    }
  } catch {
    return fixtureResponse(provider);
  }
};

// ── Fixture fallback ─────────────────────────────────────────────────────────

function fixtureResponse(provider: WeatherProvider): Response {
  const filePath = path.join(process.cwd(), "fixtures", "weather-iasi.json");
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return json({ ...data, provider, fromFixture: true });
}

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
}

// ── Open-Meteo ───────────────────────────────────────────────────────────────

async function fetchOpenMeteo(): Promise<Response> {
  const res = await fetch(OPEN_METEO_URL);
  if (!res.ok) throw new Error("Open-Meteo error");
  const data = (await res.json()) as OpenMeteoResponse;
  return json(parseOpenMeteo(data));
}

// ── OpenWeatherMap ───────────────────────────────────────────────────────────

async function fetchOpenWeatherMap(): Promise<Response> {
  const apiKey = import.meta.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) throw new Error("Missing OPENWEATHERMAP_API_KEY");
  const res = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?lat=${IASI_LAT}&lon=${IASI_LON}&appid=${apiKey}&units=metric`
  );
  if (!res.ok) throw new Error(`OWM HTTP ${res.status}`);
  const d = await res.json();
  const weather: WeatherResponse = {
    provider: "openweathermap",
    location: "LRIA — Iași International Airport",
    timestamp: new Date(d.dt * 1000).toISOString(),
    temperatureC: Math.round(d.main.temp * 10) / 10,
    apparentTemperatureC: Math.round(d.main.feels_like * 10) / 10,
    // OWM returns m/s → convert to knots
    windSpeedKt: Math.round(d.wind.speed * 1.94384 * 10) / 10,
    windDirection: d.wind.deg ?? 0,
    humidity: d.main.humidity,
    weatherCode: d.weather[0]?.id ?? 0,
    weatherDescription: d.weather[0]?.description ?? "Unknown",
    precipitationMm: d.rain?.["1h"] ?? 0,
    fromFixture: false,
  };
  return json(weather);
}

// ── AccuWeather ──────────────────────────────────────────────────────────────

async function fetchAccuWeather(): Promise<Response> {
  const apiKey = import.meta.env.ACCUWEATHER_API_KEY;
  if (!apiKey) throw new Error("Missing ACCUWEATHER_API_KEY");

  // Step 1 — resolve location key from coordinates
  const locRes = await fetch(
    `http://dataservice.accuweather.com/locations/v1/cities/geoposition/search?apikey=${apiKey}&q=${IASI_LAT},${IASI_LON}`
  );
  if (!locRes.ok) throw new Error(`AccuWeather location HTTP ${locRes.status}`);
  const locData = await locRes.json();
  const locationKey: string = locData.Key;

  // Step 2 — current conditions (details=true for wind, humidity, precip)
  const condRes = await fetch(
    `http://dataservice.accuweather.com/currentconditions/v1/${locationKey}?apikey=${apiKey}&details=true`
  );
  if (!condRes.ok) throw new Error(`AccuWeather conditions HTTP ${condRes.status}`);
  const [cond] = await condRes.json();

  const weather: WeatherResponse = {
    provider: "accuweather",
    location: "LRIA — Iași International Airport",
    timestamp: cond.LocalObservationDateTime,
    temperatureC: Math.round(cond.Temperature.Metric.Value * 10) / 10,
    apparentTemperatureC: Math.round(cond.RealFeelTemperature.Metric.Value * 10) / 10,
    // AccuWeather returns km/h → convert to knots
    windSpeedKt: Math.round(cond.Wind.Speed.Metric.Value * 0.539957 * 10) / 10,
    windDirection: cond.Wind.Direction.Degrees,
    humidity: cond.RelativeHumidity,
    weatherCode: cond.WeatherIcon,
    weatherDescription: cond.WeatherText,
    precipitationMm: cond.Precip1hr?.Metric?.Value ?? 0,
    fromFixture: false,
  };
  return json(weather);
}

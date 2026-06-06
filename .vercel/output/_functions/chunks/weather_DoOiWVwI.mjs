import path from 'path';
import fs from 'fs';

const WMO = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light showers",
  81: "Moderate showers",
  82: "Violent showers",
  85: "Light snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm w/ hail",
  99: "Thunderstorm w/ heavy hail"
};
function wmoDescription(code) {
  return WMO[code] ?? `Code ${code}`;
}
function parseOpenMeteo(data) {
  const c = data.current;
  return {
    provider: "open-meteo",
    location: "LRIA — Iași International Airport",
    timestamp: new Date(c.time).toISOString(),
    temperatureC: Math.round(c.temperature_2m * 10) / 10,
    apparentTemperatureC: Math.round(c.apparent_temperature * 10) / 10,
    windSpeedKt: Math.round(c.wind_speed_10m * 10) / 10,
    windDirection: c.wind_direction_10m,
    humidity: c.relative_humidity_2m,
    weatherCode: c.weather_code,
    weatherDescription: wmoDescription(c.weather_code),
    precipitationMm: c.precipitation,
    fromFixture: false
  };
}
const IASI_LAT = 47.1783;
const IASI_LON = 27.6206;

const OPEN_METEO_URL = `https://api.open-meteo.com/v1/forecast?latitude=${IASI_LAT}&longitude=${IASI_LON}&current=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code,relative_humidity_2m,apparent_temperature,precipitation&wind_speed_unit=kn&timezone=Europe%2FBucharest`;
const GET = async () => {
  try {
    const res = await fetch(OPEN_METEO_URL);
    if (!res.ok) return fixture();
    const data = await res.json();
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
    headers: { "Content-Type": "application/json" }
  });
}

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };

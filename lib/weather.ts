// Weather provider types and utilities. No React, safe on client + server.

export type WeatherProvider = "open-meteo" | "openweathermap" | "meteoblue" | "accuweather";

export interface WeatherResponse {
  provider: WeatherProvider;
  location: string;
  timestamp: string;
  temperatureC: number;
  apparentTemperatureC: number;
  windSpeedKt: number;
  windDirection: number;
  humidity: number;       // percent
  weatherCode: number;    // WMO code
  weatherDescription: string;
  precipitationMm: number;
  fromFixture?: boolean;
  warning?: string;
}

// ── WMO weather code descriptions ────────────────────────────────────────────

const WMO: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Depositing rime fog",
  51: "Light drizzle", 53: "Moderate drizzle", 55: "Heavy drizzle",
  61: "Light rain", 63: "Moderate rain", 65: "Heavy rain",
  71: "Light snow", 73: "Moderate snow", 75: "Heavy snow",
  77: "Snow grains",
  80: "Light showers", 81: "Moderate showers", 82: "Violent showers",
  85: "Light snow showers", 86: "Heavy snow showers",
  95: "Thunderstorm", 96: "Thunderstorm w/ hail", 99: "Thunderstorm w/ heavy hail",
};

export function wmoDescription(code: number): string {
  return WMO[code] ?? `Code ${code}`;
}

export function wmoIcon(code: number): string {
  if (code === 0) return "☀";
  if (code <= 3) return "⛅";
  if (code <= 48) return "🌫";
  if (code <= 67) return "🌧";
  if (code <= 77) return "🌨";
  if (code <= 82) return "🌦";
  if (code <= 86) return "🌨";
  return "⛈";
}

export function windSpeedKtLabel(kt: number): string {
  if (kt < 1) return "Calm";
  if (kt < 8) return "Light";
  if (kt < 16) return "Moderate";
  if (kt < 28) return "Fresh";
  return "Strong";
}

// ── Open-Meteo API response shape ────────────────────────────────────────────

export interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    wind_speed_10m: number;       // in kt (requested with wind_speed_unit=kn)
    wind_direction_10m: number;
    weather_code: number;
    relative_humidity_2m: number;
    precipitation: number;
  };
}

export function parseOpenMeteo(data: OpenMeteoResponse): WeatherResponse {
  const c = data.current;
  return {
    provider: "open-meteo",
    location: "Iași (LRIA)",
    timestamp: new Date(c.time).toISOString(),
    temperatureC: Math.round(c.temperature_2m * 10) / 10,
    apparentTemperatureC: Math.round(c.apparent_temperature * 10) / 10,
    windSpeedKt: Math.round(c.wind_speed_10m * 10) / 10,
    windDirection: c.wind_direction_10m,
    humidity: c.relative_humidity_2m,
    weatherCode: c.weather_code,
    weatherDescription: wmoDescription(c.weather_code),
    precipitationMm: c.precipitation,
    fromFixture: false,
  };
}

// Iași coordinates
export const IASI_LAT = 47.1585;
export const IASI_LON = 27.6014;

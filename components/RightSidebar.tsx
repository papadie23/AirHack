"use client";

import type { WeatherResponse, WeatherProvider } from "@/app/api/weather/route";

interface Props {
  weatherData: WeatherResponse | null;
  weatherLoading: boolean;
  weatherProvider: WeatherProvider;
  onWeatherProviderChange: (p: WeatherProvider) => void;
}

const PROVIDERS: {
  id: WeatherProvider;
  label: string;
  sublabel: string;
  description: string;
}[] = [
  {
    id: "open-meteo",
    label: "Open-Meteo",
    sublabel: "Free · No key required",
    description: "Open-source, high-resolution EU model",
  },
  {
    id: "openweathermap",
    label: "OpenWeatherMap",
    sublabel: "OWM · API key required",
    description: "Global coverage, real-time stations",
  },
  {
    id: "meteoblue",
    label: "Meteoblue",
    sublabel: "Swiss · API key required",
    description: "Swiss precision, aviation-grade",
  },
  {
    id: "accuweather",
    label: "AccuWeather",
    sublabel: "Premium · API key required",
    description: "Hyperlocal MinuteCast® data",
  },
];

export default function RightSidebar({
  weatherData, weatherLoading, weatherProvider, onWeatherProviderChange,
}: Props) {
  return (
    <div
      className="rounded-2xl border p-4 flex flex-col gap-3 overflow-hidden"
      style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-1 shrink-0">
        <p
          className="text-[11px] font-semibold uppercase tracking-[1.5px]"
          style={{ color: "var(--text-muted)" }}
        >
          Weather Provider
        </p>
        {weatherLoading && (
          <span className="w-1.5 h-1.5 rounded-full bg-[#ff6600] animate-pulse" />
        )}
      </div>

      {/* Provider cards */}
      <div className="flex flex-col gap-2.5 flex-1 min-h-0">
        {PROVIDERS.map((p) => {
          const isActive = weatherProvider === p.id;
          const isLoading = isActive && weatherLoading;
          const hasData = isActive && weatherData && !("error" in weatherData);

          return (
            <button
              key={p.id}
              onClick={() => onWeatherProviderChange(p.id)}
              className="flex-1 flex flex-col justify-between p-4 rounded-xl border text-left cursor-pointer transition-all duration-200"
              style={
                isActive
                  ? {
                      borderColor: "#ff6600",
                      background: "rgba(255,102,0,0.08)",
                      boxShadow: "0 0 16px rgba(255,102,0,0.12)",
                    }
                  : {
                      borderColor: "var(--border-color)",
                      background: "transparent",
                    }
              }
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }
              }}
            >
              {/* Top row: label + indicator */}
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className="text-sm font-semibold"
                  style={{ color: isActive ? "#ff6600" : "var(--text-main)" }}
                >
                  {p.label}
                </span>
                {isLoading ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff6600] animate-pulse" />
                ) : isActive ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff6600]" />
                ) : null}
              </div>

              {/* Sublabel */}
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {p.sublabel}
              </p>

              {/* Description */}
              <p className="text-[10px] mt-1 leading-snug" style={{ color: "var(--text-muted)", opacity: 0.7 }}>
                {p.description}
              </p>

              {/* Live data strip when active */}
              {hasData && weatherData && !("error" in weatherData) && (
                <div
                  className="mt-3 pt-2.5 border-t font-mono"
                  style={{ borderColor: "rgba(255,102,0,0.2)" }}
                >
                  <span className="text-xs font-semibold" style={{ color: "#ff6600" }}>
                    {weatherData.temperatureC >= 0 ? "+" : ""}
                    {weatherData.temperatureC.toFixed(1)}°C
                  </span>
                  <span className="text-[10px] ml-2" style={{ color: "var(--text-muted)" }}>
                    {weatherData.weatherDescription}
                  </span>
                </div>
              )}
              {isActive && weatherData && ("error" in weatherData) && (
                <div
                  className="mt-3 pt-2.5 border-t"
                  style={{ borderColor: "rgba(255,102,0,0.2)" }}
                >
                  <span className="text-[10px] font-mono text-amber-400">
                    ⚠ No API key configured
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

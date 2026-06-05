"use client";

import { useId } from "react";
import type { DemoState, LogEntry } from "@/app/page";
import type { WeatherResponse, WeatherProvider } from "@/app/api/weather/route";

interface Props {
  log: LogEntry[];
  demoState: DemoState;
  weatherData: WeatherResponse | null;
  weatherLoading: boolean;
  weatherProvider: WeatherProvider;
  onWeatherProviderChange: (p: WeatherProvider) => void;
}

const SPARKLINE_DATA = [150, 180, 160, 210, 250, 320, 481];
const SVG_W = 280;
const SVG_H = 100;
const PAD = 8;

const WEATHER_PROVIDERS: { id: WeatherProvider; label: string; sublabel: string }[] = [
  { id: "open-meteo",      label: "Open-Meteo",  sublabel: "Free / No key" },
  { id: "openweathermap",  label: "OWM",          sublabel: "OpenWeatherMap" },
  { id: "meteoblue",       label: "Meteoblue",   sublabel: "API key req." },
  { id: "accuweather",     label: "AccuWeather", sublabel: "API key req." },
];

function buildSparkline(data: number[]): { linePoints: string; areaPath: string } {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;
  const n = data.length;

  const pts = data.map((v, i) => ({
    x: (i / (n - 1)) * SVG_W,
    y: (SVG_H - PAD) - ((v - min) / range) * (SVG_H - 2 * PAD),
  }));

  const linePoints = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  const first = pts[0];
  const last = pts[pts.length - 1];
  const areaPath = [
    `M ${first.x.toFixed(1)},${first.y.toFixed(1)}`,
    ...pts.slice(1).map((p) => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`),
    `L ${last.x.toFixed(1)},${SVG_H}`,
    `L ${first.x.toFixed(1)},${SVG_H}`,
    "Z",
  ].join(" ");

  return { linePoints, areaPath };
}

const STATS = [
  { label: "Total passengers", value: "481", color: undefined },
  { label: "Delayed flights", value: "2", color: "#ef5350" },
  { label: "Active gates", value: "6 / 9", color: undefined },
  { label: "Special needs", value: "3 passengers", color: "#42a5f5" },
];

export default function RightSidebar({
  log, demoState, weatherData, weatherLoading, weatherProvider, onWeatherProviderChange,
}: Props) {
  const gradientId = useId().replace(/:/g, "");
  const { linePoints, areaPath } = buildSparkline(SPARKLINE_DATA);

  return (
    <div className="bg-[#1c1c21] border border-[#2f2f38] rounded-2xl p-5 flex flex-col overflow-hidden gap-5">

      {/* ── Weather section ─────────────────────────────────────── */}
      <section className="flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold text-[#9595a1] uppercase tracking-[1px]">
            Weather — Iași (LRIA)
          </p>
          {weatherLoading && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#ff6600] animate-pulse" />
          )}
        </div>

        {/* Provider pills */}
        <div className="flex flex-wrap gap-1.5">
          {WEATHER_PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => onWeatherProviderChange(p.id)}
              title={p.sublabel}
              className={[
                "text-[10px] font-mono px-2 py-0.5 rounded border transition-all duration-150 cursor-pointer",
                weatherProvider === p.id
                  ? "border-[#ff6600] bg-[#ff6600]/15 text-[#ff6600]"
                  : "border-[#2f2f38] text-[#9595a1] hover:border-[#444] hover:text-[#f3f3f6]",
              ].join(" ")}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Warning / fixture notice */}
        {weatherData?.warning && (
          <p className="text-[10px] font-mono text-amber-400 truncate" title={weatherData.warning}>
            ⚠ {weatherData.warning.slice(0, 50)}{weatherData.warning.length > 50 ? "…" : ""}
          </p>
        )}
        {weatherData?.fromFixture && !weatherData.warning && (
          <span className="self-start text-[10px] font-mono text-yellow-600 bg-yellow-900/20 border border-yellow-800/30 px-2 py-0.5 rounded">
            FIXTURE
          </span>
        )}

        {/* Weather metrics 2×2 grid */}
        {weatherData && !("error" in weatherData) ? (
          <div className="grid grid-cols-2 gap-px bg-[#2f2f38] rounded-lg overflow-hidden border border-[#2f2f38]">
            <WeatherCell label="Temperature">
              <span className="text-lg font-mono font-bold text-cyan-300">
                {weatherData.temperatureC >= 0 ? "+" : ""}{weatherData.temperatureC.toFixed(1)}°C
              </span>
              <span className="text-[10px] text-[#9595a1] font-mono">
                Feels {weatherData.apparentTemperatureC >= 0 ? "+" : ""}{weatherData.apparentTemperatureC.toFixed(1)}°C
              </span>
            </WeatherCell>
            <WeatherCell label="Wind">
              <span className="text-lg font-mono font-bold text-[#f3f3f6]">
                {weatherData.windSpeedKt.toFixed(1)} kt
              </span>
              <span className="text-[10px] text-[#9595a1] font-mono">
                {weatherData.windDirection}°
              </span>
            </WeatherCell>
            <WeatherCell label="Humidity">
              <span className="text-lg font-mono font-bold text-sky-400">
                {weatherData.humidity}%
              </span>
            </WeatherCell>
            <WeatherCell label="Condition">
              <span className="text-[11px] font-mono font-semibold text-[#f3f3f6] leading-tight">
                {weatherData.weatherDescription}
              </span>
            </WeatherCell>
          </div>
        ) : weatherLoading ? (
          <div className="animate-pulse flex flex-col gap-2">
            {[100, 80, 90].map((w, i) => (
              <div key={i} className="h-3 bg-white/5 rounded" style={{ width: `${w}%` }} />
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-[#9595a1]/50 font-mono italic">No weather data</p>
        )}
      </section>

      {/* ── Sparkline ───────────────────────────────────────────── */}
      <section className="shrink-0">
        <p className="text-[11px] font-semibold text-[#9595a1] uppercase tracking-[1px] mb-2">
          Passenger Flow (60 min)
        </p>
        <div style={{ height: 120 }} className="w-full">
          <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%" height="100%">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff6600" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#ff6600" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={areaPath} fill={`url(#${gradientId})`} />
            <polyline
              points={linePoints}
              stroke="#ff6600"
              strokeWidth="2"
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </section>

      {/* ── Live Stats ───────────────────────────────────────────── */}
      <section className="shrink-0">
        <p className="text-[11px] font-semibold text-[#9595a1] uppercase tracking-[1px] mb-1">
          Live Stats
        </p>
        <div className="flex flex-col divide-y divide-[#2f2f38]">
          {STATS.map((s) => (
            <div key={s.label} className="flex justify-between items-center py-2.5">
              <span className="text-sm text-[#9595a1]">{s.label}</span>
              <span
                className="text-[14px] font-semibold"
                style={s.color ? { color: s.color } : { color: "#f3f3f6" }}
              >
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Activity Log ─────────────────────────────────────────── */}
      <section className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        <p className="text-[11px] font-semibold text-[#9595a1] uppercase tracking-[1px] mb-2">
          API Activity Log
        </p>
        {demoState === "loading" && (
          <div className="flex items-center gap-2 text-[10px] text-[#ff6600] font-mono animate-pulse mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ff6600]" />
            Calling Orange CAMARA API…
          </div>
        )}
        {log.length === 0 && demoState !== "loading" && (
          <p className="text-[10px] text-[#9595a1]/40 font-mono italic">
            No events yet. Use the SMS Verification card.
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          {log.slice(0, 8).map((entry) => (
            <LogRow key={entry.id} entry={entry} />
          ))}
        </div>
      </section>
    </div>
  );
}

function WeatherCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#1c1c21] px-3 py-2.5 flex flex-col gap-0.5">
      <p className="text-[9px] font-mono text-[#9595a1] uppercase tracking-widest">{label}</p>
      {children}
    </div>
  );
}

function LogRow({ entry }: { entry: LogEntry }) {
  const dot =
    entry.decision === "ALLOW"
      ? "bg-[#66bb6a]"
      : entry.decision === "BLOCK"
      ? "bg-[#ef5350]"
      : entry.type === "location"
      ? "bg-[#42a5f5]"
      : "bg-[#ffa726]";

  return (
    <div className="flex items-start gap-2 text-[10px] font-mono">
      <span className="text-[#9595a1]/50 shrink-0 mt-0.5">{entry.time}</span>
      <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${dot}`} />
      <span className="text-[#9595a1]">{entry.message}</span>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import type { ActiveCard, BottomTab, DemoState, VerifyResult, LocationResult } from "@/app/page";
import type { MetarResponse, MetarProvider } from "@/app/api/metar/route";
import type { WeatherResponse, WeatherProvider } from "@/app/api/weather/route";
import MetarPanel from "@/components/MetarPanel";
import PhoneMockup from "@/components/PhoneMockup";
import DemoControls from "@/components/DemoControls";

interface Props {
  activeCard: ActiveCard;
  activeTab: BottomTab;
  metar: MetarResponse | null;
  metarLoading: boolean;
  metarProvider: MetarProvider;
  onMetarProviderChange: (p: MetarProvider) => void;
  verifyResult: VerifyResult | null;
  locationResult: LocationResult | null;
  demoState: DemoState;
  lastUpdated: Date | null;
  onVerifyLegit: () => void;
  onVerifyFraud: () => void;
  onLocation: () => void;
  weatherData: WeatherResponse | null;
  weatherLoading: boolean;
  theme: "dark" | "light";
  onThemeToggle: () => void;
}

export default function CenterPanel(props: Props) {
  const {
    activeCard, activeTab, metar, metarLoading, metarProvider, onMetarProviderChange,
    verifyResult, locationResult, demoState, lastUpdated,
    onVerifyLegit, onVerifyFraud, onLocation,
    weatherData, weatherLoading, theme, onThemeToggle,
  } = props;

  return (
    <div
      className="bg-[#1c1c21] border border-[#2f2f38] rounded-2xl flex flex-col overflow-hidden"
      style={{ gridColumn: "2", gridRow: "1 / 3" }}
    >
      <CenterHeader
        activeCard={activeCard}
        lastUpdated={lastUpdated}
        theme={theme}
        onThemeToggle={onThemeToggle}
      />

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {activeTab !== "operator" ? (
          <div className="flex-1 flex flex-col items-center justify-center text-[#9595a1]">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 opacity-30">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p className="text-sm font-medium">Coming soon</p>
            <p className="text-xs text-[#9595a1]/50 mt-1">This section is under construction.</p>
          </div>
        ) : activeCard === "weather" ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <WeatherDisplay data={weatherData} loading={weatherLoading} />
            <div className="flex-1 min-h-0 overflow-y-auto border-t border-[#2f2f38]">
              <MetarPanel
                metar={metar}
                isLoading={metarLoading}
                provider={metarProvider}
                onProviderChange={onMetarProviderChange}
              />
            </div>
          </div>
        ) : activeCard === "sms" ? (
          <VerifyView
            demoState={demoState}
            verifyResult={verifyResult}
            locationResult={locationResult}
            onVerifyLegit={onVerifyLegit}
            onVerifyFraud={onVerifyFraud}
            onLocation={onLocation}
          />
        ) : (
          <FloorPlanView />
        )}
      </div>
    </div>
  );
}

// ─── CenterHeader ────────────────────────────────────────────────────────────

function CenterHeader({
  activeCard, lastUpdated, theme, onThemeToggle,
}: {
  activeCard: ActiveCard;
  lastUpdated: Date | null;
  theme: "dark" | "light";
  onThemeToggle: () => void;
}) {
  const [secsAgo, setSecsAgo] = useState(0);

  useEffect(() => {
    if (!lastUpdated) return;
    const id = setInterval(() => {
      setSecsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  const title =
    activeCard === "weather" ? "Weather & METAR — LRIA"
    : activeCard === "sms"   ? "Identity Verification"
    : "Terminal A — Top View";

  return (
    <div className="flex justify-between items-center px-5 py-4 border-b border-[#2f2f38] shrink-0">
      <span className="text-[15px] font-semibold text-[#f3f3f6]">{title}</span>
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={onThemeToggle}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-medium border transition-all duration-200 cursor-pointer"
          style={theme === "light"
            ? { background: "rgba(251,191,36,0.2)", borderColor: "rgba(251,191,36,0.5)", color: "#b45309" }
            : { background: "rgba(148,163,184,0.1)", borderColor: "rgba(148,163,184,0.3)", color: "#94a3b8" }
          }
        >
          {theme === "dark" ? (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
          {theme === "dark" ? "Light" : "Dark"}
        </button>

        <span className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-medium bg-[rgba(239,83,80,0.15)] border border-[rgba(239,83,80,0.3)] text-[#ef5350]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#ef5350]" />
          Live
        </span>
        {lastUpdated && (
          <span className="text-[11px] px-2.5 py-1 rounded-full font-medium bg-[rgba(66,165,245,0.15)] border border-[rgba(66,165,245,0.3)] text-[#42a5f5]">
            Updated {secsAgo}s ago
          </span>
        )}
      </div>
    </div>
  );
}

// ─── WeatherDisplay ───────────────────────────────────────────────────────────

function getWeatherGradient(code: number): string {
  if (code === 0)  return "linear-gradient(150deg, #0284c7 0%, #0ea5e9 55%, #38bdf8 100%)";
  if (code <= 2)   return "linear-gradient(150deg, #0369a1 0%, #38bdf8 50%, #94a3b8 100%)";
  if (code === 3)  return "linear-gradient(150deg, #334155 0%, #475569 60%, #64748b 100%)";
  if (code <= 48)  return "linear-gradient(150deg, #64748b 0%, #94a3b8 60%, #cbd5e1 100%)";
  if (code <= 67)  return "linear-gradient(150deg, #1e3a5f 0%, #1d4ed8 50%, #3b82f6 100%)";
  if (code <= 77)  return "linear-gradient(150deg, #1d4ed8 0%, #60a5fa 50%, #93c5fd 100%)";
  if (code <= 82)  return "linear-gradient(150deg, #1e40af 0%, #2563eb 60%, #3b82f6 100%)";
  return              "linear-gradient(150deg, #1e1b4b 0%, #312e81 50%, #475569 100%)";
}

function WeatherIcon({ code, size = 80 }: { code: number; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 80 80", fill: "none" as const };

  // ☀ Clear sky
  if (code === 0) {
    const rays = [0, 45, 90, 135, 180, 225, 270, 315];
    return (
      <svg {...p}>
        <circle cx="40" cy="40" r="14" fill="#FCD34D" />
        {rays.map(a => {
          const r = (a - 90) * Math.PI / 180;
          return <line key={a} x1={40 + 20 * Math.cos(r)} y1={40 + 20 * Math.sin(r)} x2={40 + 30 * Math.cos(r)} y2={40 + 30 * Math.sin(r)} stroke="#FCD34D" strokeWidth="4" strokeLinecap="round" />;
        })}
      </svg>
    );
  }

  // ⛅ Mainly clear / Partly cloudy
  if (code <= 2) {
    return (
      <svg {...p}>
        <circle cx="30" cy="34" r="12" fill="#FCD34D" opacity="0.95" />
        {[0, 90, 180, 270].map(a => {
          const r = (a - 90) * Math.PI / 180;
          return <line key={a} x1={30 + 16 * Math.cos(r)} y1={34 + 16 * Math.sin(r)} x2={30 + 23 * Math.cos(r)} y2={34 + 23 * Math.sin(r)} stroke="#FCD34D" strokeWidth="3.5" strokeLinecap="round" opacity="0.9" />;
        })}
        <circle cx="40" cy="50" r="13" fill="white" opacity="0.95" />
        <circle cx="57" cy="46" r="15" fill="white" opacity="0.95" />
        <ellipse cx="50" cy="58" rx="22" ry="11" fill="white" opacity="0.95" />
      </svg>
    );
  }

  // ☁ Overcast
  if (code === 3) {
    return (
      <svg {...p}>
        <circle cx="30" cy="42" r="16" fill="white" opacity="0.8" />
        <circle cx="52" cy="37" r="19" fill="white" opacity="0.8" />
        <ellipse cx="42" cy="52" rx="28" ry="14" fill="white" opacity="0.8" />
      </svg>
    );
  }

  // 🌫 Fog / mist
  if (code <= 48) {
    return (
      <svg {...p}>
        {[22, 36, 50].map((y, i) => (
          <rect key={y} x={8 + i * 4} y={y} width={64 - i * 8} height={8} rx={4} fill="white" opacity={0.8 - i * 0.15} />
        ))}
      </svg>
    );
  }

  // 🌧 Drizzle / Rain
  if (code <= 67) {
    return (
      <svg {...p}>
        <circle cx="28" cy="30" r="14" fill="white" opacity="0.85" />
        <circle cx="50" cy="26" r="17" fill="white" opacity="0.85" />
        <ellipse cx="40" cy="40" rx="25" ry="12" fill="white" opacity="0.85" />
        {[24, 38, 52].map(x => (
          <line key={x} x1={x} y1={54} x2={x - 5} y2={70} stroke="#93c5fd" strokeWidth="3.5" strokeLinecap="round" />
        ))}
      </svg>
    );
  }

  // ❄ Snow
  if (code <= 77) {
    return (
      <svg {...p}>
        <circle cx="28" cy="28" r="14" fill="white" opacity="0.85" />
        <circle cx="50" cy="24" r="17" fill="white" opacity="0.85" />
        <ellipse cx="40" cy="38" rx="25" ry="12" fill="white" opacity="0.85" />
        {[22, 40, 58].map(x => (
          <g key={x} transform={`translate(${x},60)`}>
            <line x1={-6} y1={0} x2={6} y2={0} stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <line x1={0} y1={-6} x2={0} y2={6} stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <line x1={-4} y1={-4} x2={4} y2={4} stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <line x1={4} y1={-4} x2={-4} y2={4} stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        ))}
      </svg>
    );
  }

  // ⛈ Thunderstorm
  return (
    <svg {...p}>
      <circle cx="27" cy="28" r="14" fill="white" opacity="0.75" />
      <circle cx="50" cy="24" r="17" fill="white" opacity="0.75" />
      <ellipse cx="40" cy="38" rx="26" ry="13" fill="white" opacity="0.75" />
      <path d="M 44 46 L 34 64 L 41 64 L 34 78 L 50 58 L 43 58 Z" fill="#FCD34D" />
    </svg>
  );
}

function WeatherDisplay({ data, loading }: { data: WeatherResponse | null; loading: boolean }) {
  if (loading && !data) {
    return (
      <div className="shrink-0 h-[210px] animate-pulse" style={{ background: "linear-gradient(150deg, #1e3a5f, #1d4ed8)" }} />
    );
  }
  if (!data || "error" in data) return null;

  const gradient = getWeatherGradient(data.weatherCode);
  const tempRounded = Math.round(data.temperatureC);
  const feelsRounded = Math.round(data.apparentTemperatureC);

  return (
    <div
      className="shrink-0 relative overflow-hidden flex flex-col items-center justify-center px-6 py-5 gap-1"
      style={{ background: gradient, minHeight: 210 }}
    >
      {/* Decorative large circle in background */}
      <div
        className="absolute right-[-40px] top-[-40px] rounded-full pointer-events-none"
        style={{ width: 200, height: 200, background: "rgba(255,255,255,0.07)" }}
      />
      <div
        className="absolute left-[-30px] bottom-[-50px] rounded-full pointer-events-none"
        style={{ width: 160, height: 160, background: "rgba(255,255,255,0.05)" }}
      />

      {/* Content */}
      <div className="relative flex items-center gap-8 w-full max-w-lg">
        {/* Icon + temp */}
        <div className="flex flex-col items-center gap-1">
          <WeatherIcon code={data.weatherCode} size={72} />
          <span className="text-5xl font-bold text-white leading-none mt-1">
            {tempRounded >= 0 ? "+" : ""}{tempRounded}°
          </span>
        </div>

        {/* Right info */}
        <div className="flex flex-col gap-1 flex-1">
          <p className="text-xl font-semibold text-white leading-snug">{data.weatherDescription}</p>
          <p className="text-sm text-white/70 font-medium">Iași International (LRIA)</p>

          {/* Stats row */}
          <div className="flex flex-wrap gap-3 mt-2">
            <WeatherStat label="Feels like" value={`${feelsRounded >= 0 ? "+" : ""}${feelsRounded}°C`} />
            <WeatherStat label="Humidity" value={`${data.humidity}%`} />
            <WeatherStat label="Wind" value={`${data.windSpeedKt.toFixed(1)} kt`} />
            {data.precipitationMm > 0 && (
              <WeatherStat label="Precip" value={`${data.precipitationMm} mm`} />
            )}
          </div>
        </div>
      </div>

      {/* Provider badge */}
      <div className="absolute bottom-3 right-4 flex items-center gap-1.5">
        {data.fromFixture && (
          <span className="text-[9px] font-mono text-white/50 bg-white/10 px-1.5 py-0.5 rounded">FIXTURE</span>
        )}
        <span className="text-[9px] font-mono text-white/40 uppercase tracking-wider">{data.provider}</span>
      </div>
    </div>
  );
}

function WeatherStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-white/55 uppercase tracking-wider">{label}</span>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  );
}

// ─── FloorPlanView ────────────────────────────────────────────────────────────

function FloorPlanView() {
  return (
    <div className="flex-1 flex items-center justify-center w-full p-6 overflow-hidden">
      <svg
        viewBox="0 0 600 400"
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "100%", maxHeight: 500 }}
      >
        {/* Security — red zone */}
        <rect x="20" y="20" width="160" height="130" rx="12" fill="rgba(239,83,80,0.15)" stroke="#ef5350" strokeWidth="2"/>
        <text x="100" y="75" textAnchor="middle" fill="#ef5350" fontSize="16" fontWeight="600">Security</text>
        <text x="100" y="100" textAnchor="middle" fill="#ef5350" fontSize="13" opacity="0.8">~210 pax</text>

        {/* Check-in — amber zone */}
        <rect x="200" y="20" width="160" height="130" rx="12" fill="rgba(255,167,38,0.15)" stroke="#ffa726" strokeWidth="2"/>
        <text x="280" y="75" textAnchor="middle" fill="#ffa726" fontSize="16" fontWeight="600">Check-in</text>
        <text x="280" y="100" textAnchor="middle" fill="#ffa726" fontSize="13" opacity="0.8">~85 pax</text>

        {/* Gates C1–C6 — green zone */}
        <rect x="380" y="20" width="200" height="130" rx="12" fill="rgba(102,187,106,0.15)" stroke="#66bb6a" strokeWidth="2"/>
        <text x="480" y="75" textAnchor="middle" fill="#66bb6a" fontSize="16" fontWeight="600">Gates C1–C6</text>
        <text x="480" y="100" textAnchor="middle" fill="#66bb6a" fontSize="13" opacity="0.8">~47 pax</text>

        {/* Corridor label */}
        <text x="300" y="200" textAnchor="middle" fill="#9595a1" fontSize="14">
          Main access corridor
        </text>

        {/* Lounge — blue zone */}
        <rect x="20" y="250" width="130" height="120" rx="12" fill="rgba(66,165,245,0.15)" stroke="#42a5f5" strokeWidth="2"/>
        <text x="85" y="305" textAnchor="middle" fill="#42a5f5" fontSize="15" fontWeight="600">Lounge</text>
        <text x="85" y="325" textAnchor="middle" fill="#42a5f5" fontSize="13" opacity="0.8">~22 pax</text>

        {/* Duty Free — green zone */}
        <rect x="170" y="250" width="150" height="120" rx="12" fill="rgba(102,187,106,0.15)" stroke="#66bb6a" strokeWidth="2"/>
        <text x="245" y="305" textAnchor="middle" fill="#66bb6a" fontSize="15" fontWeight="600">Duty Free</text>
        <text x="245" y="325" textAnchor="middle" fill="#66bb6a" fontSize="13" opacity="0.8">~33 pax</text>

        {/* Gate C3 — danger/alert zone */}
        <rect x="340" y="250" width="240" height="120" rx="12" fill="rgba(239,83,80,0.15)" stroke="#ef5350" strokeWidth="2" strokeDasharray="6 4"/>
        <text x="460" y="290" textAnchor="middle" fill="#ef5350" fontSize="15" fontWeight="600">Gate C3</text>
        <text x="460" y="310" textAnchor="middle" fill="#ef5350" fontSize="12">CONGESTION ALERT</text>
        <text x="460" y="330" textAnchor="middle" fill="#ef5350" fontSize="12" opacity="0.8">~89 pax · limit 60</text>
      </svg>
    </div>
  );
}

// ─── VerifyView ───────────────────────────────────────────────────────────────

interface VerifyViewProps {
  demoState: DemoState;
  verifyResult: VerifyResult | null;
  locationResult: LocationResult | null;
  onVerifyLegit: () => void;
  onVerifyFraud: () => void;
  onLocation: () => void;
}

function VerifyView({
  demoState, verifyResult, locationResult,
  onVerifyLegit, onVerifyFraud, onLocation,
}: VerifyViewProps) {
  return (
    <div className="flex-1 overflow-y-auto flex flex-col items-center gap-6 p-6">
      <PhoneMockup
        demoState={demoState}
        verifyResult={verifyResult}
        locationResult={locationResult}
      />
      <DemoControls
        demoState={demoState}
        onVerifyLegit={onVerifyLegit}
        onVerifyFraud={onVerifyFraud}
        onLocation={onLocation}
      />
      {(verifyResult || locationResult) && (
        <div className="w-full max-w-sm">
          <p className="text-[10px] text-[#9595a1] font-mono uppercase tracking-widest mb-2">
            API Response (raw)
          </p>
          <pre className="text-[10px] font-mono text-[#9595a1] bg-black/40 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all border border-[#2f2f38]">
            {JSON.stringify(verifyResult ?? locationResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

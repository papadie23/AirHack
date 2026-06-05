"use client";

import type { MetarResponse, MetarCloud, MetarWind, MetarTrend } from "@/app/api/metar/route";
import {
  flightCategoryColor,
  windDirectionLabel,
  cloudCoverLabel,
  cloudCoverPercent,
  formatQnh,
  formatVisibility,
  formatTemp,
} from "@/lib/metar";

interface Props {
  metar: MetarResponse | null;
  isLoading: boolean;
}

export default function MetarPanel({ metar, isLoading }: Props) {
  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#07090f]">
      {/* Panel header */}
      <div className="border-b border-white/10 px-5 py-3 flex items-center gap-3 shrink-0">
        <span className={`w-2 h-2 rounded-full shrink-0 ${isLoading ? "bg-orange-400 animate-pulse" : "bg-cyan-500"}`} />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">
            Airport Operations
          </p>
          <p className="text-sm font-semibold text-gray-200 truncate">
            {metar?.station ?? "——"} — Paris Charles de Gaulle
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {metar && <FlightCategoryBadge category={metar.flightCategory} />}
          <span className="text-[11px] font-mono text-gray-500">
            {metar ? formatObsTime(metar.observedAt) : "——"}
          </span>
        </div>
      </div>

      {isLoading && !metar && <SkeletonLoader />}

      {metar && (
        <div className="flex flex-col divide-y divide-white/5">
          {/* Wind + Visibility row */}
          <div className="grid grid-cols-2 divide-x divide-white/5">
            <WindDisplay wind={metar.wind} />
            <VisibilityDisplay
              meters={metar.visibility.meters}
              unlimited={metar.visibility.unlimited}
              phenomena={metar.phenomena}
            />
          </div>

          {/* Temp / Dewpoint / QNH row */}
          <div className="grid grid-cols-3 divide-x divide-white/5">
            <MetarCell label="Temperature">
              <span className="text-2xl font-mono font-bold text-cyan-300">
                {formatTemp(metar.temperature.tempC)}
              </span>
            </MetarCell>
            <MetarCell label="Dewpoint">
              <span className="text-2xl font-mono font-bold text-sky-400">
                {formatTemp(metar.temperature.dewpointC)}
              </span>
              <span className="text-[10px] text-gray-600 font-mono mt-0.5">
                Spread: {metar.temperature.tempC - metar.temperature.dewpointC}°C
              </span>
            </MetarCell>
            <MetarCell label="QNH / Altimeter">
              <span className="text-sm font-mono font-semibold text-gray-200">
                {metar.altimeter.qnhHpa} hPa
              </span>
              <span className="text-[10px] text-gray-500 font-mono mt-0.5">
                {(metar.altimeter.qnhHpa * 0.02953).toFixed(2)} inHg
              </span>
            </MetarCell>
          </div>

          {/* Cloud layers */}
          <CloudLayers clouds={metar.clouds} />

          {/* TEMPO / BECMG trend */}
          {metar.trend && <TrendBlock trend={metar.trend} />}

          {/* Raw METAR */}
          <RawMetarBox raw={metar.raw} fromFixture={metar.fromFixture} />
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function FlightCategoryBadge({
  category,
}: {
  category: "VFR" | "MVFR" | "IFR" | "LIFR";
}) {
  const c = flightCategoryColor(category);
  return (
    <span
      className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${c.bg} ${c.text} ${c.border}`}
    >
      {category}
    </span>
  );
}

function WindDisplay({ wind }: { wind: MetarWind }) {
  const compassLabel = windDirectionLabel(wind.directionDeg);
  return (
    <MetarCell label="Wind">
      <div className="flex items-center gap-3">
        {/* Rotating arrow */}
        <span
          className="text-3xl text-cyan-400 leading-none select-none"
          style={{ display: "inline-block", transform: `rotate(${wind.directionDeg}deg)` }}
          title={`${wind.directionDeg}°`}
        >
          ↑
        </span>
        <div className="flex flex-col">
          <span className="text-lg font-mono font-bold text-gray-100">
            {wind.speedKt} KT
            {wind.gustKt != null && (
              <span className="text-amber-400 ml-1">G{wind.gustKt}</span>
            )}
          </span>
          <span className="text-[11px] font-mono text-gray-400">
            {wind.directionDeg.toString().padStart(3, "0")}° {compassLabel}
          </span>
          {wind.variableFrom != null && wind.variableTo != null && (
            <span className="text-[10px] font-mono text-gray-600">
              Var {wind.variableFrom}°–{wind.variableTo}°
            </span>
          )}
        </div>
      </div>
    </MetarCell>
  );
}

function VisibilityDisplay({
  meters,
  unlimited,
  phenomena,
}: {
  meters: number;
  unlimited: boolean;
  phenomena: string[];
}) {
  return (
    <MetarCell label="Visibility">
      <span className="text-2xl font-mono font-bold text-gray-100">
        {formatVisibility(meters, unlimited)}
      </span>
      {phenomena.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {phenomena.map((p) => (
            <span
              key={p}
              className="text-[10px] font-mono bg-yellow-900/40 border border-yellow-600/40 text-yellow-300 px-1.5 py-0.5 rounded"
            >
              {p}
            </span>
          ))}
        </div>
      )}
      {phenomena.length === 0 && (
        <span className="text-[10px] font-mono text-gray-600">No significant wx</span>
      )}
    </MetarCell>
  );
}

function CloudLayers({ clouds }: { clouds: MetarCloud[] }) {
  if (clouds.length === 0) {
    return (
      <section className="px-5 py-4">
        <SectionLabel>Cloud Layers</SectionLabel>
        <p className="text-[11px] font-mono text-gray-600">SKC — Sky clear</p>
      </section>
    );
  }
  return (
    <section className="px-5 py-4">
      <SectionLabel>Cloud Layers</SectionLabel>
      <div className="flex flex-col gap-2 mt-2">
        {clouds.map((cloud, i) => {
          const pct = cloudCoverPercent(cloud.cover);
          const isCB = cloud.type === "CB" || cloud.type === "TCU";
          return (
            <div key={i} className="flex items-center gap-3">
              {/* Coverage bar */}
              <div className="w-28 h-3 bg-white/5 rounded-full overflow-hidden shrink-0">
                <div
                  className={`h-full rounded-full transition-all ${isCB ? "bg-amber-500" : "bg-sky-600"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {/* Labels */}
              <span className={`text-[11px] font-mono font-semibold w-8 ${isCB ? "text-amber-400" : "text-gray-300"}`}>
                {cloud.cover}
              </span>
              <span className="text-[11px] font-mono text-gray-500">
                {cloud.baseFt.toLocaleString()} ft
              </span>
              {cloud.type && (
                <span className="text-[10px] font-mono bg-amber-900/40 border border-amber-600/40 text-amber-300 px-1.5 py-0.5 rounded">
                  {cloud.type}
                </span>
              )}
              <span className="text-[10px] text-gray-700 font-mono ml-auto">
                {cloudCoverLabel(cloud.cover)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TrendBlock({ trend }: { trend: MetarTrend }) {
  const isWarning = trend.phenomena.includes("TSRA") ||
    trend.phenomena.includes("TS") ||
    trend.clouds.some((c) => c.type === "CB");

  const colorClasses = isWarning
    ? "bg-amber-900/30 border-amber-500/40 text-amber-300"
    : "bg-sky-900/20 border-sky-500/30 text-sky-300";

  return (
    <section className="px-5 py-4">
      <SectionLabel>{trend.type} Forecast</SectionLabel>
      <div className={`mt-2 rounded-xl border p-3 font-mono text-xs ${colorClasses}`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="font-bold text-sm">{trend.type}</span>
          {isWarning && <span className="text-base">⚠</span>}
          {trend.phenomena.map((p) => (
            <span key={p} className="px-1.5 py-0.5 rounded bg-black/30 text-[10px]">
              {p}
            </span>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          {trend.wind && (
            <TrendRow label="Wind">
              {trend.wind.directionDeg.toString().padStart(3, "0")}°{" "}
              {trend.wind.speedKt} KT
              {trend.wind.gustKt != null && <span className="text-amber-400"> G{trend.wind.gustKt}</span>}
            </TrendRow>
          )}
          {trend.visibility && (
            <TrendRow label="Visibility">
              {formatVisibility(trend.visibility.meters, trend.visibility.unlimited)}
            </TrendRow>
          )}
          {trend.clouds.length > 0 && (
            <TrendRow label="Clouds">
              {trend.clouds.map((c, i) => (
                <span key={i} className={c.type === "CB" ? "text-amber-300 font-bold" : ""}>
                  {c.cover}{c.baseFt / 100 < 10 ? "00" : ""}
                  {Math.round(c.baseFt / 100).toString().padStart(3, "0")}
                  {c.type ?? ""}{" "}
                </span>
              ))}
            </TrendRow>
          )}
        </div>
      </div>
    </section>
  );
}

function RawMetarBox({ raw, fromFixture }: { raw: string; fromFixture: boolean }) {
  return (
    <section className="px-5 py-4">
      <div className="flex items-center justify-between mb-2">
        <SectionLabel>Raw METAR</SectionLabel>
        {fromFixture && (
          <span className="text-[10px] font-mono text-yellow-600 bg-yellow-900/20 border border-yellow-800/30 px-2 py-0.5 rounded">
            FIXTURE
          </span>
        )}
      </div>
      <pre className="bg-black/60 border border-white/10 rounded-lg p-3 text-[11px] font-mono text-green-400 tracking-wide whitespace-pre-wrap break-all leading-relaxed">
        {raw}
      </pre>
    </section>
  );
}

// ─── Utility components ────────────────────────────────────────────────────

function MetarCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-4 flex flex-col gap-1">
      <SectionLabel>{label}</SectionLabel>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">
      {children}
    </p>
  );
}

function TrendRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-600 w-20 shrink-0">{label}</span>
      <span>{children}</span>
    </div>
  );
}

function SkeletonLoader() {
  return (
    <div className="flex flex-col gap-4 p-5 animate-pulse">
      {[80, 60, 90, 50, 70].map((w, i) => (
        <div key={i} className={`h-4 bg-white/5 rounded`} style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

function formatObsTime(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(11, 16) + "Z";
  } catch {
    return "——";
  }
}

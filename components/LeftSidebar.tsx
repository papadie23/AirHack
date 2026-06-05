"use client";

import type { ActiveCard, DemoState, VerifyResult } from "@/app/page";
import type { MetarResponse } from "@/app/api/metar/route";
import { flightCategoryColor } from "@/lib/metar";

interface Props {
  activeCard: ActiveCard;
  onSelectCard: (card: ActiveCard) => void;
  metar: MetarResponse | null;
  verifyResult: VerifyResult | null;
  demoState: DemoState;
}

function cardClass(isActive: boolean): string {
  return [
    "border rounded-[10px] p-3 cursor-pointer transition-all duration-200",
    isActive
      ? "border-[#ff6600] bg-[#26262d] shadow-[0_0_12px_rgba(255,102,0,0.2)]"
      : "border-[#2f2f38] hover:bg-[#26262d] hover:border-[#444]",
  ].join(" ");
}

export default function LeftSidebar({
  activeCard,
  onSelectCard,
  metar,
  verifyResult,
}: Props) {
  function toggle(card: ActiveCard) {
    onSelectCard(activeCard === card ? null : card);
  }

  return (
    <div className="bg-[#1c1c21] border border-[#2f2f38] rounded-2xl p-5 flex flex-col overflow-hidden">
      {/* Brand header */}
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[#2f2f38]">
        <div className="w-10 h-10 bg-[#ff6600] rounded-xl flex items-center justify-center shrink-0">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
            <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
            <line x1="12" y1="20" x2="12.01" y2="20"/>
          </svg>
        </div>
        <div>
          <div className="text-base font-semibold text-[#f3f3f6]">AirFlow Nexus</div>
          <div className="text-xs text-[#9595a1]">powered by Orange APIs</div>
        </div>
      </div>

      {/* Section title */}
      <p className="text-[11px] font-semibold text-[#9595a1] uppercase tracking-[1px] mb-3">
        API Status
      </p>

      {/* Card list */}
      <div className="flex flex-col gap-2.5 flex-1 overflow-y-auto">
        {/* Card 1 — Weather & METAR */}
        <div className={cardClass(activeCard === "weather")} onClick={() => toggle("weather")}>
          <div className="flex items-center gap-2 text-xs text-[#9595a1] mb-1.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/>
            </svg>
            Weather &amp; METAR
          </div>
          <div className="text-[15px] font-semibold text-[#f3f3f6] mb-1">
            {metar
              ? `${metar.temperature.tempC >= 0 ? "+" : ""}${metar.temperature.tempC}°C · ${metar.wind.speedKt} kt`
              : "Loading…"}
          </div>
          <div className="flex items-center gap-2 text-xs text-[#9595a1]">
            {metar ? (
              <>
                <span
                  className={`w-2 h-2 rounded-full ${
                    metar.flightCategory === "VFR" ? "bg-[#66bb6a] animate-pulse" :
                    metar.flightCategory === "MVFR" ? "bg-[#42a5f5]" :
                    "bg-[#ef5350]"
                  }`}
                />
                <span
                  className={`text-[11px] font-medium px-1.5 py-0.5 rounded border ${
                    flightCategoryColor(metar.flightCategory).bg
                  } ${flightCategoryColor(metar.flightCategory).text} ${
                    flightCategoryColor(metar.flightCategory).border
                  }`}
                >
                  {metar.flightCategory}
                </span>
                <span className="text-[#9595a1]">LRIA</span>
              </>
            ) : (
              <span className="w-2 h-2 rounded-full bg-[#9595a1]" />
            )}
          </div>
        </div>

        {/* Card 2 — Terminal Heatmap */}
        <div className={cardClass(activeCard === "heatmap")} onClick={() => toggle("heatmap")}>
          <div className="flex items-center gap-2 text-xs text-[#9595a1] mb-1.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            Terminal Heatmap
          </div>
          <div className="text-[15px] font-semibold text-[#f3f3f6] mb-1">
            481 passengers
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[#9595a1]">
            <span className="w-2 h-2 rounded-full bg-[#ffa726]" />
            Live · Gate C3 alert
          </div>
        </div>

        {/* Card 3 — SMS / Identity Verification */}
        <div className={cardClass(activeCard === "sms")} onClick={() => toggle("sms")}>
          <div className="flex items-center gap-2 text-xs text-[#9595a1] mb-1.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Number Verification + SIM Swap
          </div>
          <div
            className={`text-[15px] font-semibold mb-1 ${
              verifyResult?.decision === "ALLOW"
                ? "text-[#66bb6a]"
                : verifyResult?.decision === "BLOCK"
                ? "text-[#ef5350]"
                : "text-[#f3f3f6]"
            }`}
          >
            {verifyResult?.decision ?? "Idle"}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[#9595a1]">
            <span className="w-2 h-2 rounded-full bg-[#ffa726]" />
            CAMARA API ready
          </div>
        </div>
      </div>

      {/* Alert box */}
      <div className="mt-auto pt-4">
        <div className="bg-[rgba(239,83,80,0.15)] border border-[#ef5350] rounded-[10px] p-3">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-[#ef5350] mb-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Active Alert
          </div>
          <p className="text-xs text-[#ef5350] opacity-90">
            Gate C3 congestion — QoD band allocated to cameras.
          </p>
        </div>
      </div>
    </div>
  );
}

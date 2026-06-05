"use client";

import { useState, useEffect } from "react";
import type { ActiveCard, BottomTab, DemoState, VerifyResult, LocationResult } from "@/app/page";
import type { MetarResponse } from "@/app/api/metar/route";
import MetarPanel from "@/components/MetarPanel";
import PhoneMockup from "@/components/PhoneMockup";
import DemoControls from "@/components/DemoControls";

interface Props {
  activeCard: ActiveCard;
  activeTab: BottomTab;
  metar: MetarResponse | null;
  metarLoading: boolean;
  verifyResult: VerifyResult | null;
  locationResult: LocationResult | null;
  demoState: DemoState;
  lastUpdated: Date | null;
  onVerifyLegit: () => void;
  onVerifyFraud: () => void;
  onLocation: () => void;
}

export default function CenterPanel(props: Props) {
  const {
    activeCard, activeTab, metar, metarLoading,
    verifyResult, locationResult, demoState, lastUpdated,
    onVerifyLegit, onVerifyFraud, onLocation,
  } = props;

  return (
    <div
      className="bg-[#1c1c21] border border-[#2f2f38] rounded-2xl flex flex-col overflow-hidden"
      style={{ gridColumn: "2", gridRow: "1 / 3" }}
    >
      <CenterHeader activeCard={activeCard} lastUpdated={lastUpdated} />

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
          <div className="flex-1 overflow-y-auto">
            <MetarPanel metar={metar} isLoading={metarLoading} />
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
          /* Default: heatmap / floor plan */
          <FloorPlanView />
        )}
      </div>
    </div>
  );
}

// ─── CenterHeader ────────────────────────────────────────────────────────────

function CenterHeader({
  activeCard,
  lastUpdated,
}: {
  activeCard: ActiveCard;
  lastUpdated: Date | null;
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
    activeCard === "weather" ? "Weather & METAR — LFPG"
    : activeCard === "sms"   ? "Identity Verification"
    : "Terminal A — Top View";

  return (
    <div className="flex justify-between items-center px-5 py-4 border-b border-[#2f2f38] shrink-0">
      <span className="text-[15px] font-semibold text-[#f3f3f6]">{title}</span>
      <div className="flex gap-2">
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

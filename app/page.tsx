"use client";

import { useState, useEffect } from "react";
import PhoneMockup from "@/components/PhoneMockup";
import OpsPanel from "@/components/OpsPanel";
import DemoControls from "@/components/DemoControls";
import MetarPanel from "@/components/MetarPanel";
import type { MetarResponse } from "@/app/api/metar/route";

export type Decision = "ALLOW" | "BLOCK" | null;
export type DemoState = "idle" | "loading" | "done";

export interface VerifyResult {
  verified: boolean;
  simSwapped: boolean;
  decision: Decision;
  phoneNumber: string;
  timestamp: string;
  raw: unknown;
  fromFixture?: boolean;
}

export interface LocationResult {
  phoneNumber: string;
  timestamp: string;
  location: {
    latitude: number | null;
    longitude: number | null;
    radius: number | null;
    lastSeen: string | null;
  };
  fromFixture?: boolean;
}

export interface LogEntry {
  id: number;
  time: string;
  type: "verify" | "location" | "error";
  message: string;
  decision?: Decision;
}

let logIdCounter = 0;

export default function Home() {
  // ── Passenger identity state ──────────────────────────────────────────
  const [demoState, setDemoState] = useState<DemoState>("idle");
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [locationResult, setLocationResult] = useState<LocationResult | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  // ── METAR state ───────────────────────────────────────────────────────
  const [metarData, setMetarData] = useState<MetarResponse | null>(null);
  const [metarLoading, setMetarLoading] = useState<boolean>(true);

  // ── Mobile panel toggle ───────────────────────────────────────────────
  const [activePanel, setActivePanel] = useState<"ops" | "pax">("ops");

  // Fetch METAR on mount, then every 60s
  useEffect(() => {
    async function fetchMetar() {
      setMetarLoading(true);
      try {
        const res = await fetch("/api/metar");
        const data: MetarResponse = await res.json();
        setMetarData(data);
      } catch {
        // keep previous data on refresh failure
      } finally {
        setMetarLoading(false);
      }
    }
    fetchMetar();
    const id = setInterval(fetchMetar, 60_000);
    return () => clearInterval(id);
  }, []);

  function addLog(entry: Omit<LogEntry, "id" | "time">) {
    setLog((prev) => [
      {
        ...entry,
        id: ++logIdCounter,
        time: new Date().toLocaleTimeString(),
      },
      ...prev.slice(0, 19),
    ]);
  }

  async function handleVerify(scenario: "legit" | "fraud") {
    setDemoState("loading");
    setVerifyResult(null);
    setLocationResult(null);

    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario }),
      });
      const data: VerifyResult = await res.json();
      setVerifyResult(data);
      setDemoState("done");

      addLog({
        type: "verify",
        message: `Passenger ${data.phoneNumber} — SIM swap: ${data.simSwapped ? "YES (recent)" : "No"} → ${data.decision}`,
        decision: data.decision,
      });
    } catch {
      setDemoState("done");
      addLog({ type: "error", message: "Verify call failed" });
    }
  }

  async function handleLocation() {
    setDemoState("loading");

    try {
      const res = await fetch("/api/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data: LocationResult = await res.json();
      setLocationResult(data);
      setDemoState("done");

      addLog({
        type: "location",
        message: `Location: ${data.location.latitude?.toFixed(4)}, ${data.location.longitude?.toFixed(4)} ±${data.location.radius}m`,
      });
    } catch {
      setDemoState("done");
      addLog({ type: "error", message: "Location call failed" });
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="border-b border-white/10 px-6 py-3 flex items-center gap-3 shrink-0">
        <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-xs font-bold shrink-0">
          O
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-widest uppercase text-orange-400">
            Smart Airport Connectivity
          </h1>
          <p className="text-[10px] text-gray-500">
            Orange CAMARA Network APIs · Playground Demo
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {/* Mobile panel toggle */}
          <div className="flex lg:hidden gap-1">
            <button
              onClick={() => setActivePanel("ops")}
              className={`text-[11px] font-mono px-2.5 py-1 rounded border transition-colors ${
                activePanel === "ops"
                  ? "border-cyan-500/60 bg-cyan-900/30 text-cyan-300"
                  : "border-white/10 text-gray-600"
              }`}
            >
              Ops
            </button>
            <button
              onClick={() => setActivePanel("pax")}
              className={`text-[11px] font-mono px-2.5 py-1 rounded border transition-colors ${
                activePanel === "pax"
                  ? "border-orange-500/60 bg-orange-900/30 text-orange-300"
                  : "border-white/10 text-gray-600"
              }`}
            >
              Passenger
            </button>
          </div>
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-gray-400 hidden sm:inline">Fixture mode</span>
        </div>
      </header>

      {/* ── Main layout ───────────────────────────────────────────────── */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[3fr_2fr] overflow-hidden min-h-0">

        {/* ── Left: Airport Operations / METAR ────────────────────────── */}
        <div className={`border-r border-white/10 overflow-y-auto ${activePanel === "pax" ? "hidden lg:block" : "block"}`}>
          {/* Panel label */}
          <div className="border-b border-white/5 px-5 py-2 bg-[#07090f]">
            <span className="text-[10px] font-mono text-cyan-700 uppercase tracking-widest">
              ◉ Airport Personnel — Meteorological
            </span>
          </div>
          <MetarPanel metar={metarData} isLoading={metarLoading} />
        </div>

        {/* ── Right: Passenger identity flow ──────────────────────────── */}
        <div className={`flex flex-col min-h-0 overflow-hidden ${activePanel === "ops" ? "hidden lg:flex" : "flex"}`}>
          {/* Panel label */}
          <div className="border-b border-white/10 px-4 py-2 shrink-0">
            <span className="text-[10px] font-mono text-orange-700 uppercase tracking-widest">
              ◉ Passenger — Identity Verification
            </span>
          </div>

          {/* Phone mockup + controls — scrollable */}
          <div className="flex flex-col items-center gap-6 p-6 border-b border-white/10 overflow-y-auto shrink-0">
            <PhoneMockup
              demoState={demoState}
              verifyResult={verifyResult}
              locationResult={locationResult}
            />
            <DemoControls
              demoState={demoState}
              onVerifyLegit={() => handleVerify("legit")}
              onVerifyFraud={() => handleVerify("fraud")}
              onLocation={handleLocation}
            />
          </div>

          {/* OpsPanel fills remaining height */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <OpsPanel
              verifyResult={verifyResult}
              locationResult={locationResult}
              log={log}
              demoState={demoState}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

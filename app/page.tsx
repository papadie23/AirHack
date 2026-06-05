"use client";

import { useState } from "react";
import PhoneMockup from "@/components/PhoneMockup";
import OpsPanel from "@/components/OpsPanel";
import DemoControls from "@/components/DemoControls";

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
  const [demoState, setDemoState] = useState<DemoState>("idle");
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [locationResult, setLocationResult] = useState<LocationResult | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

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
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-xs font-bold">
          O
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-widest uppercase text-orange-400">
            Smart Airport Connectivity
          </h1>
          <p className="text-xs text-gray-500">
            Orange CAMARA Network APIs · Playground Demo
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-gray-400">Fixture mode active</span>
        </div>
      </header>

      {/* Main layout */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-0 overflow-hidden">
        {/* Left: Phone mockup + Demo controls */}
        <div className="flex flex-col items-center justify-start gap-8 p-8 border-r border-white/10">
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

        {/* Right: Ops / terminal panel */}
        <OpsPanel
          verifyResult={verifyResult}
          locationResult={locationResult}
          log={log}
          demoState={demoState}
        />
      </main>
    </div>
  );
}

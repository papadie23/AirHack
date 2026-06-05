"use client";

import { useState, useEffect } from "react";
import LeftSidebar from "@/components/LeftSidebar";
import CenterPanel from "@/components/CenterPanel";
import RightSidebar from "@/components/RightSidebar";
import BottomBar from "@/components/BottomBar";
import type { MetarResponse, MetarProvider } from "@/app/api/metar/route";
import type { WeatherResponse, WeatherProvider } from "@/app/api/weather/route";

// ── Exported types used by child components ──────────────────────────────────

export type Decision = "ALLOW" | "BLOCK" | null;
export type DemoState = "idle" | "loading" | "done";
export type ActiveCard = "weather" | "heatmap" | "sms" | null;
export type BottomTab = "operator" | "passengers" | "settings" | "architecture";

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
  // ── Identity verification state ───────────────────────────────────────
  const [demoState, setDemoState] = useState<DemoState>("idle");
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [locationResult, setLocationResult] = useState<LocationResult | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  // ── METAR state ───────────────────────────────────────────────────────
  const [metarData, setMetarData] = useState<MetarResponse | null>(null);
  const [metarLoading, setMetarLoading] = useState<boolean>(true);
  const [metarProvider, setMetarProvider] = useState<MetarProvider>("noaa");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // ── Weather state ─────────────────────────────────────────────────────
  const [weatherData, setWeatherData] = useState<WeatherResponse | null>(null);
  const [weatherLoading, setWeatherLoading] = useState<boolean>(true);
  const [weatherProvider, setWeatherProvider] = useState<WeatherProvider>("open-meteo");

  // ── UI state ──────────────────────────────────────────────────────────
  const [activeCard, setActiveCard] = useState<ActiveCard>(null);
  const [activeTab, setActiveTab] = useState<BottomTab>("operator");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // METAR fetch on mount + when provider changes + 60s refresh
  useEffect(() => {
    async function fetchMetar() {
      setMetarLoading(true);
      try {
        const res = await fetch(`/api/metar?provider=${metarProvider}`);
        const data: MetarResponse = await res.json();
        setMetarData(data);
        setLastUpdated(new Date());
      } catch {
        // keep previous data on failure
      } finally {
        setMetarLoading(false);
      }
    }
    fetchMetar();
    const id = setInterval(fetchMetar, 60_000);
    return () => clearInterval(id);
  }, [metarProvider]);

  // Weather fetch on mount + when provider changes + 5min refresh
  useEffect(() => {
    async function fetchWeather() {
      setWeatherLoading(true);
      try {
        const res = await fetch(`/api/weather?provider=${weatherProvider}`);
        const data: WeatherResponse = await res.json();
        setWeatherData(data);
      } catch {
        // keep previous data on failure
      } finally {
        setWeatherLoading(false);
      }
    }
    fetchWeather();
    const id = setInterval(fetchWeather, 300_000);
    return () => clearInterval(id);
  }, [weatherProvider]);

  function addLog(entry: Omit<LogEntry, "id" | "time">) {
    setLog((prev) => [
      { ...entry, id: ++logIdCounter, time: new Date().toLocaleTimeString() },
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
        message: `${data.phoneNumber} — SIM swap: ${data.simSwapped ? "YES" : "No"} → ${data.decision}`,
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
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "300px 1fr 300px",
        gridTemplateRows: "1fr auto",
        gap: "16px",
        padding: "16px",
        height: "100vh",
        boxSizing: "border-box",
      }}
    >
      <LeftSidebar
        activeCard={activeCard}
        onSelectCard={setActiveCard}
        metar={metarData}
        verifyResult={verifyResult}
        demoState={demoState}
      />

      <CenterPanel
        activeCard={activeCard}
        activeTab={activeTab}
        metar={metarData}
        metarLoading={metarLoading}
        metarProvider={metarProvider}
        onMetarProviderChange={setMetarProvider}
        verifyResult={verifyResult}
        locationResult={locationResult}
        demoState={demoState}
        lastUpdated={lastUpdated}
        onVerifyLegit={() => handleVerify("legit")}
        onVerifyFraud={() => handleVerify("fraud")}
        onLocation={handleLocation}
        weatherData={weatherData}
        weatherLoading={weatherLoading}
        theme={theme}
        onThemeToggle={() => setTheme(t => t === "dark" ? "light" : "dark")}
      />

      <RightSidebar
        log={log}
        demoState={demoState}
        weatherData={weatherData}
        weatherLoading={weatherLoading}
        weatherProvider={weatherProvider}
        onWeatherProviderChange={setWeatherProvider}
      />

      <BottomBar activeTab={activeTab} onSelectTab={setActiveTab} />
    </div>
  );
}

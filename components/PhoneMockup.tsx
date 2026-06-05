"use client";

import { DemoState, VerifyResult, LocationResult } from "@/app/page";

interface Props {
  demoState: DemoState;
  verifyResult: VerifyResult | null;
  locationResult: LocationResult | null;
}

export default function PhoneMockup({ demoState, verifyResult, locationResult }: Props) {
  const decision = verifyResult?.decision ?? null;
  const isAllow = decision === "ALLOW";
  const isBlock = decision === "BLOCK";

  return (
    <div className="relative w-[280px] flex-shrink-0">
      {/* Phone frame */}
      <div
        className={`
          relative w-full rounded-[2.5rem] border-4 overflow-hidden shadow-2xl transition-all duration-500
          ${isAllow ? "border-green-500 shadow-green-500/30" : ""}
          ${isBlock ? "border-red-500 shadow-red-500/40" : ""}
          ${!decision ? "border-gray-700" : ""}
        `}
        style={{ minHeight: 520 }}
      >
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-[#0b0f1a] rounded-b-2xl z-10" />

        {/* Screen */}
        <div className="bg-[#0f1627] flex flex-col h-full" style={{ minHeight: 512 }}>
          {/* Status bar */}
          <div className="flex justify-between items-center px-6 pt-8 pb-2 text-[10px] text-gray-500">
            <span>09:41</span>
            <span className="flex gap-1">
              <span>▲▲▲</span>
              <span>WiFi</span>
              <span>🔋</span>
            </span>
          </div>

          {/* Airport branding */}
          <div className="text-center py-4 border-b border-white/5">
            <p className="text-xs text-orange-400 font-medium tracking-widest uppercase">
              CDG Terminal 2F
            </p>
            <p className="text-[10px] text-gray-600 mt-0.5">Gate K42 · Paris Charles de Gaulle</p>
          </div>

          {/* Main content area */}
          <div className="flex-1 flex flex-col items-center justify-center px-5 gap-4 py-6">
            {demoState === "idle" && (
              <IdleScreen />
            )}

            {demoState === "loading" && (
              <LoadingScreen />
            )}

            {demoState === "done" && verifyResult && (
              <VerifyScreen result={verifyResult} />
            )}

            {demoState === "done" && locationResult && !verifyResult && (
              <LocationScreen result={locationResult} />
            )}
          </div>

          {/* Bottom bar */}
          <div className="border-t border-white/5 px-5 py-3 flex justify-around text-[10px] text-gray-600">
            <span>Home</span>
            <span>Services</span>
            <span>Alerts</span>
          </div>
        </div>
      </div>

      {/* Glow label */}
      <p className="text-center mt-3 text-xs text-gray-600 font-mono">
        Passenger Device
      </p>
    </div>
  );
}

function IdleScreen() {
  return (
    <div className="text-center flex flex-col items-center gap-3">
      <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-700 flex items-center justify-center text-3xl">
        ✈
      </div>
      <p className="text-sm text-gray-400">Awaiting verification</p>
      <p className="text-[10px] text-gray-600 max-w-[180px] leading-relaxed">
        Press a demo button to simulate a passenger boarding event
      </p>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="text-center flex flex-col items-center gap-4">
      <div className="w-12 h-12 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
      <p className="text-sm text-orange-400 animate-pulse">Verifying identity…</p>
      <div className="flex flex-col gap-1 w-full text-[10px] text-gray-600 font-mono">
        <p>→ Checking number ownership</p>
        <p>→ Querying SIM swap history</p>
        <p>→ Computing risk score</p>
      </div>
    </div>
  );
}

function VerifyScreen({ result }: { result: VerifyResult }) {
  const isAllow = result.decision === "ALLOW";

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Decision badge */}
      <div
        className={`
          w-full rounded-xl p-4 text-center transition-all
          ${isAllow ? "bg-green-900/40 border border-green-500/40" : "bg-red-900/40 border border-red-500/40"}
        `}
      >
        <div className={`text-3xl mb-1 ${isAllow ? "text-green-400" : "text-red-400"}`}>
          {isAllow ? "✓" : "✗"}
        </div>
        <p className={`text-lg font-bold ${isAllow ? "text-green-300" : "text-red-300"}`}>
          {isAllow ? "BOARDING APPROVED" : "ACCESS DENIED"}
        </p>
        <p className="text-[10px] text-gray-500 mt-1">
          {isAllow
            ? "Identity verified · No anomalies"
            : "SIM swap detected · Fraud risk"}
        </p>
      </div>

      {/* Detail rows */}
      <div className="flex flex-col gap-1.5 text-[11px] font-mono">
        <DetailRow
          label="Number verified"
          value={result.verified ? "YES" : "NO"}
          ok={result.verified}
        />
        <DetailRow
          label="SIM swap"
          value={result.simSwapped ? "RECENT" : "CLEAN"}
          ok={!result.simSwapped}
        />
        <DetailRow label="Phone" value={result.phoneNumber} />
      </div>

      {/* Notification strip */}
      {!isAllow && (
        <div className="rounded-lg bg-red-950/60 border border-red-800/40 px-3 py-2 text-[10px] text-red-300">
          ⚠ Security alert sent to gate agent
        </div>
      )}
      {isAllow && (
        <div className="rounded-lg bg-green-950/60 border border-green-800/40 px-3 py-2 text-[10px] text-green-300">
          ✓ Boarding pass activated · Gate K42
        </div>
      )}
    </div>
  );
}

function LocationScreen({ result }: { result: LocationResult }) {
  const { latitude, longitude, radius, lastSeen } = result.location;
  return (
    <div className="w-full flex flex-col gap-3">
      <div className="rounded-xl bg-blue-900/30 border border-blue-500/30 p-4 text-center">
        <div className="text-3xl text-blue-400 mb-1">📍</div>
        <p className="text-sm font-bold text-blue-300">Location Retrieved</p>
        <p className="text-[10px] text-gray-500 mt-1">Terminal zone confirmed</p>
      </div>

      <div className="flex flex-col gap-1.5 text-[11px] font-mono">
        <DetailRow label="Latitude" value={latitude?.toFixed(5) ?? "—"} />
        <DetailRow label="Longitude" value={longitude?.toFixed(5) ?? "—"} />
        <DetailRow label="Accuracy" value={radius ? `±${radius}m` : "—"} />
        <DetailRow
          label="Last seen"
          value={lastSeen ? new Date(lastSeen).toLocaleTimeString() : "—"}
        />
      </div>

      <div className="rounded-lg bg-blue-950/60 border border-blue-800/40 px-3 py-2 text-[10px] text-blue-300">
        📢 Gate notification sent: "Boarding now open"
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok?: boolean;
}) {
  return (
    <div className="flex justify-between items-center bg-white/5 rounded px-2 py-1">
      <span className="text-gray-500">{label}</span>
      <span
        className={
          ok === true
            ? "text-green-400"
            : ok === false
            ? "text-red-400"
            : "text-gray-300"
        }
      >
        {value}
      </span>
    </div>
  );
}

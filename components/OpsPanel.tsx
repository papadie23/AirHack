"use client";

import { DemoState, VerifyResult, LocationResult, LogEntry } from "@/app/page";

interface Props {
  verifyResult: VerifyResult | null;
  locationResult: LocationResult | null;
  log: LogEntry[];
  demoState: DemoState;
}

export default function OpsPanel({ verifyResult, locationResult, log, demoState }: Props) {
  return (
    <div className="flex flex-col h-full bg-[#080c18] border-l border-white/10">
      {/* Header */}
      <div className="border-b border-white/10 px-4 py-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-orange-500" />
        <span className="text-xs font-mono font-semibold text-gray-300 tracking-wider">
          NETWORK API TERMINAL
        </span>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-0 divide-y divide-white/5">
        {/* Current decision card */}
        {verifyResult && (
          <section className="p-4">
            <p className="text-[10px] text-gray-600 font-mono uppercase tracking-widest mb-2">
              Latest Decision
            </p>
            <DecisionCard result={verifyResult} />
          </section>
        )}

        {/* Location card */}
        {locationResult && (
          <section className="p-4">
            <p className="text-[10px] text-gray-600 font-mono uppercase tracking-widest mb-2">
              Location Result
            </p>
            <LocationCard result={locationResult} />
          </section>
        )}

        {/* Raw payload */}
        {(verifyResult || locationResult) && (
          <section className="p-4">
            <p className="text-[10px] text-gray-600 font-mono uppercase tracking-widest mb-2">
              API Response (raw)
            </p>
            <pre className="text-[10px] font-mono text-gray-400 bg-black/40 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(verifyResult ?? locationResult, null, 2)}
            </pre>
          </section>
        )}

        {/* Activity log */}
        <section className="p-4 flex-1">
          <p className="text-[10px] text-gray-600 font-mono uppercase tracking-widest mb-2">
            Activity Log
          </p>
          {log.length === 0 && demoState === "idle" && (
            <p className="text-[10px] text-gray-700 font-mono italic">
              No events yet. Press a demo control.
            </p>
          )}
          {demoState === "loading" && (
            <div className="flex items-center gap-2 text-[10px] text-orange-400 font-mono animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
              Calling Orange CAMARA API…
            </div>
          )}
          <div className="flex flex-col gap-1.5 mt-1">
            {log.map((entry) => (
              <LogRow key={entry.id} entry={entry} />
            ))}
          </div>
        </section>
      </div>

      {/* Footer legend */}
      <div className="border-t border-white/10 px-4 py-2 flex gap-4 text-[10px] font-mono text-gray-700">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> ALLOW
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> BLOCK
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> LOCATION
        </span>
        <span className="ml-auto">Orange CAMARA Playground</span>
      </div>
    </div>
  );
}

function DecisionCard({ result }: { result: VerifyResult }) {
  const isAllow = result.decision === "ALLOW";
  return (
    <div
      className={`
        rounded-xl border p-3 font-mono text-xs transition-all duration-300
        ${isAllow
          ? "border-green-500/40 bg-green-900/20"
          : "border-red-500/40 bg-red-900/20"
        }
      `}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`font-bold text-sm ${isAllow ? "text-green-400" : "text-red-400"}`}>
          {result.decision}
        </span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
          isAllow ? "bg-green-900/60 text-green-400" : "bg-red-900/60 text-red-400"
        }`}>
          {isAllow ? "✓ Cleared" : "✗ Blocked"}
        </span>
      </div>
      <div className="flex flex-col gap-1 text-[11px]">
        <Row label="Phone" value={result.phoneNumber} />
        <Row
          label="Number verified"
          value={result.verified ? "true" : "false"}
          highlight={result.verified ? "green" : "red"}
        />
        <Row
          label="SIM swapped"
          value={result.simSwapped ? "true" : "false"}
          highlight={result.simSwapped ? "red" : "green"}
        />
        <Row label="Timestamp" value={new Date(result.timestamp).toLocaleTimeString()} />
        {result.fromFixture && (
          <Row label="Source" value="fixture" highlight="yellow" />
        )}
      </div>
    </div>
  );
}

function LocationCard({ result }: { result: LocationResult }) {
  const { latitude, longitude, radius, lastSeen } = result.location;
  return (
    <div className="rounded-xl border border-blue-500/30 bg-blue-900/20 p-3 font-mono text-xs">
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-sm text-blue-400">LOCATION</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-400">
          ✓ Retrieved
        </span>
      </div>
      <div className="flex flex-col gap-1 text-[11px]">
        <Row label="Latitude" value={latitude?.toFixed(6) ?? "—"} />
        <Row label="Longitude" value={longitude?.toFixed(6) ?? "—"} />
        <Row label="Radius" value={radius ? `${radius}m` : "—"} />
        <Row
          label="Last seen"
          value={lastSeen ? new Date(lastSeen).toLocaleTimeString() : "—"}
        />
        {result.fromFixture && (
          <Row label="Source" value="fixture" highlight="yellow" />
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "green" | "red" | "yellow";
}) {
  const color =
    highlight === "green"
      ? "text-green-400"
      : highlight === "red"
      ? "text-red-400"
      : highlight === "yellow"
      ? "text-yellow-400"
      : "text-gray-400";
  return (
    <div className="flex justify-between">
      <span className="text-gray-600">{label}</span>
      <span className={color}>{value}</span>
    </div>
  );
}

function LogRow({ entry }: { entry: LogEntry }) {
  const dot =
    entry.decision === "ALLOW"
      ? "bg-green-500"
      : entry.decision === "BLOCK"
      ? "bg-red-500"
      : entry.type === "location"
      ? "bg-blue-500"
      : "bg-yellow-500";

  return (
    <div className="flex items-start gap-2 text-[10px] font-mono">
      <span className="text-gray-600 shrink-0 mt-0.5">{entry.time}</span>
      <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${dot}`} />
      <span className="text-gray-400">{entry.message}</span>
    </div>
  );
}

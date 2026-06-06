/**
 * TrafficFlowCenter.tsx
 * Dashboard panel for Airport Flow Optimization (video-flow feature).
 * – Real-time occupancy bars for Gate 1, Gate 2, Disembarkation
 * – Live AI Dispatcher Log (rule-based or LLM-generated alerts)
 * – Staff chat interface backed by /api/traffic-chat
 */
import { useState, useEffect, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import type { TrafficSnapshot, ZoneReading } from "../lib/video-flow";
import { appendHistory, createHistory } from "../lib/video-flow";
import type { AnalysisReport, ChatMessage } from "../lib/llm-dispatcher";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const POLL_INTERVAL = 4000; // ms between data fetches
const ANALYSIS_INTERVAL = 20000; // ms between full AI analysis runs

// Python MJPEG stream server base URL (run video_analytics/stream_server.py)
const STREAM_BASE = "http://localhost:5001";
const STREAM_ZONE: Record<string, string> = {
  gate1:     `${STREAM_BASE}/stream/gate`,
  gate2:     `${STREAM_BASE}/stream/checkin`,
  disembark: `${STREAM_BASE}/stream/disembark`,
};

// ── Colour palette — explicit bright values so Chart.js resolves them correctly ─
const ZONE_COLORS: Record<string, string> = {
  gate1:     "#4FC3F7",   // bright sky blue
  gate2:     "#FF8A50",   // bright orange
  disembark: "#FFD54F",   // bright amber
};

const ALERT_COLORS: Record<string, string> = {
  normal:   "var(--success)",
  warning:  "var(--warning)",
  critical: "var(--danger)",
};

const SEVERITY_ICON: Record<string, string> = {
  low:    "ti-info-circle",
  medium: "ti-alert-triangle",
  high:   "ti-alert-octagon",
};

const SEVERITY_COLOR: Record<string, string> = {
  low:    "var(--info)",
  medium: "var(--warning)",
  high:   "var(--danger)",
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function OccupancyBar({ reading, onClick }: { reading: ZoneReading; onClick: () => void }) {
  const pct = Math.min(100, Math.round((reading.count / reading.capacity) * 100));
  const color = ALERT_COLORS[reading.alertLevel];
  const zoneColor = ZONE_COLORS[reading.zoneId] ?? "#4FC3F7";

  return (
    <div
      onClick={onClick}
      style={{
        marginBottom: 14,
        cursor: "pointer",
        padding: "8px 10px",
        borderRadius: "var(--radius-md)",
        border: "1px solid transparent",
        transition: "border-color 0.2s, background 0.2s",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = zoneColor + "66";
        (e.currentTarget as HTMLDivElement).style.background = zoneColor + "11";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "transparent";
        (e.currentTarget as HTMLDivElement).style.background = "transparent";
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: zoneColor, display: "inline-block", flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-main)" }}>{reading.label}</span>
          <i className="ti ti-camera" style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 2 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {reading.trend === "up"     && <i className="ti ti-trending-up"   style={{ fontSize: 13, color: "var(--danger)" }} />}
          {reading.trend === "down"   && <i className="ti ti-trending-down" style={{ fontSize: 13, color: "var(--success)" }} />}
          {reading.trend === "stable" && <i className="ti ti-minus"         style={{ fontSize: 13, color: "var(--text-muted)" }} />}
          <span style={{ fontSize: 13, fontWeight: 700, color }}>{reading.count}<span style={{ color: "var(--text-muted)", fontWeight: 400 }}>/{reading.capacity}</span></span>
          <span style={{ fontSize: 11, background: color + "22", color, borderRadius: 6, padding: "2px 7px", fontWeight: 600 }}>
            {pct}%
          </span>
        </div>
      </div>
      <div style={{ height: 8, background: "var(--bg-body)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

function ZoneModal({ reading, onClose }: { reading: ZoneReading; onClose: () => void }) {
  const [streamOk, setStreamOk] = useState(true);
  const streamUrl = STREAM_ZONE[reading.zoneId];
  const zoneColor = ZONE_COLORS[reading.zoneId] ?? "#4FC3F7";
  const pct = Math.min(100, Math.round((reading.count / reading.capacity) * 100));
  const alertColor = ALERT_COLORS[reading.alertLevel];

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.75)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{
        background: "var(--bg-card)",
        borderRadius: 14,
        border: `1px solid ${zoneColor}44`,
        width: "100%",
        maxWidth: 700,
        boxShadow: `0 0 40px ${zoneColor}22`,
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px",
          borderBottom: "1px solid var(--border-color)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: zoneColor, display: "inline-block" }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-main)" }}>{reading.label}</span>
            <span style={{
              fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 600,
              background: alertColor + "22", color: alertColor,
            }}>
              {reading.count}/{reading.capacity} · {pct}%
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "var(--bg-body)", border: "1px solid var(--border-color)",
              borderRadius: 8, color: "var(--text-muted)", cursor: "pointer",
              width: 30, height: 30, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <i className="ti ti-x" />
          </button>
        </div>

        {/* Video stream */}
        <div style={{ position: "relative", background: "#000", lineHeight: 0 }}>
          {streamOk ? (
            <img
              src={streamUrl}
              alt={`Live feed — ${reading.label}`}
              onError={() => setStreamOk(false)}
              style={{ width: "100%", maxHeight: 420, objectFit: "contain", display: "block" }}
            />
          ) : (
            /* Fallback: raw MP4 served by Astro — no YOLO boxes but video plays */
            <video
              key={reading.zoneId}
              src={`/api/video/${reading.zoneId}`}
              autoPlay
              loop
              muted
              playsInline
              style={{ width: "100%", maxHeight: 420, objectFit: "contain", display: "block" }}
            />
          )}

          {/* Live / Playback badge */}
          <div style={{
            position: "absolute", top: 10, left: 10,
            background: "rgba(0,0,0,0.65)", borderRadius: 20,
            padding: "3px 10px", fontSize: 11, fontWeight: 600,
            color: streamOk ? "#4ade80" : "#FBBF24",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background: streamOk ? "#4ade80" : "#FBBF24",
              display: "inline-block",
              animation: streamOk ? "pulse-green 2s infinite" : "none",
            }} />
            {streamOk ? "LIVE · CV Detection" : "Playback · no AI (start stream_server.py)"}
          </div>
        </div>

        {/* Footer hint */}
        <div style={{ padding: "10px 18px", fontSize: 11, color: "var(--text-muted)" }}>
          <i className="ti ti-box" style={{ marginRight: 5, color: "#4ade80" }} />
          Cutii verzi = persoane detectate de YOLO · Apasă în afara ferestrei pentru a închide
        </div>
      </div>
    </div>
  );
}

function DispatcherLog({ report }: { report: AnalysisReport | null }) {
  if (!report) {
    return (
      <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px 0" }}>
        <i className="ti ti-loader-2" style={{ marginRight: 6 }} /> Se analizează situația...
      </div>
    );
  }

  return (
    <div>
      <div style={{
        fontSize: 12,
        padding: "8px 12px",
        borderRadius: "var(--radius-md)",
        background: "var(--bg-body)",
        marginBottom: 10,
        color: "var(--text-main)",
        borderLeft: "3px solid var(--brand)",
      }}>
        {report.summary}
      </div>

      {report.alerts.length === 0 && (
        <div style={{ fontSize: 12, color: "var(--success)", display: "flex", alignItems: "center", gap: 6 }}>
          <i className="ti ti-circle-check" /> Nicio alertă activă — flux normal.
        </div>
      )}

      {report.alerts.map((alert, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            gap: 10,
            padding: "8px 10px",
            borderRadius: "var(--radius-md)",
            background: SEVERITY_COLOR[alert.severity] + "11",
            border: `1px solid ${SEVERITY_COLOR[alert.severity]}33`,
            marginBottom: 6,
          }}
        >
          <i
            className={`ti ${SEVERITY_ICON[alert.severity]}`}
            style={{ color: SEVERITY_COLOR[alert.severity], fontSize: 15, marginTop: 1, flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: SEVERITY_COLOR[alert.severity], marginBottom: 2 }}>
              {alert.message}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              <i className="ti ti-bulb" style={{ fontSize: 11, marginRight: 4 }} />{alert.suggestion}
            </div>
          </div>
        </div>
      ))}

      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{
          background: report.source === "llm" ? "var(--brand)22" : "var(--info)22",
          color: report.source === "llm" ? "var(--brand)" : "var(--info)",
          borderRadius: 4,
          padding: "1px 6px",
          fontWeight: 600,
        }}>
          {report.source === "llm" ? "Claude AI" : "Rule-based"}
        </span>
        {new Date(report.generatedAt).toLocaleTimeString("ro")}
      </div>
    </div>
  );
}

function ChatBox({ snapshot }: { snapshot: TrafficSnapshot | null }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Bună ziua! Sunt Dispatcher-ul AI al Aeroportului Iași. Cum vă pot ajuta cu fluxul de pasageri?" },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const msg = input.trim();
    if (!msg || sending) return;

    const newHistory: ChatMessage[] = [...messages, { role: "user", content: msg }];
    setMessages(newHistory);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/traffic-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history: messages }),
      });
      const data = await res.json() as { reply: string };
      setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Eroare de comunicare cu serverul." }]);
    } finally {
      setSending(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "4px 0",
        minHeight: 0,
      }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: m.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div style={{
              maxWidth: "85%",
              padding: "8px 12px",
              borderRadius: m.role === "user"
                ? "12px 12px 3px 12px"
                : "12px 12px 12px 3px",
              background: m.role === "user" ? "var(--brand)" : "var(--bg-body)",
              color: m.role === "user" ? "#fff" : "var(--text-main)",
              fontSize: 12,
              lineHeight: 1.5,
              border: m.role === "assistant" ? "1px solid var(--border-color)" : "none",
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div style={{ display: "flex" }}>
            <div style={{
              padding: "8px 12px",
              borderRadius: "12px 12px 12px 3px",
              background: "var(--bg-body)",
              border: "1px solid var(--border-color)",
              fontSize: 12,
              color: "var(--text-muted)",
            }}>
              <i className="ti ti-dots" style={{ animation: "pulse 1s infinite" }} /> Dispatcher se gândește...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Întreabă despre status, porți, aglomerare..."
          disabled={sending}
          style={{
            flex: 1,
            background: "var(--bg-body)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-md)",
            color: "var(--text-main)",
            fontSize: 12,
            padding: "8px 12px",
            outline: "none",
          }}
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          style={{
            background: "var(--brand)",
            border: "none",
            borderRadius: "var(--radius-md)",
            color: "#fff",
            padding: "8px 14px",
            cursor: sending || !input.trim() ? "default" : "pointer",
            opacity: sending || !input.trim() ? 0.5 : 1,
            fontSize: 14,
          }}
        >
          <i className="ti ti-send" />
        </button>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function TrafficFlowCenter({ onLog }: { onLog: (m: string, ok?: boolean) => void }) {
  const [snapshot, setSnapshot] = useState<TrafficSnapshot | null>(null);
  const [history, setHistory] = useState(createHistory());
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [activeTab, setActiveTab] = useState<"charts" | "chat">("charts");
  const [source, setSource] = useState<"mock" | "cv-live">("mock");
  const [activeZone, setActiveZone] = useState<ZoneReading | null>(null);

  // Poll traffic data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/video-flow-data");
        const data = await res.json() as TrafficSnapshot;
        setSnapshot(data);
        setHistory(prev => appendHistory(prev, data));
        setSource(data.source);
      } catch {
        onLog("Eroare la preluarea datelor trafic", false);
      }
    };

    fetchData();
    const id = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(id);
  }, []);

  // Periodic AI analysis via dedicated endpoint
  useEffect(() => {
    if (!snapshot) return;

    const runAnalysis = async () => {
      try {
        const res = await fetch("/api/traffic-analysis");
        const report = await res.json() as AnalysisReport;
        setReport(report);
        onLog("Analiză AI trafic actualizată", true);
      } catch {
        // silently ignore — keep previous report
      }
    };

    runAnalysis();
    const id = setInterval(runAnalysis, ANALYSIS_INTERVAL);
    return () => clearInterval(id);
  }, [!!snapshot]);

  // Build chart data from history
  const chartData = {
    labels: history.timestamps,
    datasets: [
      {
        label: "Poarta",
        data: history.gate1,
        borderColor: "#4FC3F7",
        backgroundColor: "rgba(79,195,247,0.12)",
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 2,
      },
      {
        label: "Check In",
        data: history.gate2,
        borderColor: "#FF8A50",
        backgroundColor: "rgba(255,138,80,0.12)",
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 2,
      },
      {
        label: "Sosiri",
        data: history.disembark,
        borderColor: "#FFD54F",
        backgroundColor: "rgba(255,213,79,0.12)",
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: {
      legend: {
        labels: { color: "#ccc", font: { size: 11 }, boxWidth: 12 },
      },
    },
    scales: {
      x: {
        ticks: { color: "#aaa", font: { size: 10 }, maxTicksLimit: 6 },
        grid: { color: "rgba(255,255,255,0.08)" },
      },
      y: {
        min: 0,
        ticks: { color: "#aaa", font: { size: 10 } },
        grid: { color: "rgba(255,255,255,0.08)" },
      },
    },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 0, minHeight: 0 }}>
      {/* ── Zone video modal ── */}
      {activeZone && (
        <ZoneModal reading={activeZone} onClose={() => setActiveZone(null)} />
      )}

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <i className="ti ti-eye" style={{ color: "var(--brand)" }} />
            Airport Flow Optimization
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            Computer Vision + AI Dispatcher · IAS Airport
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 10,
            padding: "3px 9px",
            borderRadius: 20,
            background: source === "cv-live" ? "var(--success-bg)" : "var(--info-bg)",
            color: source === "cv-live" ? "var(--success)" : "var(--info)",
            fontWeight: 600,
          }}>
            <span style={{
              display: "inline-block",
              width: 6, height: 6,
              borderRadius: "50%",
              background: source === "cv-live" ? "var(--success)" : "var(--info)",
              marginRight: 5,
              animation: "pulse-green 2s infinite",
            }} />
            {source === "cv-live" ? "CV Live" : "Mock Data"}
          </span>
        </div>
      </div>

      {/* ── Occupancy Bars ── */}
      <div style={{ background: "var(--bg-body)", borderRadius: "var(--radius-md)", padding: "14px 16px", marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Ocupanță zone — timp real
        </div>
        {snapshot
          ? snapshot.readings.map(r => (
              <OccupancyBar key={r.zoneId} reading={r} onClick={() => setActiveZone(r)} />
            ))
          : [1, 2, 3].map(i => (
              <div key={i} style={{ height: 36, background: "var(--bg-hover)", borderRadius: 6, marginBottom: 14, opacity: 0.5 }} />
            ))
        }
      </div>

      {/* ── Tab switcher ── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {(["charts", "chat"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: "7px 0",
              borderRadius: "var(--radius-md)",
              border: "1px solid",
              borderColor: activeTab === tab ? "var(--brand)" : "var(--border-color)",
              background: activeTab === tab ? "var(--brand)22" : "transparent",
              color: activeTab === tab ? "var(--brand)" : "var(--text-muted)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {tab === "charts"
              ? <><i className="ti ti-chart-line" style={{ marginRight: 5 }} />Grafic</>
              : <><i className="ti ti-message-chatbot" style={{ marginRight: 5 }} />Chat AI</>
            }
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {activeTab === "charts" && (
          <>
            {/* Time-series chart */}
            <div style={{ background: "var(--bg-body)", borderRadius: "var(--radius-md)", padding: "12px 14px", flex: "0 0 180px" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Evoluție (ultimele {history.timestamps.length} puncte)
              </div>
              <div style={{ height: 140 }}>
                {history.timestamps.length > 1
                  ? <Line data={chartData} options={chartOptions as object} />
                  : <div style={{ color: "var(--text-muted)", fontSize: 12, paddingTop: 40, textAlign: "center" }}>Se colectează date...</div>
                }
              </div>
            </div>

            {/* Dispatcher log */}
            <div style={{
              flex: 1,
              background: "var(--bg-body)",
              borderRadius: "var(--radius-md)",
              padding: "12px 14px",
              overflowY: "auto",
              minHeight: 0,
            }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <i className="ti ti-robot" style={{ marginRight: 5 }} />AI Dispatcher Log
              </div>
              <DispatcherLog report={report} />
            </div>
          </>
        )}

        {activeTab === "chat" && (
          <div style={{
            flex: 1,
            background: "var(--bg-body)",
            borderRadius: "var(--radius-md)",
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}>
            <ChatBox snapshot={snapshot} />
          </div>
        )}
      </div>
    </div>
  );
}

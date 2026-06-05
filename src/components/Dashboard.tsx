import { useState, useEffect, useRef } from "react";

type Feature = "weather" | "route" | "heatmap";

/* ── heatmap zones ── */
const ZONES = [
  { id: "security", label: "Securitate",  x: 20,  y: 20,  w: 160, h: 130, base: 210, limit: 150, dash: false },
  { id: "checkin",  label: "Check-in",    x: 200, y: 20,  w: 155, h: 130, base: 85,  limit: 120, dash: false },
  { id: "gates",    label: "Porți C1–C6", x: 375, y: 20,  w: 205, h: 130, base: 47,  limit: 200, dash: false },
  { id: "lounge",   label: "Lounge",      x: 20,  y: 255, w: 130, h: 120, base: 22,  limit: 40,  dash: false },
  { id: "dutyfree", label: "Duty Free",   x: 165, y: 255, w: 155, h: 120, base: 33,  limit: 60,  dash: false },
  { id: "gateC3",   label: "Poarta C3",   x: 340, y: 255, w: 245, h: 120, base: 89,  limit: 60,  dash: true  },
];
function randZ(base: number) { return Math.round(base * (0.85 + Math.random() * 0.3)); }
function heatColor(count: number, limit: number) {
  const r = count / limit;
  return r < 0.55 ? "var(--success)" : r < 0.85 ? "var(--warning)" : "var(--danger)";
}

/* ── flights / route ── */
const FLIGHTS = [
  { id: "1", gate: "4",  flight: "RO 321",  dest: "București OTP", departs: "23:15", color: "var(--success)" },
  { id: "2", gate: "2",  flight: "W6 4102", dest: "Londra LTN",    departs: "23:45", color: "var(--info)"    },
  { id: "3", gate: "T3", flight: "LH 1407", dest: "Frankfurt FRA", departs: "00:10", color: "var(--warning)" },
  { id: "4", gate: "5",  flight: "FR 8821", dest: "Milano BGY",    departs: "00:30", color: "var(--brand)"   },
  { id: "5", gate: "T3", flight: "AF 1234", dest: "Paris CDG",     departs: "06:45", color: "var(--danger)"  },
];

// Coordonate calibrate pe harta reală T4 Iași (% din dimensiunea imaginii)
// Nivel 0: intrare → check-in → control securitate → acces etaj
// Nivel 1: Schengen porți 5-10 (jos), Non-Schengen porți 11-15 (sus)
const GATE_POSITIONS: Record<string, { x: number; y: number; label: string }> = {
  "5":  { x: 52, y: 78, label: "Poarta 5"  },
  "6":  { x: 59, y: 78, label: "Poarta 6"  },
  "7":  { x: 65, y: 78, label: "Poarta 7"  },
  "8":  { x: 71, y: 78, label: "Poarta 8"  },
  "9":  { x: 77, y: 78, label: "Poarta 9"  },
  "10": { x: 83, y: 78, label: "Poarta 10" },
  "11": { x: 68, y: 28, label: "Poarta 11" },
  "12": { x: 76, y: 28, label: "Poarta 12" },
  "14": { x: 87, y: 28, label: "Poarta 14" },
  "15": { x: 95, y: 28, label: "Poarta 15" },
};

const USER_START = { x: 8, y: 82 };

const ROUTE_WAYPOINTS: Record<string, { x: number; y: number }[]> = {
  "5":  [{x:8,y:82},{x:8,y:62},{x:18,y:58},{x:28,y:52},{x:42,y:52},{x:42,y:65},{x:52,y:72},{x:52,y:78}],
  "6":  [{x:8,y:82},{x:8,y:62},{x:18,y:58},{x:28,y:52},{x:42,y:52},{x:42,y:65},{x:59,y:72},{x:59,y:78}],
  "7":  [{x:8,y:82},{x:8,y:62},{x:18,y:58},{x:28,y:52},{x:42,y:52},{x:42,y:65},{x:65,y:72},{x:65,y:78}],
  "8":  [{x:8,y:82},{x:8,y:62},{x:18,y:58},{x:28,y:52},{x:42,y:52},{x:42,y:65},{x:71,y:72},{x:71,y:78}],
  "9":  [{x:8,y:82},{x:8,y:62},{x:18,y:58},{x:28,y:52},{x:42,y:52},{x:42,y:65},{x:77,y:72},{x:77,y:78}],
  "10": [{x:8,y:82},{x:8,y:62},{x:18,y:58},{x:28,y:52},{x:42,y:52},{x:42,y:65},{x:83,y:72},{x:83,y:78}],
  "11": [{x:8,y:82},{x:8,y:62},{x:18,y:58},{x:28,y:52},{x:42,y:52},{x:55,y:45},{x:68,y:35},{x:68,y:28}],
  "12": [{x:8,y:82},{x:8,y:62},{x:18,y:58},{x:28,y:52},{x:42,y:52},{x:55,y:45},{x:76,y:35},{x:76,y:28}],
  "14": [{x:8,y:82},{x:8,y:62},{x:18,y:58},{x:28,y:52},{x:42,y:52},{x:55,y:45},{x:87,y:35},{x:87,y:28}],
  "15": [{x:8,y:82},{x:8,y:62},{x:18,y:58},{x:28,y:52},{x:42,y:52},{x:55,y:45},{x:95,y:35},{x:95,y:28}],
};

/* ═══════════════════════════ DASHBOARD ═══════════════════════════ */
export default function Dashboard() {
  const [feature, setFeature] = useState<Feature>("weather");
  const [logs, setLogs] = useState<{ ts: string; msg: string; ok: boolean }[]>([]);
  const addLog = (msg: string, ok = true) =>
    setLogs(p => [{ ts: new Date().toLocaleTimeString("ro"), msg, ok }, ...p].slice(0, 30));

  return (
    <div id="dashboard">
      <div className="dashboard-grid">
        <LeftPanel feature={feature} setFeature={setFeature} />
        <CenterPanel feature={feature} onLog={addLog} />
        <RightPanel feature={feature} onLog={addLog} />
      </div>
      <BottomBar logs={logs} />
    </div>
  );
}

/* ═══════════════════════════ LEFT PANEL ═══════════════════════════ */
const NAV: { id: Feature; icon: string; label: string; sub: string }[] = [
  { id: "weather", icon: "ti-cloud-storm", label: "Vreme / METAR",    sub: "LRIA · Open-Meteo · NOAA" },
  { id: "route",   icon: "ti-route",       label: "My Route",         sub: "Device Location · Orange"  },
  { id: "heatmap", icon: "ti-map-2",       label: "Heatmap Terminal", sub: "Aglomerație zone"          },
];

function LeftPanel({ feature, setFeature }: { feature: Feature; setFeature: (f: Feature) => void }) {
  return (
    <div className="card sidebar-left">
      <div className="brand-header">
        <div className="brand-icon"><i className="ti ti-wifi" /></div>
        <div>
          <div className="brand-title">AirFlow Nexus</div>
          <div className="brand-sub">powered by Orange APIs</div>
        </div>
      </div>

      <div className="section-title">Funcționalități</div>
      <div className="api-list">
        {NAV.map(n => (
          <div key={n.id} className={`api-card${feature === n.id ? " active" : ""}`} onClick={() => setFeature(n.id)}>
            <div className="api-card-header"><i className={`ti ${n.icon}`} /> {n.label}</div>
            <div className="api-val">{n.sub}</div>
            <div className="api-status">
              <span className="dot green pulse-green" />
              {feature === n.id ? "Activ acum" : "Disponibil"}
            </div>
          </div>
        ))}

        <div style={{ marginTop: 12 }}>
          <div className="section-title">Status API Orange</div>
        </div>
        {[
          { icon:"ti-map-pin", label:"Device Location", val:"342 dispozitive", dot:"green", pulse:true },
          { icon:"ti-id-badge",label:"Number Verification", val:"12 verificări/oră", dot:"orange", pulse:false },
          { icon:"ti-bolt",    label:"Quality on Demand", val:"2 sesiuni active", dot:"blue", pulse:false },
        ].map(a => (
          <div key={a.label} className="api-card">
            <div className="api-card-header"><i className={`ti ${a.icon}`} /> {a.label}</div>
            <div className="api-val">{a.val}</div>
            <div className="api-status">
              <span className={`dot ${a.dot}${a.pulse ? " pulse-green" : ""}`} />
              Activ
            </div>
          </div>
        ))}
      </div>

      <div className="alert-box" style={{ marginTop: 12 }}>
        <div className="alert-title"><i className="ti ti-alert-triangle" /> Alertă activă</div>
        <div className="alert-desc">Aglomerație poarta C3 — QoD alocat camere video.</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════ CENTER PANEL ═══════════════════════════ */
function CenterPanel({ feature, onLog }: { feature: Feature; onLog: (m: string, ok?: boolean) => void }) {
  return (
    <div className="card main-center">
      {feature === "weather" && <WeatherCenter onLog={onLog} />}
      {feature === "route"   && <RouteCenter   onLog={onLog} />}
      {feature === "heatmap" && <HeatmapCenter onLog={onLog} />}
    </div>
  );
}

/* ── Weather center ── */
interface WData { temperatureC:number; apparentTemperatureC:number; windSpeedKt:number; windDirection:number; humidity:number; weatherDescription:string; precipitationMm:number; timestamp:string; fromFixture?:boolean }
interface MData { raw:string; flightCategory:string; wind:{directionDeg:number;speedKt:number;gustKt:number|null}; visibility:{meters:number;unlimited:boolean}; clouds:{cover:string;baseFt:number}[]; temperature:{tempC:number;dewpointC:number}; altimeter:{qnhHpa:number}; fromFixture?:boolean }
const DIR = ["N","NE","E","SE","S","SV","V","NV"];
const CAT_COL: Record<string,string> = { VFR:"var(--success)",MVFR:"var(--info)",IFR:"var(--warning)",LIFR:"var(--danger)" };

function WeatherCenter({ onLog }: { onLog:(m:string,ok?:boolean)=>void }) {
  const [w, setW] = useState<WData|null>(null);
  const [m, setM] = useState<MData|null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [wd, md] = await Promise.all([
        fetch("/api/weather").then(r => r.json()),
        fetch("/api/metar?station=LRIA").then(r => r.json()),
      ]);
      setW(wd); setM(md);
      onLog(`METAR LRIA · ${md.flightCategory} · vânt ${md.wind?.speedKt}kt`);
    } catch { onLog("Eroare fetch meteo", false); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  return (
    <>
      <div className="map-header">
        <div className="map-title">Vreme & METAR — LRIA Iași</div>
        <div className="badges">
          {m && <div className="badge" style={{ background:`${CAT_COL[m.flightCategory]}22`, color:CAT_COL[m.flightCategory], border:`1px solid ${CAT_COL[m.flightCategory]}44` }}>{m.flightCategory}</div>}
          <button onClick={load} style={{ background:"var(--bg-hover)", border:"1px solid var(--border-color)", borderRadius:"var(--radius-md)", color:"var(--text-muted)", padding:"4px 10px", cursor:"pointer", fontSize:12 }}>
            <i className={`ti ti-refresh${loading?" spin":""}`} /> Refresh
          </button>
        </div>
      </div>

      {m && <div className="metar-raw">{m.raw}</div>}

      {w && (
        <div className="weather-grid">
          {[
            { icon:"ti-temperature", l:"Temperatură", v:`${w.temperatureC}°C`,      s:`Senzorial ${w.apparentTemperatureC}°C` },
            { icon:"ti-wind",        l:"Vânt",        v:`${w.windSpeedKt} kt`,       s:`${DIR[Math.round(w.windDirection/45)%8]} · ${w.windDirection}°` },
            { icon:"ti-droplet",     l:"Umiditate",   v:`${w.humidity}%`,             s:`Precip. ${w.precipitationMm} mm` },
            { icon:"ti-cloud",       l:"Condiții",    v:w.weatherDescription.split(" ").slice(0,2).join(" "), s:new Date(w.timestamp).toLocaleTimeString("ro") },
          ].map(c => (
            <div key={c.l} className="weather-card">
              <div className="weather-card-label"><i className={`ti ${c.icon}`} /> {c.l}</div>
              <div className="weather-card-val">{c.v}</div>
              <div className="weather-card-sub">{c.s}</div>
            </div>
          ))}
        </div>
      )}

      {m && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
          {[
            ["Vânt", `${m.wind.directionDeg}° / ${m.wind.speedKt}kt${m.wind.gustKt?` G${m.wind.gustKt}`:""}`],
            ["Vizibilitate", m.visibility.unlimited?"≥ 10 km":`${m.visibility.meters} m`],
            ["Nori", m.clouds.map(c=>`${c.cover} ${c.baseFt}'`).join(" · ")||"SKC"],
            ["Temp / Dew", `${m.temperature.tempC}°C / ${m.temperature.dewpointC}°C`],
            ["QNH", `${m.altimeter.qnhHpa} hPa`],
            ["Sursă", m.fromFixture?"Fixture":"Live NOAA"],
          ].map(([l,v]) => (
            <div key={l} style={{ background:"var(--bg-body)", border:"1px solid var(--border-color)", borderRadius:"var(--radius-md)", padding:"10px" }}>
              <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:4 }}>{l}</div>
              <div style={{ fontSize:13, fontWeight:600 }}>{v}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// SVG waypoints în spațiul viewBox="0 0 1200 600" al hărții Gemini
// Nivel 0: check-in (210,490) → securitate (510,430) → acces etaj (640,400)
// Nivel 1: porți T4 sus (1-6), culoar T3 dreapta
const GATE_SVG: Record<string, { x: number; y: number }> = {
  "1":  { x: 150, y: 230 }, "2":  { x: 320, y: 230 }, "3":  { x: 490, y: 230 },
  "4":  { x: 660, y: 230 }, "5":  { x: 830, y: 230 }, "6":  { x: 1000, y: 230 },
  "T3": { x: 1050, y: 430 },
};

const ROUTE_SVG: Record<string, { x: number; y: number }[]> = {
  "1":  [{x:210,y:490},{x:210,y:400},{x:380,y:400},{x:150,y:300},{x:150,y:230}],
  "2":  [{x:210,y:490},{x:210,y:400},{x:380,y:400},{x:320,y:300},{x:320,y:230}],
  "3":  [{x:210,y:490},{x:210,y:400},{x:510,y:400},{x:490,y:300},{x:490,y:230}],
  "4":  [{x:210,y:490},{x:210,y:400},{x:510,y:400},{x:640,y:400},{x:660,y:300},{x:660,y:230}],
  "5":  [{x:210,y:490},{x:210,y:400},{x:510,y:400},{x:640,y:400},{x:830,y:300},{x:830,y:230}],
  "6":  [{x:210,y:490},{x:210,y:400},{x:510,y:400},{x:640,y:400},{x:1000,y:300},{x:1000,y:230}],
  "T3": [{x:210,y:490},{x:210,y:400},{x:510,y:400},{x:640,y:400},{x:960,y:400},{x:1050,y:430}],
};

function RouteCenter({ onLog }: { onLog:(m:string,ok?:boolean)=>void }) {
  const [selFlight, setSelFlight] = useState<string|null>(null);
  const [userPos, setUserPos] = useState<{x:number;y:number}>({x:210,y:490});
  const [locLoading, setLocLoading] = useState(false);
  const animRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  const flight = FLIGHTS.find(f => f.id === selFlight) ?? null;
  const pts = flight ? ROUTE_SVG[flight.gate] : null;
  const gatePos = flight ? GATE_SVG[flight.gate] : null;

  useEffect(() => {
    if (animRef.current) clearTimeout(animRef.current);
    if (!pts) { setUserPos({x:210,y:490}); return; }
    let i = 0;
    const step = () => {
      if (i < pts.length) { setUserPos(pts[i]); i++; animRef.current = setTimeout(step, 500); }
    };
    setUserPos(pts[0]);
    animRef.current = setTimeout(step, 400);
    return () => { if (animRef.current) clearTimeout(animRef.current); };
  }, [selFlight]);

  const getLocation = async () => {
    setLocLoading(true);
    try {
      const r = await fetch("/api/location", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ phoneNumber:"+99012345678" }) });
      const d = await r.json();
      onLog(`Orange Location · lat ${d.location?.latitude?.toFixed(3)} lon ${d.location?.longitude?.toFixed(3)}`);
    } catch { onLog("Eroare Orange Location API", false); }
    finally { setLocLoading(false); }
  };

  const polyline = pts ? pts.map(p => `${p.x},${p.y}`).join(" ") : "";

  return (
    <>
      <div className="map-header">
        <div className="map-title">My Route — Terminal T4 Iași</div>
        <div className="badges">
          <div className="badge badge-live"><span className="dot red pulse-red" /> Live</div>
          <button onClick={getLocation} disabled={locLoading} style={{ background:"var(--bg-hover)", border:"1px solid var(--border-color)", borderRadius:"var(--radius-md)", color:"var(--text-muted)", padding:"4px 10px", cursor:"pointer", fontSize:12, display:"flex", alignItems:"center", gap:6 }}>
            <i className={`ti ti-navigation${locLoading?" spin":""}`} /> Orange Location
          </button>
        </div>
      </div>

      <div className="map-container">
        <svg viewBox="0 0 1200 600" xmlns="http://www.w3.org/2000/svg" style={{ width:"100%", height:"100%" }}>
          <defs>
            <linearGradient id="grad-gates" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1E293B"/>
              <stop offset="100%" stopColor="#0F172A"/>
            </linearGradient>
            <linearGradient id="grad-checkin" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1E3A8A" stopOpacity="0.5"/>
              <stop offset="100%" stopColor="#172554" stopOpacity="0.5"/>
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/* Background */}
          <rect x="40" y="100" width="1120" height="460" rx="16" fill="#0B1120" stroke="#334155" strokeWidth="2"/>

          {/* ── Zona porți (sus) ── */}
          <rect x="60" y="120" width="1080" height="190" rx="12" fill="url(#grad-gates)" stroke="#475569" strokeWidth="1.5"/>
          <text x="80" y="150" fill="#64748B" fontSize="11" fontWeight="600" letterSpacing="1">ZONA DE ÎMBARCARE — DEPARTURES</text>

          {/* Porți 1–6 */}
          {([
            ["1",80],["2",250],["3",420],["4",590],["5",760],["6",930]
          ] as [string,number][]).map(([id,gx]) => {
            const isTarget = flight?.gate === id;
            const isOpen = id === "4";
            return (
              <g key={id}>
                <rect x={gx} y="170" width="140" height="110" rx="8"
                  fill={isTarget ? "rgba(56,189,248,0.15)" : isOpen ? "#064E3B" : "#0F172A"}
                  stroke={isTarget ? "#38BDF8" : isOpen ? "#10B981" : "#38BDF8"}
                  strokeWidth={isTarget ? 2.5 : 1}
                />
                <text x={gx+70} y="228" fill={isTarget?"#38BDF8":isOpen?"#10B981":"#FFFFFF"} fontSize="16" fontWeight="600" textAnchor="middle">
                  Poarta {id}
                </text>
                {isOpen && <text x={gx+70} y="248" fill="#6EE7B7" fontSize="11" textAnchor="middle">Zbor deschis</text>}
                {isTarget && <text x={gx+70} y="248" fill="#38BDF8" fontSize="11" textAnchor="middle">← Destinația ta</text>}
              </g>
            );
          })}

          {/* ── Check-in ── */}
          <rect x="60" y="350" width="300" height="190" rx="12" fill="url(#grad-checkin)" stroke="#3B82F6" strokeWidth="1.5" strokeDasharray="4 2"/>
          <text x="210" y="435" fill="#FFFFFF" fontSize="17" fontWeight="500" textAnchor="middle">Check-in T4</text>
          <text x="210" y="458" fill="#93C5FD" fontSize="12" textAnchor="middle">~120 pasageri</text>

          {/* ── Securitate ── */}
          <rect x="390" y="350" width="230" height="190" rx="12" fill="#451A03" stroke="#F59E0B" strokeWidth="2"/>
          <text x="505" y="435" fill="#FBBF24" fontSize="17" fontWeight="600" textAnchor="middle">Control Securitate</text>
          <text x="505" y="458" fill="#FDE68A" fontSize="12" textAnchor="middle">⚠ Aglomerat (~210 pax)</text>

          {/* ── Duty Free ── */}
          <rect x="650" y="350" width="270" height="190" rx="12" fill="#064E3B" stroke="#10B981" strokeWidth="1.5"/>
          <text x="785" y="435" fill="#6EE7B7" fontSize="17" fontWeight="500" textAnchor="middle">Duty Free &amp; Lounge</text>
          <text x="785" y="458" fill="#A7F3D0" fontSize="12" textAnchor="middle">Flux normal</text>

          {/* ── T3 Non-Schengen ── */}
          <rect x="950" y="350" width="200" height="190" rx="12" fill="#312E81" stroke="#6366F1" strokeWidth="1.5"/>
          <text x="1050" y="425" fill="#C7D2FE" fontSize="15" fontWeight="500" textAnchor="middle">Culoar T3</text>
          <text x="1050" y="448" fill="#A5B4FC" fontSize="12" textAnchor="middle">Non-Schengen</text>
          <text x="1050" y="468" fill="#818CF8" fontSize="12" textAnchor="middle">Control Pașapoarte</text>

          {/* ── Ruta animată ── */}
          {pts && (
            <polyline
              points={polyline}
              fill="none"
              stroke="#38BDF8"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="12 12"
              style={{ animation:"moveDash 1.5s linear infinite", filter:"drop-shadow(0 0 6px rgba(56,189,248,0.8))" }}
            />
          )}

          {/* ── Poarta destinație beacon ── */}
          {gatePos && (
            <g>
              <circle cx={gatePos.x} cy={gatePos.y} r="14" fill="none" stroke="#10B981" strokeWidth="2" opacity="0.6" style={{animation:"pulse 2s infinite"}}/>
              <circle cx={gatePos.x} cy={gatePos.y} r="7" fill="#10B981" filter="url(#glow)"/>
            </g>
          )}

          {/* ── User dot ── */}
          <g>
            <circle cx={userPos.x} cy={userPos.y} r="14" fill="none" stroke="#38BDF8" strokeWidth="2" opacity="0.5" style={{animation:"pulse 2s infinite"}}/>
            <circle cx={userPos.x} cy={userPos.y} r="7" fill="#38BDF8" filter="url(#glow)"/>
            <text x={userPos.x} y={userPos.y+26} fill="#E0F2FE" fontSize="12" textAnchor="middle">Tu ești aici</text>
          </g>
        </svg>
      </div>

      <style>{`
        @keyframes moveDash { to { stroke-dashoffset: -200; } }
        @keyframes pulse {
          0%,100% { transform: scale(0.9); opacity:1; }
          50% { transform: scale(1.3); opacity:0.7; }
        }
      `}</style>
    </>
  );
}

/* ── Heatmap center ── */
function HeatmapCenter({ onLog }: { onLog:(m:string,ok?:boolean)=>void }) {
  const [zones, setZones] = useState(() => ZONES.map(z => ({ ...z, count: randZ(z.base) })));
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => { setZones(ZONES.map(z => ({ ...z, count: randZ(z.base) }))); setTick(p=>p+1); }, 8000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { onLog(`Heatmap actualizat · ${new Date().toLocaleTimeString("ro")}`); }, [tick]);

  return (
    <>
      <div className="map-header">
        <div className="map-title">Terminal A — vedere de sus</div>
        <div className="badges">
          <div className="badge badge-live"><span className="dot red pulse-red" /> Live</div>
          <div className="badge badge-time">Auto-refresh 8s</div>
        </div>
      </div>
      <div className="map-container">
        <svg viewBox="0 0 600 400" preserveAspectRatio="xMidYMid meet">
          <text x="300" y="205" textAnchor="middle" fill="var(--text-muted)" fontSize="13">Culoar principal de acces</text>
          {zones.map(z => {
            const c = heatColor(z.count, z.limit);
            return (
              <g key={z.id}>
                <rect x={z.x} y={z.y} width={z.w} height={z.h} rx="12"
                  fill={`${c === "var(--danger)" ? "rgba(239,83,80" : c === "var(--warning)" ? "rgba(255,167,38" : "rgba(102,187,106"},0.15)`}
                  stroke={c} strokeWidth="2" strokeDasharray={z.dash ? "6 4" : undefined}
                />
                <text x={z.x+z.w/2} y={z.y+z.h/2-8} textAnchor="middle" fill={c} fontSize="15" fontWeight="600">{z.label}</text>
                <text x={z.x+z.w/2} y={z.y+z.h/2+12} textAnchor="middle" fill={c} fontSize="13" opacity="0.85">~{z.count} pax</text>
                {z.dash && <text x={z.x+z.w/2} y={z.y+z.h/2+28} textAnchor="middle" fill={c} fontSize="11" opacity="0.8">⚠ limită {z.limit}</text>}
              </g>
            );
          })}
        </svg>
      </div>
    </>
  );
}

/* ═══════════════════════════ RIGHT PANEL ═══════════════════════════ */
function RightPanel({ feature, onLog }: { feature: Feature; onLog:(m:string,ok?:boolean)=>void }) {
  return (
    <div className="card sidebar-right">
      {feature === "weather" && <WeatherRight />}
      {feature === "route"   && <RouteRight onLog={onLog} />}
      {feature === "heatmap" && <HeatmapRight />}
    </div>
  );
}

function WeatherRight() {
  return (
    <>
      <div className="section-title">Aerodrom LRIA</div>
      <div className="stats-list" style={{ marginBottom:16 }}>
        {[["Stație","LRIA"],["Altitudine","98 m MSL"],["Pistă","08 / 26"],["Fus orar","UTC+3"],["Tip","Internațional"]].map(([l,v])=>(
          <div key={l} className="stat-item"><span className="stat-label">{l}</span><span className="stat-value">{v}</span></div>
        ))}
      </div>
      <div className="section-title">Categorii vizibilitate</div>
      <div className="stats-list">
        {[["VFR","var(--success)","≥ 5 km, ≥ 1500ft"],["MVFR","var(--info)","3–5 km"],["IFR","var(--warning)","1–3 km"],["LIFR","var(--danger)","< 1 km"]].map(([cat,col,desc])=>(
          <div key={cat} className="stat-item">
            <span style={{fontSize:13,fontWeight:600,color:col as string}}>{cat}</span>
            <span style={{fontSize:11,color:"var(--text-muted)",textAlign:"right"}}>{desc}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function RouteRight({ onLog }: { onLog:(m:string,ok?:boolean)=>void }) {
  const [sel, setSel] = useState<string|null>(null);
  const [verifyRes, setVerifyRes] = useState<{decision:string;simSwapped:boolean}|null>(null);
  const [loading, setLoading] = useState(false);

  const verify = async (scenario:"legit"|"fraud") => {
    setLoading(true);
    try {
      const r = await fetch("/api/verify",{ method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ scenario }) });
      const d = await r.json();
      setVerifyRes(d);
      onLog(`Verificare ${scenario} → ${d.decision}`, d.decision==="ALLOW");
    } catch { onLog("Eroare verificare", false); }
    finally { setLoading(false); }
  };

  return (
    <>
      <div className="section-title">Zboruri disponibile</div>
      <div className="flight-list">
        {FLIGHTS.map(f => (
          <div key={f.id} className={`flight-item${sel===f.id?" active":""}`} onClick={() => setSel(sel===f.id?null:f.id)}>
            <i className="ti ti-plane" style={{color:f.color, fontSize:18}} />
            <div style={{flex:1}}>
              <div className="flight-nr">{f.flight}</div>
              <div className="flight-dest">{f.dest}</div>
            </div>
            <div className="flight-gate" style={{color:f.color}}>G{f.gate} · {f.departs}</div>
          </div>
        ))}
      </div>

      <div className="section-title" style={{marginTop:12}}>Verificare identitate</div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        <button onClick={()=>verify("legit")} disabled={loading} style={{padding:"9px",background:"var(--success-bg)",border:"1px solid var(--success)",borderRadius:"var(--radius-md)",color:"var(--success)",cursor:"pointer",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <i className={`ti ti-${loading?"loader-2 spin":"user-check"}`}/> Pasager legitim
        </button>
        <button onClick={()=>verify("fraud")} disabled={loading} style={{padding:"9px",background:"var(--danger-bg)",border:"1px solid var(--danger)",borderRadius:"var(--radius-md)",color:"var(--danger)",cursor:"pointer",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <i className="ti ti-user-x"/> Simulează SIM Swap
        </button>
      </div>

      {verifyRes && (
        <div className="fade-in" style={{marginTop:10,padding:10,borderRadius:"var(--radius-md)",border:`1px solid ${verifyRes.decision==="ALLOW"?"var(--success)":"var(--danger)"}`,background:`${verifyRes.decision==="ALLOW"?"var(--success-bg)":"var(--danger-bg)"}`}}>
          <div style={{fontWeight:600,fontSize:13,color:verifyRes.decision==="ALLOW"?"var(--success)":"var(--danger)",display:"flex",alignItems:"center",gap:8}}>
            <i className={`ti ti-${verifyRes.decision==="ALLOW"?"circle-check":"shield-x"}`}/>
            {verifyRes.decision==="ALLOW"?"ALLOW — Verificat":"BLOCK — SIM Swap detectat"}
          </div>
        </div>
      )}
    </>
  );
}

function HeatmapRight() {
  const [zones, setZones] = useState(() => ZONES.map(z => ({ ...z, count: randZ(z.base) })));
  useEffect(() => {
    const t = setInterval(() => setZones(ZONES.map(z => ({ ...z, count: randZ(z.base) }))), 8000);
    return () => clearInterval(t);
  }, []);
  const total = zones.reduce((s,z) => s+z.count, 0);
  return (
    <>
      <div className="section-title">Statistici Live</div>
      <div className="stats-list" style={{marginBottom:16}}>
        <div className="stat-item"><span className="stat-label">Total pasageri</span><span className="stat-value">{total}</span></div>
        <div className="stat-item"><span className="stat-label">Zbor întârziat</span><span className="stat-value" style={{color:"var(--danger)"}}>2</span></div>
        <div className="stat-item"><span className="stat-label">Porți active</span><span className="stat-value">6 / 9</span></div>
        <div className="stat-item"><span className="stat-label">Nevoi speciale</span><span className="stat-value" style={{color:"var(--info)"}}>3 pax</span></div>
      </div>
      <div className="section-title">Aglomerație zone</div>
      <div style={{flex:1,overflowY:"auto"}}>
        {zones.map(z => {
          const c = heatColor(z.count, z.limit);
          const pct = Math.min(Math.round(z.count/z.limit*100),100);
          return (
            <div key={z.id} className="zone-row">
              <span className="zone-name">{z.label}</span>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div className="zone-bar-wrap"><div className="zone-bar" style={{width:`${pct}%`,background:c}}/></div>
                <span style={{fontSize:13,fontWeight:600,color:c,width:36,textAlign:"right"}}>{z.count}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="alert-box" style={{marginTop:12}}>
        <div className="alert-title"><i className="ti ti-alert-triangle"/> Alertă C3</div>
        <div className="alert-desc">~89 pax · limită 60 — QoD activ</div>
      </div>
    </>
  );
}

/* ═══════════════════════════ BOTTOM BAR ═══════════════════════════ */
function BottomBar({ logs }: { logs:{ts:string;msg:string;ok:boolean}[] }) {
  return (
    <div className="bottom-bar">
      {/* Cont / profil */}
      <button className="btn-tab">
        <i className="ti ti-user-circle" /> Contul meu
      </button>
      <button className="btn-tab">
        <i className="ti ti-plane-departure" /> Zborul meu
      </button>
      <button className="btn-tab">
        <i className="ti ti-bell" /> Notificări
      </button>
      <button className="btn-tab">
        <i className="ti ti-settings" /> Setări
      </button>

      {/* Activity log inline */}
      <div style={{ flex:3, display:"flex", alignItems:"center", gap:14, paddingLeft:8, overflow:"hidden" }}>
        {logs.slice(0,2).map((l,i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, whiteSpace:"nowrap", color:"var(--text-muted)" }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:l.ok?"var(--success)":"var(--danger)", flexShrink:0 }}/>
            <span>{l.ts}</span>
            <span style={{ color:l.ok?"var(--text-main)":"var(--danger)" }}>{l.msg}</span>
          </div>
        ))}
        {logs.length === 0 && <span style={{ fontSize:12, color:"var(--text-muted)" }}>Activity log</span>}
      </div>

      <button className="btn-tab" style={{ flex:"0 0 auto" }}>
        <i className="ti ti-help-circle" /> Ajutor
      </button>
    </div>
  );
}

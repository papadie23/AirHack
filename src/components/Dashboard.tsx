import { useState, useEffect, useRef } from "react";

/* ─────────────────────────── types ─────────────────────────── */
type Feature = "heatmap" | "weather" | "route";

/* ─────────────────────────── heatmap data ─────────────────────────── */
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
  if (r < 0.55) return "var(--success)";
  if (r < 0.85) return "var(--warning)";
  return "var(--danger)";
}

/* ─────────────────────────── route data ─────────────────────────── */
const FLIGHTS = [
  { id: "1", gate: "A1", flight: "RO 321", dest: "București",  departs: "23:15", color: "var(--success)" },
  { id: "2", gate: "A2", flight: "BA 882", dest: "Londra",     departs: "23:45", color: "var(--info)"    },
  { id: "3", gate: "B1", flight: "LH 1407",dest: "Frankfurt",  departs: "00:10", color: "var(--warning)" },
  { id: "4", gate: "C3", flight: "AF 1234",dest: "Paris CDG",  departs: "00:30", color: "var(--danger)"  },
];

// waypoints per gate through the SVG map (700×450)
const ROUTE_PTS: Record<string, [number,number][]> = {
  A1: [[80,240],[160,240],[260,240],[380,240],[460,240],[460,305]],
  A2: [[80,240],[160,240],[260,240],[380,240],[525,240],[525,305]],
  B1: [[80,240],[160,240],[260,240],[380,240],[590,240],[590,305]],
  C3: [[80,240],[160,240],[260,240],[380,240],[655,240],[655,305]],
};

/* ─────────────────────────── component ─────────────────────────── */
export default function Dashboard() {
  const [feature, setFeature] = useState<Feature>("heatmap");
  const [logs, setLogs] = useState<{ts:string;msg:string;ok:boolean}[]>([]);

  const addLog = (msg: string, ok = true) =>
    setLogs(p => [{ ts: new Date().toLocaleTimeString("ro"), msg, ok }, ...p].slice(0, 30));

  return (
    <div id="dashboard">
      <div className="dashboard-grid">
        <LeftPanel feature={feature} setFeature={setFeature} />
        <CenterPanel feature={feature} onLog={addLog} />
        <RightPanel feature={feature} onLog={addLog} />
      </div>
      <BottomBar feature={feature} setFeature={setFeature} logs={logs} />
    </div>
  );
}

/* ═══════════════════════════ LEFT PANEL ═══════════════════════════ */
const NAV = [
  { id: "heatmap" as Feature, icon: "ti-map-2",       label: "Heatmap Aeroport", sub: "Device Location API" },
  { id: "weather" as Feature, icon: "ti-cloud-storm",  label: "Vreme / METAR",    sub: "Open-Meteo · NOAA"  },
  { id: "route"   as Feature, icon: "ti-route",        label: "My Route",         sub: "Navigare la poartă" },
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
          <div
            key={n.id}
            className={`api-card${feature === n.id ? " active" : ""}`}
            onClick={() => setFeature(n.id)}
          >
            <div className="api-card-header"><i className={`ti ${n.icon}`} /> {n.label}</div>
            <div className="api-val">{n.sub}</div>
            <div className="api-status">
              <span className="dot green pulse-green" />
              {feature === n.id ? "Activ" : "Disponibil"}
            </div>
          </div>
        ))}

        <div style={{ marginTop: 8 }}>
          <div className="section-title">Status API-uri Orange</div>
        </div>

        <div className="api-card">
          <div className="api-card-header"><i className="ti ti-map-pin" /> Device Location API</div>
          <div className="api-val">342 dispozitive</div>
          <div className="api-status"><span className="dot green pulse-green" /> Activ · zona securitate</div>
        </div>
        <div className="api-card">
          <div className="api-card-header"><i className="ti ti-id-badge" /> Number Verification</div>
          <div className="api-val">12 verificări / oră</div>
          <div className="api-status"><span className="dot orange" /> Moderat</div>
        </div>
        <div className="api-card">
          <div className="api-card-header"><i className="ti ti-bolt" /> Quality on Demand</div>
          <div className="api-val">2 sesiuni active</div>
          <div className="api-status"><span className="dot blue" /> Prioritate mentenanță</div>
        </div>
      </div>

      <div className="alert-box" style={{ marginTop: 12 }}>
        <div className="alert-title"><i className="ti ti-alert-triangle" /> Alertă activă</div>
        <div className="alert-desc">Aglomerație poarta C3 — bandă QoD alocată camerelor video.</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════ CENTER PANEL ═══════════════════════════ */
function CenterPanel({ feature, onLog }: { feature: Feature; onLog: (m:string,ok?:boolean)=>void }) {
  return (
    <div className="card main-center" style={{ gridColumn: 2 }}>
      {feature === "heatmap" && <HeatmapCenter onLog={onLog} />}
      {feature === "weather" && <WeatherCenter onLog={onLog} />}
      {feature === "route"   && <RouteCenter   onLog={onLog} />}
    </div>
  );
}

/* ─── Heatmap center ─── */
function HeatmapCenter({ onLog }: { onLog:(m:string,ok?:boolean)=>void }) {
  const [zones, setZones] = useState(() => ZONES.map(z => ({ ...z, count: randZ(z.base) })));
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setZones(ZONES.map(z => ({ ...z, count: randZ(z.base) })));
      setTick(p => p + 1);
    }, 8000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    onLog(`Heatmap actualizat · ${new Date().toLocaleTimeString("ro")}`);
  }, [tick]);

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
            const cx = z.x + z.w / 2, cy = z.y + z.h / 2;
            return (
              <g key={z.id}>
                <rect x={z.x} y={z.y} width={z.w} height={z.h} rx="12"
                  fill={`${c.replace('var(--','').replace(')','') === 'danger' ? 'rgba(239,83,80' : c.replace('var(--','').replace(')','') === 'warning' ? 'rgba(255,167,38' : 'rgba(102,187,106'},0.15)`}
                  stroke={c} strokeWidth="2" strokeDasharray={z.dash ? "6 4" : undefined}
                />
                <text x={cx} y={cy-8} textAnchor="middle" fill={c} fontSize="15" fontWeight="600">{z.label}</text>
                <text x={cx} y={cy+12} textAnchor="middle" fill={c} fontSize="13" opacity="0.85">~{z.count} pax</text>
                {z.dash && <text x={cx} y={cy+28} textAnchor="middle" fill={c} fontSize="11" opacity="0.8">ALERTĂ · limită {z.limit}</text>}
              </g>
            );
          })}
        </svg>
      </div>
    </>
  );
}

/* ─── Weather center ─── */
interface WeatherData { temperatureC:number; apparentTemperatureC:number; windSpeedKt:number; windDirection:number; humidity:number; weatherDescription:string; precipitationMm:number; timestamp:string; fromFixture?:boolean }
interface MetarData { raw:string; flightCategory:string; wind:{directionDeg:number;speedKt:number;gustKt:number|null}; visibility:{meters:number;unlimited:boolean}; clouds:{cover:string;baseFt:number}[]; temperature:{tempC:number;dewpointC:number}; altimeter:{qnhHpa:number}; fromFixture?:boolean }

const DIR = ["N","NE","E","SE","S","SV","V","NV"];
const CAT_COLOR: Record<string,string> = { VFR:"var(--success)", MVFR:"var(--info)", IFR:"var(--warning)", LIFR:"var(--danger)" };

function WeatherCenter({ onLog }: { onLog:(m:string,ok?:boolean)=>void }) {
  const [weather, setWeather] = useState<WeatherData|null>(null);
  const [metar, setMetar] = useState<MetarData|null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [w, m] = await Promise.all([
        fetch("/api/weather").then(r => r.json()),
        fetch("/api/metar?station=LRIA").then(r => r.json()),
      ]);
      setWeather(w); setMetar(m);
      onLog(`METAR LRIA · ${m.flightCategory} · vânt ${m.wind?.speedKt}kt`);
    } catch { onLog("Eroare fetch meteo", false); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const dir = weather ? DIR[Math.round(weather.windDirection/45)%8] : "";

  return (
    <>
      <div className="map-header">
        <div className="map-title">Vreme & METAR — LRIA</div>
        <div className="badges">
          {metar && <div className="badge" style={{ background: `${CAT_COLOR[metar.flightCategory]}22`, color: CAT_COLOR[metar.flightCategory], border: `1px solid ${CAT_COLOR[metar.flightCategory]}44` }}>{metar.flightCategory}</div>}
          <button onClick={load} style={{ background:"var(--bg-hover)", border:"1px solid var(--border-color)", borderRadius:"var(--radius-md)", color:"var(--text-muted)", padding:"4px 10px", cursor:"pointer", fontSize:12 }}>
            <i className={`ti ti-refresh${loading?" spin":""}`} /> Refresh
          </button>
        </div>
      </div>

      {metar && <div className="metar-raw">{metar.raw}</div>}

      {weather && (
        <div className="weather-grid">
          {[
            { icon:"ti-temperature", label:"Temperatură", val:`${weather.temperatureC}°C`, sub:`Senzorial ${weather.apparentTemperatureC}°C` },
            { icon:"ti-wind",        label:"Vânt",        val:`${weather.windSpeedKt} kt`, sub:`${dir} · ${weather.windDirection}°` },
            { icon:"ti-droplet",     label:"Umiditate",   val:`${weather.humidity}%`,      sub:`Precip. ${weather.precipitationMm} mm` },
            { icon:"ti-cloud",       label:"Condiții",    val:weather.weatherDescription.split(" ").slice(0,2).join(" "), sub:new Date(weather.timestamp).toLocaleTimeString("ro") },
          ].map(c => (
            <div key={c.label} className="weather-card">
              <div className="weather-card-label"><i className={`ti ${c.icon}`} /> {c.label}</div>
              <div className="weather-card-val">{c.val}</div>
              <div className="weather-card-sub">{c.sub}</div>
            </div>
          ))}
        </div>
      )}

      {metar && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
          {[
            ["Vânt", `${metar.wind.directionDeg}° / ${metar.wind.speedKt}kt${metar.wind.gustKt?` G${metar.wind.gustKt}`:""}`],
            ["Vizibilitate", metar.visibility.unlimited?"≥ 10 km":`${metar.visibility.meters} m`],
            ["Nori", metar.clouds.map(c=>`${c.cover} ${c.baseFt}'`).join(" · ")||"SKC"],
            ["Temp/Dew", `${metar.temperature.tempC}°C / ${metar.temperature.dewpointC}°C`],
            ["QNH", `${metar.altimeter.qnhHpa} hPa`],
            ["Sursă", metar.fromFixture?"Fixture":"Live NOAA"],
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

/* ─── Route center ─── */
function RouteCenter({ onLog }: { onLog:(m:string,ok?:boolean)=>void }) {
  const [sel, setSel] = useState<string|null>(null);
  const [userPos, setUserPos] = useState<{x:number;y:number}|null>(null);
  const animRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  const flight = FLIGHTS.find(f => f.id === sel) ?? null;
  const pts = flight ? ROUTE_PTS[flight.gate] : null;

  useEffect(() => {
    if (!pts) { setUserPos(null); return; }
    let i = 0;
    const step = () => {
      if (i < pts.length) { setUserPos({ x:pts[i][0], y:pts[i][1] }); i++; animRef.current = setTimeout(step, 420); }
    };
    setUserPos({ x:pts[0][0], y:pts[0][1] });
    animRef.current = setTimeout(step, 300);
    return () => { if (animRef.current) clearTimeout(animRef.current); };
  }, [sel]);

  const getLocation = async () => {
    try {
      const r = await fetch("/api/location",{ method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ phoneNumber:"+99012345678" }) });
      const d = await r.json();
      onLog(`Orange Location · lat ${d.location?.latitude?.toFixed(3)} lon ${d.location?.longitude?.toFixed(3)}`);
    } catch { onLog("Eroare Orange Location API", false); }
  };

  const pathD = (p:[number,number][]) => p.map((pt,i) => `${i===0?"M":"L"} ${pt[0]} ${pt[1]}`).join(" ");

  // Gate positions in SVG
  const GATE_POS: Record<string,[number,number]> = { A1:[460,312], A2:[525,312], B1:[590,312], C3:[655,320] };

  return (
    <>
      <div className="map-header">
        <div className="map-title">My Route — Terminal LRIA</div>
        <div className="badges">
          <button onClick={getLocation} style={{ background:"var(--bg-hover)", border:"1px solid var(--border-color)", borderRadius:"var(--radius-md)", color:"var(--text-muted)", padding:"4px 10px", cursor:"pointer", fontSize:12, display:"flex", alignItems:"center", gap:6 }}>
            <i className="ti ti-navigation" /> Locație Orange
          </button>
        </div>
      </div>

      <div className="map-container" style={{ flex: 1 }}>
        <svg viewBox="0 0 710 450" preserveAspectRatio="xMidYMid meet">
          {/* Rooms */}
          <rect x="30"  y="170" width="110" height="120" rx="12" fill="var(--info-bg)"    stroke="var(--info)"    strokeWidth="1.5"/>
          <text x="85"  y="230" textAnchor="middle" fill="var(--info)"    fontSize="13" fontWeight="600">Intrare</text>

          <rect x="150" y="130" width="165" height="200" rx="12" fill="var(--warning-bg)" stroke="var(--warning)" strokeWidth="1.5"/>
          <text x="232" y="230" textAnchor="middle" fill="var(--warning)" fontSize="13" fontWeight="600">Check-in</text>

          <rect x="325" y="140" width="105" height="180" rx="12" fill="var(--danger-bg)"  stroke="var(--danger)"  strokeWidth="1.5"/>
          <text x="377" y="230" textAnchor="middle" fill="var(--danger)"  fontSize="13" fontWeight="600">Securitate</text>

          {/* Corridor */}
          <rect x="440" y="210" width="252" height="60" rx="8" fill="#26262d" stroke="var(--border-color)" strokeWidth="1"/>
          <text x="566" y="244" textAnchor="middle" fill="var(--text-muted)" fontSize="12">Culoar</text>

          {/* Gates */}
          {[["A1",440,100,70,105,"var(--success)"],["A2",520,100,70,105,"var(--info)"],["B1",600,100,70,105,"var(--warning)"],["C3",620,280,72,115,"var(--danger)"]].map(([id,x,y,w,h,col])=>(
            <g key={id as string}>
              <rect x={x as number} y={y as number} width={w as number} height={h as number} rx="10"
                fill={`${col as string}22`} stroke={flight?.gate===id?"var(--brand)":col as string} strokeWidth={flight?.gate===id?2.5:1.5}
                strokeDasharray={id==="C3"?"6 4":undefined}
              />
              <text x={(x as number)+(w as number)/2} y={(y as number)+(h as number)/2+4} textAnchor="middle" fill={col as string} fontSize="13" fontWeight="600">
                Poarta {id}
              </text>
            </g>
          ))}

          {/* Route */}
          {pts && <path d={pathD(pts)} fill="none" stroke="var(--brand)" strokeWidth="3" strokeDasharray="8 4" strokeLinecap="round" className="fade-in" />}

          {/* Gate target dot */}
          {flight && GATE_POS[flight.gate] && (
            <circle cx={GATE_POS[flight.gate][0]} cy={GATE_POS[flight.gate][1]} r="8" fill="var(--brand)" opacity="0.9"/>
          )}

          {/* User dot */}
          {userPos && (
            <g className="user-dot">
              <circle cx={userPos.x} cy={userPos.y} r="11" fill="rgba(255,102,0,0.2)"/>
              <circle cx={userPos.x} cy={userPos.y} r="7" fill="var(--brand)"/>
              <circle cx={userPos.x} cy={userPos.y} r="3" fill="#fff"/>
            </g>
          )}

          {/* Start label */}
          <text x="85" y="165" textAnchor="middle" fill="var(--text-muted)" fontSize="11">Tu ești aici</text>
        </svg>
      </div>
    </>
  );
}

/* ═══════════════════════════ RIGHT PANEL ═══════════════════════════ */
function RightPanel({ feature, onLog }: { feature: Feature; onLog:(m:string,ok?:boolean)=>void }) {
  return (
    <div className="card sidebar-right">
      {feature === "heatmap" && <HeatmapRight />}
      {feature === "weather" && <WeatherRight />}
      {feature === "route"   && <RouteRight onLog={onLog} />}
    </div>
  );
}

/* ─── Heatmap right — zone stats ─── */
function HeatmapRight() {
  const [zones, setZones] = useState(() => ZONES.map(z => ({ ...z, count: randZ(z.base) })));
  useEffect(() => {
    const t = setInterval(() => setZones(ZONES.map(z => ({ ...z, count: randZ(z.base) }))), 8000);
    return () => clearInterval(t);
  }, []);

  const total = zones.reduce((s, z) => s + z.count, 0);

  return (
    <>
      <div className="section-title">Statistici Live</div>
      <div className="stats-list" style={{ marginBottom: 16 }}>
        <div className="stat-item"><span className="stat-label">Total pasageri</span><span className="stat-value">{total}</span></div>
        <div className="stat-item"><span className="stat-label">Zbor întârziat</span><span className="stat-value" style={{color:"var(--danger)"}}>2</span></div>
        <div className="stat-item"><span className="stat-label">Porți active</span><span className="stat-value">6 / 9</span></div>
        <div className="stat-item"><span className="stat-label">Nevoi speciale</span><span className="stat-value" style={{color:"var(--info)"}}>3 pasageri</span></div>
      </div>

      <div className="section-title">Aglomerație pe zone</div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {zones.map(z => {
          const c = heatColor(z.count, z.limit);
          const pct = Math.min(Math.round(z.count/z.limit*100), 100);
          return (
            <div key={z.id} className="zone-row">
              <span className="zone-name">{z.label}</span>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div className="zone-bar-wrap">
                  <div className="zone-bar" style={{ width:`${pct}%`, background:c }}/>
                </div>
                <span style={{ fontSize:13, fontWeight:600, color:c, width:36, textAlign:"right" }}>{z.count}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="alert-box" style={{ marginTop:12 }}>
        <div className="alert-title"><i className="ti ti-alert-triangle" /> Alertă C3</div>
        <div className="alert-desc">~89 pax · limită 60 — QoD activ</div>
      </div>
    </>
  );
}

/* ─── Weather right — metar details ─── */
function WeatherRight() {
  return (
    <>
      <div className="section-title">Condiții Aerodrom</div>
      <div className="stats-list" style={{ marginBottom: 16 }}>
        <div className="stat-item"><span className="stat-label">Stație</span><span className="stat-value">LRIA</span></div>
        <div className="stat-item"><span className="stat-label">Altitudine</span><span className="stat-value">98 m</span></div>
        <div className="stat-item"><span className="stat-label">Fus orar</span><span className="stat-value">UTC+3</span></div>
        <div className="stat-item"><span className="stat-label">Pistă</span><span className="stat-value">08/26</span></div>
      </div>
      <div className="section-title">Categorii vizibilitate</div>
      <div className="stats-list">
        {[["VFR","var(--success)","≥ 5 km, plafon ≥ 1500ft"],["MVFR","var(--info)","3–5 km sau 1000–3000ft"],["IFR","var(--warning)","1–3 km sau 500–1000ft"],["LIFR","var(--danger)","< 1 km sau < 500ft"]].map(([cat,col,desc])=>(
          <div key={cat} className="stat-item">
            <span style={{ fontSize:13, fontWeight:600, color:col as string }}>{cat}</span>
            <span style={{ fontSize:11, color:"var(--text-muted)", textAlign:"right", maxWidth:140 }}>{desc}</span>
          </div>
        ))}
      </div>
    </>
  );
}

/* ─── Route right — flight selector + verify ─── */
function RouteRight({ onLog }: { onLog:(m:string,ok?:boolean)=>void }) {
  const [verifyResult, setVerifyResult] = useState<{decision:string;simSwapped:boolean}|null>(null);
  const [loading, setLoading] = useState(false);

  const verify = async (scenario: "legit"|"fraud") => {
    setLoading(true);
    try {
      const r = await fetch("/api/verify",{ method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ scenario }) });
      const d = await r.json();
      setVerifyResult(d);
      onLog(`Verificare ${scenario} → ${d.decision}`, d.decision==="ALLOW");
    } catch { onLog("Eroare verificare identitate", false); }
    finally { setLoading(false); }
  };

  return (
    <>
      <div className="section-title">Informații Zbor</div>
      <div className="flight-list">
        {FLIGHTS.map(f => (
          <div key={f.id} className="flight-item" style={{ borderColor: "var(--border-color)" }}>
            <i className="ti ti-plane" style={{ color: f.color, fontSize:18 }} />
            <div>
              <div className="flight-nr">{f.flight}</div>
              <div className="flight-dest">{f.dest}</div>
            </div>
            <div className="flight-gate" style={{ color: f.color }}>Poarta {f.gate} · {f.departs}</div>
          </div>
        ))}
      </div>

      <div className="section-title">Verificare Identitate</div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        <button onClick={() => verify("legit")} disabled={loading} style={{ padding:"10px", background:"var(--success-bg)", border:"1px solid var(--success)", borderRadius:"var(--radius-md)", color:"var(--success)", cursor:"pointer", fontSize:13, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          <i className={`ti ti-${loading?"loader-2 spin":"user-check"}`} /> Verifică pasager legitim
        </button>
        <button onClick={() => verify("fraud")} disabled={loading} style={{ padding:"10px", background:"var(--danger-bg)", border:"1px solid var(--danger)", borderRadius:"var(--radius-md)", color:"var(--danger)", cursor:"pointer", fontSize:13, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          <i className="ti ti-user-x" /> Simulează fraudă SIM Swap
        </button>
      </div>

      {verifyResult && (
        <div className="fade-in" style={{ marginTop:12, padding:12, borderRadius:"var(--radius-md)", border:`1px solid ${verifyResult.decision==="ALLOW"?"var(--success)":"var(--danger)"}`, background:`${verifyResult.decision==="ALLOW"?"var(--success-bg)":"var(--danger-bg)"}` }}>
          <div style={{ fontWeight:600, fontSize:14, color:verifyResult.decision==="ALLOW"?"var(--success)":"var(--danger)", display:"flex", alignItems:"center", gap:8 }}>
            <i className={`ti ti-${verifyResult.decision==="ALLOW"?"circle-check":"shield-x"}`} />
            {verifyResult.decision === "ALLOW" ? "ALLOW — Pasager verificat" : "BLOCK — SIM Swap detectat"}
          </div>
          {verifyResult.simSwapped && <div style={{ fontSize:12, color:"var(--danger)", marginTop:4, opacity:0.9 }}>SIM schimbat recent — alertă securitate</div>}
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════ BOTTOM BAR ═══════════════════════════ */
function BottomBar({ feature, setFeature, logs }: { feature:Feature; setFeature:(f:Feature)=>void; logs:{ts:string;msg:string;ok:boolean}[] }) {
  return (
    <div className="bottom-bar">
      {([["heatmap","ti-map-2","Heatmap"],["weather","ti-cloud-storm","Vreme"],["route","ti-route","My Route"]] as [Feature,string,string][]).map(([id,icon,label]) => (
        <button key={id} className={`btn-tab${feature===id?" active":""}`} onClick={() => setFeature(id)}>
          <i className={`ti ${icon}`} /> {label}
        </button>
      ))}
      <div style={{ flex:2, display:"flex", alignItems:"center", gap:16, paddingLeft:8, overflow:"hidden" }}>
        {logs.slice(0,3).map((l,i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, whiteSpace:"nowrap", color:"var(--text-muted)" }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:l.ok?"var(--success)":"var(--danger)", flexShrink:0 }}/>
            <span style={{ color:"var(--text-muted)" }}>{l.ts}</span>
            <span style={{ color:l.ok?"var(--text-main)":"var(--danger)" }}>{l.msg}</span>
          </div>
        ))}
        {logs.length === 0 && <span style={{ fontSize:12, color:"var(--text-muted)" }}>Activity log</span>}
      </div>
      <button className="btn-tab" style={{ flex:"0 0 auto" }}>
        <i className="ti ti-sitemap" /> Arhitectură
      </button>
    </div>
  );
}

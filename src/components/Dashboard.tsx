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
  { id: "1", gate: "14", flight: "RO 321",  dest: "București OTP", departs: "23:15", color: "var(--success)" },
  { id: "2", gate: "7",  flight: "W6 4102", dest: "Londra LTN",    departs: "23:45", color: "var(--info)"    },
  { id: "3", gate: "11", flight: "LH 1407", dest: "Frankfurt FRA", departs: "00:10", color: "var(--warning)" },
  { id: "4", gate: "5",  flight: "FR 8821", dest: "Milano BGY",    departs: "00:30", color: "var(--brand)"   },
  { id: "5", gate: "12", flight: "AF 1234", dest: "Paris CDG",     departs: "06:45", color: "var(--danger)"  },
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

/* ── Route center — hartă JPEG + overlay SVG ── */
function RouteCenter({ onLog }: { onLog:(m:string,ok?:boolean)=>void }) {
  const [selFlight, setSelFlight] = useState<string|null>(null);
  const [userPct, setUserPct] = useState<{x:number;y:number}>(USER_START);
  const [locLoading, setLocLoading] = useState(false);
  const [hasMap, setHasMap] = useState(true); // optimistic; fallback to SVG if 404
  const animRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  const flight = FLIGHTS.find(f => f.id === selFlight) ?? null;
  const pts = flight ? ROUTE_WAYPOINTS[flight.gate] : null;

  // animate user dot along route
  useEffect(() => {
    if (animRef.current) clearTimeout(animRef.current);
    if (!pts) { setUserPct(USER_START); return; }
    let i = 0;
    const step = () => {
      if (i < pts.length) { setUserPct(pts[i]); i++; animRef.current = setTimeout(step, 450); }
    };
    setUserPct(pts[0]);
    animRef.current = setTimeout(step, 300);
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

  const gate = flight ? GATE_POSITIONS[flight.gate] : null;

  // polyline string for SVG overlay (percentages → SVG 100×100 viewBox)
  const polyline = pts ? pts.map(p => `${p.x},${p.y}`).join(" ") : "";

  return (
    <>
      <div className="map-header">
        <div className="map-title">My Route — Terminal LRIA</div>
        <div className="badges">
          <div className="badge badge-live"><span className="dot red pulse-red" /> Live</div>
          <button onClick={getLocation} disabled={locLoading} style={{ background:"var(--bg-hover)", border:"1px solid var(--border-color)", borderRadius:"var(--radius-md)", color:"var(--text-muted)", padding:"4px 10px", cursor:"pointer", fontSize:12, display:"flex", alignItems:"center", gap:6 }}>
            <i className={`ti ti-navigation${locLoading?" spin":""}`} /> Orange Location
          </button>
        </div>
      </div>

      {/* ── Hartă cu overlay SVG ── */}
      <div className="map-container" style={{ position:"relative", flex:1, overflow:"hidden", borderRadius:"var(--radius-md)", border:"1px solid var(--border-color)" }}>
        {/* Imaginea hărții aeroportului */}
        {hasMap ? (
          <img
            src="/terminal-map.jpg"
            alt="Terminal LRIA"
            onError={() => setHasMap(false)}
            style={{ width:"100%", height:"100%", objectFit:"cover", display:"block", opacity:0.85 }}
          />
        ) : (
          /* Fallback SVG plan simplificat T4 */
          <svg viewBox="0 0 100 100" style={{ width:"100%", height:"100%", background:"var(--bg-body)" }} preserveAspectRatio="none">
            {/* Corp terminal */}
            <rect x="3" y="25" width="94" height="55" rx="2" fill="#26262d" stroke="var(--border-color)" strokeWidth="0.5"/>
            {/* Zona check-in */}
            <rect x="4" y="35" width="22" height="20" rx="1" fill="#1c1c21" stroke="var(--border-color)" strokeWidth="0.3"/>
            <text x="15" y="46" textAnchor="middle" fill="var(--text-muted)" fontSize="3">Check-in</text>
            {/* Securitate */}
            <rect x="27" y="35" width="12" height="20" rx="1" fill="rgba(255,167,38,0.15)" stroke="var(--warning)" strokeWidth="0.4"/>
            <text x="33" y="46" textAnchor="middle" fill="var(--warning)" fontSize="2.8">Securit.</text>
            {/* Zona Schengen porți 5-10 */}
            <rect x="44" y="60" width="46" height="14" rx="1" fill="rgba(66,165,245,0.1)" stroke="var(--info)" strokeWidth="0.3"/>
            <text x="67" y="70" textAnchor="middle" fill="var(--info)" fontSize="3">Schengen — Porți 5–10</text>
            {/* Zona Non-Schengen porți 11-15 */}
            <rect x="60" y="26" width="36" height="14" rx="1" fill="rgba(102,187,106,0.1)" stroke="var(--success)" strokeWidth="0.3"/>
            <text x="78" y="34" textAnchor="middle" fill="var(--success)" fontSize="3">Non-Schengen 11–15</text>
            {/* Gate dots */}
            {([["5",52,74],["6",59,74],["7",65,74],["8",71,74],["9",77,74],["10",83,74],["11",68,33],["12",76,33],["14",87,33],["15",95,33]] as [string,number,number][]).map(([id,gx,gy])=>(
              <g key={id}>
                <circle cx={gx} cy={gy} r={flight?.gate===id?2.5:1.5}
                  fill={flight?.gate===id?"var(--brand)":"var(--border-color)"}
                  stroke={flight?.gate===id?"var(--brand)":"var(--text-muted)"} strokeWidth="0.4"/>
                <text x={gx} y={gy+(flight?.gate===id?-3.5:+4.5)} textAnchor="middle"
                  fill={flight?.gate===id?"var(--brand)":"var(--text-muted)"} fontSize="2.8" fontWeight={flight?.gate===id?"700":"400"}>{id}</text>
              </g>
            ))}
            {/* Intrare */}
            <rect x="3" y="55" width="6" height="10" rx="1" fill="var(--info-bg)" stroke="var(--info)" strokeWidth="0.4"/>
            <text x="6" y="61" textAnchor="middle" fill="var(--info)" fontSize="2.5">IN</text>
          </svg>
        )}

        {/* SVG overlay transparent — rută + dot utilizator */}
        <svg
          viewBox="0 0 100 100"
          style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none" }}
          preserveAspectRatio="none"
        >
          {/* Ruta */}
          {pts && (
            <polyline
              points={polyline}
              fill="none"
              stroke="var(--brand)"
              strokeWidth="1.2"
              strokeDasharray="3 1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Poarta destinație */}
          {gate && (
            <g>
              <circle cx={gate.x} cy={gate.y} r="3" fill="var(--brand)" opacity="0.9"/>
              <circle cx={gate.x} cy={gate.y} r="5" fill="none" stroke="var(--brand)" strokeWidth="0.8" opacity="0.5"/>
              <text x={gate.x} y={gate.y-5} textAnchor="middle" fill="var(--brand)" fontSize="3.5" fontWeight="700">{gate.label}</text>
            </g>
          )}

          {/* User dot */}
          <g style={{ filter:"drop-shadow(0 0 2px #ff6600)" }}>
            <circle cx={userPct.x} cy={userPct.y} r="3.5" fill="rgba(255,102,0,0.25)"/>
            <circle cx={userPct.x} cy={userPct.y} r="2.2" fill="var(--brand)"/>
            <circle cx={userPct.x} cy={userPct.y} r="0.9" fill="#fff"/>
          </g>

          {/* Start label */}
          <text x={USER_START.x} y={USER_START.y - 5} textAnchor="middle" fill="var(--info)" fontSize="3.5">Tu ești aici</text>
        </svg>

        {/* Hint dacă nu e poza */}
        {!hasMap && (
          <div style={{ position:"absolute", bottom:8, left:0, right:0, textAlign:"center", fontSize:11, color:"var(--text-muted)" }}>
            Adaugă <code style={{color:"var(--brand)"}}>public/terminal-map.jpg</code> pentru harta reală
          </div>
        )}
      </div>
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

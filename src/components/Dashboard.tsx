import { useState, useEffect, useRef } from "react";
import { pixelToGps, gpsToPixel, LOCATIONS, IMG_W, IMG_H } from "../lib/geo-transform";
import type { WeatherProvider } from "../lib/weather";

type Feature = "weather" | "route" | "heatmap";

/* ── flights / route ── */
const FLIGHTS = [
  { id: "1", gate: "4",  flight: "RO 321",  dest: "București OTP", departs: "23:15", color: "var(--success)" },
  { id: "2", gate: "2",  flight: "W6 4102", dest: "Londra LTN",    departs: "23:45", color: "var(--info)"    },
  { id: "3", gate: "T3", flight: "LH 1407", dest: "Frankfurt FRA", departs: "00:10", color: "var(--warning)" },
  { id: "4", gate: "5",  flight: "FR 8821", dest: "Milano BGY",    departs: "00:30", color: "var(--brand)"   },
  { id: "5", gate: "T3", flight: "AF 1234", dest: "Paris CDG",     departs: "06:45", color: "var(--danger)"  },
];

// Waypoints în pixel-space al imaginii "Plan parter fluxuri ON.jpg"
// Ruta: intrare T4 → check-in → baza scări → poartă (etaj)
// Coordonatele % sunt relative la IMG_W x IMG_H pentru SVG overlay
const pct = (px: number, dim: number) => (px / dim) * 100;

const PT = {
  intrare:   { x: pct(LOCATIONS.intrare.x,   IMG_W), y: pct(LOCATIONS.intrare.y,   IMG_H) },
  checkin1:  { x: pct(LOCATIONS.checkin1.x,  IMG_W), y: pct(LOCATIONS.checkin1.y,  IMG_H) },
  checkin5:  { x: pct(LOCATIONS.checkin5.x,  IMG_W), y: pct(LOCATIONS.checkin5.y,  IMG_H) },
  checkin10: { x: pct(LOCATIONS.checkin10.x, IMG_W), y: pct(LOCATIONS.checkin10.y, IMG_H) },
  securit:   { x: pct(LOCATIONS.securitate.x,IMG_W), y: pct(LOCATIONS.securitate.y,IMG_H) },
  bazaScari: { x: pct(LOCATIONS.bazaScari.x, IMG_W), y: pct(LOCATIONS.bazaScari.y, IMG_H) },
};

// Porți etaj — pozitionate estimativ pe axa dreptei terminale (etajul nu e în poza parter)
// Vor fi afișate ca destinații finale deasupra hărții parter
const GATE_LABELS: Record<string, string> = {
  "1":"Poarta 1","2":"Poarta 2","3":"Poarta 3","4":"Poarta 4","5":"Poarta 5","6":"Poarta 6","T3":"T3 Non-Schengen"
};

// Ruta comună parter: intrare → check-in → securitate → baza scări
const COMMON: { x:number; y:number }[] = [
  PT.intrare, PT.checkin1, PT.checkin5, PT.checkin10, PT.securit, PT.bazaScari
];

// Toate zborurile au aceeași rută pe parter (diferența e la etaj — marcat separat)
const ROUTE_PX: Record<string, { x:number; y:number }[]> = {
  "1": COMMON, "2": COMMON, "3": COMMON, "4": COMMON, "5": COMMON, "T3": COMMON,
};

/* ═══════════════════════════ DASHBOARD ═══════════════════════════ */
export default function Dashboard() {
  const [feature, setFeature] = useState<Feature>("weather");
  const [logs, setLogs] = useState<{ ts: string; msg: string; ok: boolean }[]>([]);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [weatherProvider, setWeatherProvider] = useState<WeatherProvider>("open-meteo");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const addLog = (msg: string, ok = true) =>
    setLogs(p => [{ ts: new Date().toLocaleTimeString("ro"), msg, ok }, ...p].slice(0, 30));

  return (
    <div id="dashboard">
      <div className="dashboard-grid">
        <LeftPanel feature={feature} setFeature={setFeature} theme={theme} setTheme={setTheme} logs={logs} />
        <CenterPanel feature={feature} onLog={addLog} weatherProvider={weatherProvider} />
        <RightPanel feature={feature} onLog={addLog} weatherProvider={weatherProvider} setWeatherProvider={setWeatherProvider} />
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

const USER_NAV = [
  { icon: "ti-user-circle",    label: "Contul meu"  },
  { icon: "ti-plane-departure",label: "Zborul meu"  },
  { icon: "ti-bell",           label: "Notificări"  },
  { icon: "ti-settings",       label: "Setări"      },
  { icon: "ti-help-circle",    label: "Ajutor"      },
];

function LeftPanel({
  feature, setFeature, theme, setTheme, logs,
}: {
  feature: Feature; setFeature: (f: Feature) => void;
  theme: "dark" | "light"; setTheme: (t: "dark" | "light") => void;
  logs: { ts: string; msg: string; ok: boolean }[];
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      {/* ── Mobile: backdrop + floating hamburger + drawer ── */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position:"fixed", inset:0, zIndex:200,
            background:"rgba(0,0,0,0.5)", backdropFilter:"blur(2px)",
          }}
        />
      )}

      {/* Floating hamburger — mobile only (hidden on desktop via CSS) */}
      <button
        className="hamburger-float"
        onClick={() => setDrawerOpen(true)}
        title="Meniu"
      >
        <i className="ti ti-menu-2" />
      </button>

      {/* Drawer — mobile only (hidden on desktop via CSS) */}
      <div className={`side-drawer${drawerOpen ? " open" : ""}`}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <span style={{ fontSize:14, fontWeight:600 }}>Meniu</span>
          <button className="btn-theme-toggle" onClick={() => setDrawerOpen(false)} title="Închide">
            <i className="ti ti-x" />
          </button>
        </div>

        <div className="section-title">Navigare</div>
        <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:20 }}>
          {NAV.map(n => (
            <button
              key={n.id}
              className={`btn-tab${feature === n.id ? " active" : ""}`}
              style={{ justifyContent:"flex-start", flex:"unset", padding:"10px 12px" }}
              onClick={() => { setFeature(n.id); setDrawerOpen(false); }}
            >
              <i className={`ti ${n.icon}`} style={{ fontSize:17 }} />
              {n.label}
            </button>
          ))}
        </div>

        <div className="section-title">Pasager</div>
        <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:20 }}>
          {USER_NAV.map(n => (
            <button
              key={n.label}
              className="btn-tab"
              style={{ justifyContent:"flex-start", flex:"unset", padding:"10px 12px" }}
              onClick={() => setDrawerOpen(false)}
            >
              <i className={`ti ${n.icon}`} style={{ fontSize:17 }} />
              {n.label}
            </button>
          ))}
        </div>

        {logs.length > 0 && (
          <>
            <div className="section-title">Activitate recentă</div>
            <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
              {logs.slice(0,8).map((l,i) => (
                <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:7, fontSize:11, color:"var(--text-muted)" }}>
                  <span style={{ width:6, height:6, borderRadius:"50%", marginTop:3, background:l.ok?"var(--success)":"var(--danger)", flexShrink:0 }}/>
                  <span style={{ flexShrink:0 }}>{l.ts}</span>
                  <span style={{ color:l.ok?"var(--text-main)":"var(--danger)" }}>{l.msg}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Main left panel — desktop only (hidden on mobile via CSS) ── */}
      <div className="card sidebar-left">
        <div className="brand-header">
          <div className="brand-icon"><i className="ti ti-wifi" /></div>
          <div style={{ flex: 1 }}>
            <div className="brand-title">AirFlow Nexus</div>
            <div className="brand-sub">powered by Orange APIs</div>
          </div>
          <button
            className="btn-theme-toggle"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            <i className={`ti ${theme === "dark" ? "ti-sun" : "ti-moon"}`} />
          </button>
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
    </>
  );
}

/* ═══════════════════════════ CENTER PANEL ═══════════════════════════ */
function CenterPanel({
  feature, onLog, weatherProvider,
}: {
  feature: Feature; onLog: (m: string, ok?: boolean) => void; weatherProvider: WeatherProvider;
}) {
  return (
    <div className="card main-center">
      {feature === "weather" && <WeatherCenter onLog={onLog} provider={weatherProvider} />}
      {feature === "route"   && <RouteCenter   onLog={onLog} />}
      {feature === "heatmap" && <HeatmapCenter onLog={onLog} />}
    </div>
  );
}

/* ── Weather center — pilot + ATC full briefing ── */
interface WData {
  temperatureC: number; apparentTemperatureC: number; windSpeedKt: number;
  windDirection: number; humidity: number; weatherDescription: string;
  precipitationMm: number; timestamp: string; fromFixture?: boolean;
}
interface MData {
  raw: string; flightCategory: string; observedAt?: string;
  wind: { directionDeg: number; speedKt: number; gustKt: number | null; variableFrom: number|null; variableTo: number|null; isVariable: boolean };
  visibility: { meters: number; unlimited: boolean };
  clouds: { cover: string; baseFt: number; type: string|null }[];
  temperature: { tempC: number; dewpointC: number };
  altimeter: { qnhHpa: number };
  phenomena: string[];
  trend: { type: string; wind: unknown; visibility: unknown; phenomena: string[]; clouds: unknown[] } | null;
  fromFixture?: boolean; warning?: string;
}

// LRIA runway heading: 08/26 → RWY 08 = 080°, RWY 26 = 260°
const RWY_HDG: Record<string, number> = { "08": 80, "26": 260 };

function calcWindComponents(windDir: number, windSpd: number, rwyHdg: number) {
  const angle = ((windDir - rwyHdg) * Math.PI) / 180;
  return {
    headwind: Math.round(windSpd * Math.cos(angle)),
    crosswind: Math.round(Math.abs(windSpd * Math.sin(angle))),
  };
}

// Density altitude approx: PA + 120*(OAT - ISA)
function densityAltitude(qnh: number, elevFt: number, tempC: number): number {
  const pressureAltFt = elevFt + (1013.25 - qnh) * 30;
  const isaTemp = 15 - 2 * (pressureAltFt / 1000);
  return Math.round(pressureAltFt + 120 * (tempC - isaTemp));
}

// Dew point spread → fog risk
function dewSpread(tempC: number, dewC: number) {
  const spread = tempC - dewC;
  if (spread <= 2) return { label: "Risc ceață ridicat", color: "var(--danger)" };
  if (spread <= 5) return { label: "Risc ceață moderat", color: "var(--warning)" };
  return { label: "Risc ceață scăzut", color: "var(--success)" };
}

const CAT_COL: Record<string, string> = {
  VFR:"var(--success)", MVFR:"var(--info)", IFR:"var(--warning)", LIFR:"var(--danger)"
};
const CAT_LABEL: Record<string, string> = {
  VFR:"Visual Flight Rules", MVFR:"Marginal VFR", IFR:"Instrument Rules", LIFR:"Low IFR"
};
const COVER_PCT: Record<string,number> = { SKC:0, CLR:0, FEW:25, SCT:50, BKN:75, OVC:100, VV:100 };
const PHENOM_LABEL: Record<string,string> = {
  TS:"Furtună",TSRA:"Furtună cu ploaie",RA:"Ploaie",SN:"Ninsoare",FG:"Ceață",
  BR:"Burniță",DZ:"Burnă",GR:"Grindină",SHRA:"Aversă ploaie",SHSN:"Aversă ninsoare",
  "-RA":"Ploaie ușoară","+RA":"Ploaie intensă","-SN":"Ninsoare ușoară","+TS":"Furtună severă",
};

function InfoCard({ label, value, sub, color, icon }: { label:string; value:string; sub?:string; color?:string; icon?:string }) {
  return (
    <div style={{ background:"var(--bg-body)", border:"1px solid var(--border-color)", borderRadius:"var(--radius-md)", padding:"12px" }}>
      <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:4, display:"flex", alignItems:"center", gap:5 }}>
        {icon && <i className={`ti ${icon}`} style={{ fontSize:13 }} />} {label}
      </div>
      <div style={{ fontSize:17, fontWeight:700, color: color ?? "var(--text-main)", lineHeight:1.2 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:3 }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="section-title" style={{ marginTop:16, marginBottom:8 }}>{children}</div>;
}

const PROVIDER_LABELS: Record<WeatherProvider, string> = {
  "open-meteo": "Open-Meteo",
  "openweathermap": "OpenWeatherMap",
  "meteoblue": "Meteoblue",
  "accuweather": "AccuWeather",
};

function WeatherCenter({ onLog, provider }: { onLog:(m:string,ok?:boolean)=>void; provider: WeatherProvider }) {
  const [w, setW] = useState<WData|null>(null);
  const [m, setM] = useState<MData|null>(null);
  const [loading, setLoading] = useState(false);
  const [rwy, setRwy] = useState<"08"|"26">("08");
  // Cache: avoid re-fetching the same provider (load-once in test mode)
  const wCache = useRef<Partial<Record<WeatherProvider, WData>>>({});
  const mCache = useRef<MData|null>(null);

  const load = async () => {
    // Use cache if available (fixture data is never re-fetched)
    if (wCache.current[provider]) {
      setW(wCache.current[provider]!);
      if (mCache.current) setM(mCache.current);
      return;
    }
    setLoading(true);
    try {
      const metarPromise = mCache.current
        ? Promise.resolve(mCache.current)
        : fetch("/api/metar?station=LRIA").then(r => r.json());
      const [wd, md] = await Promise.all([
        fetch(`/api/weather-provider?provider=${provider}`).then(r => r.json()),
        metarPromise,
      ]);
      wCache.current[provider] = wd;
      mCache.current = md;
      setW(wd); setM(md);
      onLog(`${PROVIDER_LABELS[provider]} · ${md.flightCategory} · ${md.wind?.speedKt}kt ${md.wind?.directionDeg}°`);
    } catch { onLog("Eroare fetch meteo", false); }
    finally { setLoading(false); }
  };

  const handleRefresh = () => {
    // Don't re-fetch fixture data to save calls
    if (w?.fromFixture) return;
    delete wCache.current[provider];
    mCache.current = null;
    load();
  };

  useEffect(() => { load(); }, [provider]);

  const cat = m?.flightCategory ?? "VFR";
  const catColor = CAT_COL[cat] ?? "var(--success)";

  // Computed values
  const wind = m?.wind;
  const temp = m?.temperature;
  const qnh = m?.altimeter?.qnhHpa ?? 1013;
  const wComponents = wind ? calcWindComponents(wind.directionDeg, wind.speedKt, RWY_HDG[rwy]) : null;
  const da = temp ? densityAltitude(qnh, 321, temp.tempC) : null; // LRIA elev = 321 ft
  const spread = temp ? dewSpread(temp.tempC, temp.dewpointC) : null;
  const relHumidity = temp ? Math.round(100 - 5 * (temp.tempC - temp.dewpointC)) : null;

  // Predominant cloud ceiling
  const ceiling = m?.clouds?.find(c => c.cover === "BKN" || c.cover === "OVC" || c.cover === "VV");
  const visM = m?.visibility?.meters ?? 9999;
  const visText = m?.visibility?.unlimited ? "> 10 km" : visM >= 1000 ? `${(visM/1000).toFixed(1)} km` : `${visM} m`;

  return (
    <div style={{ padding:20, height:"100%", display:"flex", flexDirection:"column", overflowY:"auto", gap:0 }}>

      {/* ── Header ── */}
      <div className="map-header">
        <div>
          <div className="map-title">Briefing Meteorologic — LRIA Iași</div>
          <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>
            <span style={{ color:"var(--brand)", fontWeight:600 }}>{PROVIDER_LABELS[provider]}</span>
            {" · "}
            {m?.observedAt ? new Date(m.observedAt).toLocaleString("ro", { hour:"2-digit", minute:"2-digit", day:"2-digit", month:"short" }) : "—"} UTC
            {(w?.fromFixture || m?.fromFixture) && <span style={{ marginLeft:8, color:"var(--warning)" }}>· fixture</span>}
          </div>
        </div>
        <div className="badges">
          <div className="badge" style={{ background:`${catColor}22`, color:catColor, border:`1px solid ${catColor}44`, fontSize:13, fontWeight:700, padding:"6px 14px" }}>
            {cat}
          </div>
          <button onClick={handleRefresh} disabled={w?.fromFixture} title={w?.fromFixture ? "Fixture — no re-fetch in test mode" : "Refresh"} style={{ background:"var(--bg-hover)", border:"1px solid var(--border-color)", borderRadius:"var(--radius-md)", color: w?.fromFixture ? "var(--border-color)" : "var(--text-muted)", padding:"6px 12px", cursor: w?.fromFixture ? "default" : "pointer", fontSize:12 }}>
            <i className={`ti ti-refresh${loading?" spin":""}`} />
          </button>
        </div>
      </div>

      {/* ── Flight category bar ── */}
      <div style={{ background:`${catColor}15`, border:`1px solid ${catColor}44`, borderRadius:"var(--radius-md)", padding:"10px 14px", display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
        <span style={{ fontWeight:700, color:catColor, fontSize:15 }}>{cat}</span>
        <span style={{ color:catColor, fontSize:13 }}>{CAT_LABEL[cat]}</span>
        <span style={{ marginLeft:"auto", fontSize:12, color:"var(--text-muted)" }}>
          {m?.phenomena && m.phenomena.length > 0
            ? m.phenomena.map(p => PHENOM_LABEL[p] ?? p).join(", ")
            : "Fără fenomene semnificative"}
        </span>
      </div>

      {/* ── METAR raw ── */}
      <div className="metar-raw" style={{ marginTop:12 }}>{m?.raw ?? "Se încarcă METAR..."}</div>

      {/* ── Vânt + pistă ── */}
      <SectionTitle>Vânt & Componente Pistă</SectionTitle>
      <div className="info-grid">
        <InfoCard icon="ti-wind" label="Direcție / Viteză"
          value={wind?.isVariable ? `VRB ${wind.speedKt}kt` : `${wind?.directionDeg}° / ${wind?.speedKt}kt`}
          sub={wind?.gustKt ? `Rafale G${wind.gustKt}kt` : "Fără rafale"}
          color={wind?.gustKt && wind.gustKt > 25 ? "var(--danger)" : undefined}
        />
        <InfoCard icon="ti-arrow-up" label="Headwind / Tailwind"
          value={wComponents ? `${wComponents.headwind >= 0 ? "HW" : "TW"} ${Math.abs(wComponents.headwind)}kt` : "—"}
          sub={`Pistă ${rwy} (${RWY_HDG[rwy]}°)`}
          color={wComponents && Math.abs(wComponents.headwind) > 20 ? "var(--warning)" : undefined}
        />
        <InfoCard icon="ti-arrow-right" label="Crosswind"
          value={wComponents ? `${wComponents.crosswind}kt` : "—"}
          sub={wComponents && wComponents.crosswind > 15 ? "⚠ Depășit limită tipică" : "În limite normale"}
          color={wComponents && wComponents.crosswind > 15 ? "var(--danger)" : wComponents && wComponents.crosswind > 10 ? "var(--warning)" : "var(--success)"}
        />
        {/* Runway selector */}
        <div style={{ background:"var(--bg-body)", border:"1px solid var(--border-color)", borderRadius:"var(--radius-md)", padding:"12px", display:"flex", flexDirection:"column", gap:6 }}>
          <div style={{ fontSize:11, color:"var(--text-muted)" }}>Pistă activă</div>
          {(["08","26"] as const).map(r => (
            <button key={r} onClick={() => setRwy(r)}
              style={{ padding:"5px 8px", borderRadius:6, border:`1px solid ${rwy===r?"var(--brand)":"var(--border-color)"}`, background:rwy===r?"rgba(255,102,0,0.15)":"transparent", color:rwy===r?"var(--brand)":"var(--text-muted)", cursor:"pointer", fontSize:12, fontWeight:600, textAlign:"left" }}>
              RWY {r} — {RWY_HDG[r]}°
            </button>
          ))}
        </div>
      </div>

      {/* ── Vizibilitate & nori ── */}
      <SectionTitle>Vizibilitate & Plafon Noros</SectionTitle>
      <div className="info-grid">
        <InfoCard icon="ti-eye" label="Vizibilitate"
          value={visText}
          color={visM < 1000 ? "var(--danger)" : visM < 3000 ? "var(--warning)" : "var(--success)"}
          sub={visM < 1500 ? "⚠ Sub minime IFR" : visM < 5000 ? "Operare instrument" : "VFR OK"}
        />
        <InfoCard icon="ti-cloud" label="Plafon (Ceiling)"
          value={ceiling ? `${ceiling.cover} ${ceiling.baseFt.toLocaleString()}'` : "SKC / No ceiling"}
          sub={ceiling ? `${Math.round(ceiling.baseFt * 0.3048)} m AMSL${ceiling.type ? ` · ${ceiling.type}` : ""}` : "Cer senin"}
          color={ceiling && ceiling.baseFt < 500 ? "var(--danger)" : ceiling && ceiling.baseFt < 1500 ? "var(--warning)" : "var(--success)"}
        />
        {m?.clouds?.map((c,i) => (
          <div key={i} style={{ background:"var(--bg-body)", border:"1px solid var(--border-color)", borderRadius:"var(--radius-md)", padding:"12px" }}>
            <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:4 }}>Strat nor {i+1}</div>
            <div style={{ fontSize:16, fontWeight:700 }}>{c.cover} {c.baseFt.toLocaleString()}'</div>
            <div style={{ marginTop:6, height:4, background:"var(--bg-hover)", borderRadius:2, overflow:"hidden" }}>
              <div style={{ width:`${COVER_PCT[c.cover]??0}%`, height:"100%", background:"var(--info)", borderRadius:2 }}/>
            </div>
            <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:3 }}>{COVER_PCT[c.cover]}% acoperire{c.type ? ` · ${c.type}` : ""}</div>
          </div>
        ))}
      </div>

      {/* ── Temperatură & presiune ── */}
      <SectionTitle>Temperatură, Presiune & Performanță</SectionTitle>
      <div className="info-grid">
        <InfoCard icon="ti-temperature" label="Temperatură / Dew"
          value={temp ? `${temp.tempC > 0 ? "+" : ""}${temp.tempC}°C / ${temp.dewpointC}°C` : "—"}
          sub={`Spread ${temp ? temp.tempC - temp.dewpointC : "—"}°C`}
        />
        <InfoCard icon="ti-droplet" label="Umiditate relativă"
          value={`${relHumidity ?? "—"}%`}
          sub={spread?.label}
          color={spread?.color}
        />
        <InfoCard icon="ti-gauge" label="QNH"
          value={`${qnh} hPa`}
          sub={`${(qnh * 0.02953).toFixed(2)} inHg · ${qnh > 1013 ? "↑ Anticiclon" : qnh < 1005 ? "↓ Depresiune" : "Presiune normală"}`}
          color={qnh < 995 ? "var(--danger)" : qnh < 1005 ? "var(--warning)" : undefined}
        />
        <InfoCard icon="ti-mountain" label="Density Altitude"
          value={da !== null ? `${da.toLocaleString()} ft` : "—"}
          sub={`Elev. LRIA: 321ft · ${da !== null && da > 5000 ? "⚠ Performanță redusă" : "Normal"}`}
          color={da !== null && da > 5000 ? "var(--warning)" : undefined}
        />
      </div>

      {/* ── Trend ── */}
      {m?.trend && (
        <>
          <SectionTitle>Tendință (Trend)</SectionTitle>
          <div style={{ background:"var(--bg-body)", border:`1px solid ${m.trend.type==="NOSIG"?"var(--success)":"var(--warning)"}`, borderRadius:"var(--radius-md)", padding:"12px", flexShrink:0 }}>
            <div style={{ fontWeight:700, color: m.trend.type==="NOSIG"?"var(--success)":"var(--warning)", marginBottom:4 }}>
              {m.trend.type === "NOSIG" ? "NOSIG — Nicio schimbare semnificativă" : m.trend.type}
            </div>
            {m.trend.type !== "NOSIG" && (
              <div style={{ fontSize:12, color:"var(--text-muted)" }}>
                {m.trend.phenomena?.map((p:string) => PHENOM_LABEL[p]??p).join(", ")}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Avertismente ── */}
      {(m?.warning) && (
        <div style={{ marginTop:12, background:"var(--warning-bg)", border:"1px solid var(--warning)", borderRadius:"var(--radius-md)", padding:"10px 14px", fontSize:12, color:"var(--warning)", flexShrink:0 }}>
          <i className="ti ti-alert-triangle" style={{ marginRight:6 }}/>{m.warning}
        </div>
      )}
    </div>
  );
}

// SVG waypoints în spațiul viewBox="0 0 2262 587" al hărții harta_completa.svg
// Rescalate din 0-1200×0-600 → 0-2262×0-587 (scaleX=1.885, scaleY=0.978)
const GATE_SVG: Record<string, { x: number; y: number }> = {
  "1":  { x: 283,  y: 225 }, "2":  { x: 603,  y: 225 }, "3":  { x: 924,  y: 225 },
  "4":  { x: 1244, y: 225 }, "5":  { x: 1565, y: 225 }, "6":  { x: 1885, y: 225 },
  "T3": { x: 1979, y: 421 },
};

const ROUTE_SVG: Record<string, { x: number; y: number }[]> = {
  "1":  [{x:396,y:479},{x:396,y:391},{x:716,y:391},{x:283,y:294},{x:283,y:225}],
  "2":  [{x:396,y:479},{x:396,y:391},{x:716,y:391},{x:603,y:294},{x:603,y:225}],
  "3":  [{x:396,y:479},{x:396,y:391},{x:961,y:391},{x:924,y:294},{x:924,y:225}],
  "4":  [{x:396,y:479},{x:396,y:391},{x:961,y:391},{x:1206,y:391},{x:1244,y:294},{x:1244,y:225}],
  "5":  [{x:396,y:479},{x:396,y:391},{x:961,y:391},{x:1206,y:391},{x:1565,y:294},{x:1565,y:225}],
  "6":  [{x:396,y:479},{x:396,y:391},{x:961,y:391},{x:1206,y:391},{x:1885,y:294},{x:1885,y:225}],
  "T3": [{x:396,y:479},{x:396,y:391},{x:961,y:391},{x:1206,y:391},{x:1810,y:391},{x:1979,y:421}],
};

function RouteCenter({ onLog }: { onLog:(m:string,ok?:boolean)=>void }) {
  const [selFlight, setSelFlight] = useState<string|null>(null);
  const [userPos, setUserPos] = useState<{x:number;y:number}>({x:396,y:479});
  const [userGps, setUserGps] = useState<{lat:number;lng:number}|null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const gmapRef = useRef<HTMLDivElement>(null);
  const gmapInstance = useRef<google.maps.Map|null>(null);
  const markerRef = useRef<google.maps.Marker|null>(null);
  const animRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  // Zoom / pan state
  const [mapZoom, setMapZoom] = useState(1);
  const [mapPan, setMapPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const mapWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = mapWrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      setMapZoom(z => Math.min(Math.max(z * factor, 0.5), 6));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const startDrag = (clientX: number, clientY: number) => {
    dragRef.current = { startX: clientX, startY: clientY, panX: mapPan.x, panY: mapPan.y };
    setIsDragging(true);
  };
  const moveDrag = (clientX: number, clientY: number) => {
    if (!dragRef.current) return;
    const { startX, startY, panX, panY } = dragRef.current;
    setMapPan({ x: panX + clientX - startX, y: panY + clientY - startY });
  };
  const endDrag = () => { dragRef.current = null; setIsDragging(false); };

  const zoomBtnStyle: React.CSSProperties = {
    width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
    background: "var(--bg-card)", border: "1px solid var(--border-color)",
    borderRadius: "var(--radius-md)", color: "var(--text-main)", cursor: "pointer",
    fontSize: 16, fontWeight: 700, lineHeight: 1, boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
  };

  const flight = FLIGHTS.find(f => f.id === selFlight) ?? null;
  const pts = flight ? ROUTE_SVG[flight.gate] : null;
  const gatePos = flight ? GATE_SVG[flight.gate] : null;
  const polyline = pts ? pts.map(p => `${p.x},${p.y}`).join(" ") : "";

  // Animate user dot along SVG route
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

  // Init Google Maps hidden underneath — always on mount, for GPS accuracy
  useEffect(() => {
    const key = (window as any).__GOOGLE_MAPS_KEY__;
    if (!key || !gmapRef.current) return;
    if (gmapInstance.current) return;

    import("@googlemaps/js-api-loader").then(({ Loader }) => {
      const loader = new Loader({ apiKey: key, version: "weekly" });
      loader.load().then(() => {
        if (!gmapRef.current) return;
        const map = new google.maps.Map(gmapRef.current, {
          center: { lat: 47.1744, lng: 27.6193 },
          zoom: 18,
          mapTypeId: "satellite",
          disableDefaultUI: true,
          zoomControl: false,
          tilt: 0,
        });
        gmapInstance.current = map;
        markerRef.current = new google.maps.Marker({
          map,
          position: { lat: 47.1744, lng: 27.6193 },
          title: "Tu ești aici",
          icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: "#ff6600", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
        });
      }).catch(() => {});
    }).catch(() => {});
  }, []);

  // Update marker when GPS changes
  useEffect(() => {
    if (!userGps || !markerRef.current) return;
    markerRef.current.setPosition(userGps);
    gmapInstance.current?.panTo(userGps);
  }, [userGps]);

  const getLocation = async () => {
    setLocLoading(true);
    try {
      const r = await fetch("/api/location", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ phoneNumber: "+99012345678" }),
      });
      const d = await r.json();
      const lat = d.location?.latitude;
      const lng = d.location?.longitude;
      if (lat && lng) {
        setUserGps({ lat, lng });
        // Convert GPS → floor plan pixel → SVG %
        const px = gpsToPixel({ lat, lng });
        const svgX = (px.x / IMG_W) * 2262;
        const svgY = (px.y / IMG_H) * 587;
        setUserPos({ x: svgX, y: svgY });
        onLog(`Orange Location · lat ${lat.toFixed(4)} lng ${lng.toFixed(4)}`);
      }
    } catch { onLog("Eroare Orange Location API", false); }
    finally { setLocLoading(false); }
  };

  return (
    <>
      <div className="map-header">
        <div style={{ flex:1, minWidth:0 }}>
          <div className="map-title">My Route — Terminal T4 LRIA</div>
          <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>
            {userGps ? `GPS: ${userGps.lat.toFixed(5)}, ${userGps.lng.toFixed(5)}` : "Locație neprimită încă"}
          </div>
        </div>
        <div className="badges" style={{ gap:8, flexShrink:0 }}>
          {/* Flight dropdown */}
          <select
            value={selFlight ?? ""}
            onChange={e => setSelFlight(e.target.value || null)}
            style={{
              background:"var(--bg-hover)", border:"1px solid var(--border-color)",
              borderRadius:"var(--radius-md)", color:"var(--text-main)",
              padding:"5px 10px", fontSize:12, cursor:"pointer",
              fontFamily:"inherit", outline:"none",
            }}
          >
            <option value="">— Selectează zborul —</option>
            {FLIGHTS.map(f => (
              <option key={f.id} value={f.id}>{f.flight} → {f.dest} · {f.departs}</option>
            ))}
          </select>
          <button onClick={getLocation} disabled={locLoading} style={{ background:"var(--bg-hover)", border:"1px solid var(--border-color)", borderRadius:"var(--radius-md)", color:"var(--text-muted)", padding:"5px 10px", cursor:"pointer", fontSize:12, display:"flex", alignItems:"center", gap:6 }}>
            <i className={`ti ti-navigation${locLoading?" spin":""}`}/> Orange Location
          </button>
        </div>
      </div>

      {/* ── Zoomable / pannable map ── */}
      <div
        ref={mapWrapRef}
        className="map-container"
        style={{
          position: "relative", flex: 1,
          borderRadius: "var(--radius-md)", overflow: "hidden",
          border: "1px solid var(--border-color)",
          cursor: isDragging ? "grabbing" : "grab",
          userSelect: "none",
        }}
        onMouseDown={e => startDrag(e.clientX, e.clientY)}
        onMouseMove={e => moveDrag(e.clientX, e.clientY)}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onTouchStart={e => e.touches.length === 1 && startDrag(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={e => { e.preventDefault(); e.touches.length === 1 && moveDrag(e.touches[0].clientX, e.touches[0].clientY); }}
        onTouchEnd={endDrag}
      >
        {/* Zoom controls — top-right overlay */}
        <div style={{ position:"absolute", top:8, right:8, zIndex:10, display:"flex", flexDirection:"column", gap:4 }}>
          <button style={zoomBtnStyle} onClick={() => setMapZoom(z => Math.min(z * 1.25, 6))} title="Zoom in">+</button>
          <button style={zoomBtnStyle} onClick={() => setMapZoom(z => Math.max(z * 0.8, 0.5))} title="Zoom out">−</button>
          <button style={{ ...zoomBtnStyle, fontSize:12 }} onClick={() => { setMapZoom(1); setMapPan({ x:0, y:0 }); }} title="Reset">
            <i className="ti ti-home-2" />
          </button>
        </div>

        {/* Layer 0: Google Maps — hidden, GPS tracking only */}
        <div ref={gmapRef} style={{ position:"absolute", inset:0, opacity:0, pointerEvents:"none", zIndex:0 }} />

        {/* Transformable wrapper — floor plan + route overlay move together */}
        <div style={{
          position: "absolute", inset: 0,
          transform: `translate(${mapPan.x}px, ${mapPan.y}px) scale(${mapZoom})`,
          transformOrigin: "center center",
        }}>
          {/* Layer 1: SVG floor plan */}
          <img
            src="/harta_completa.svg"
            alt="Hartă completă T4 LRIA"
            draggable={false}
            style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"contain", objectPosition:"center", display:"block", zIndex:1 }}
          />

          {/* Layer 2: Route overlay SVG */}
          <svg
            viewBox="0 0 2262 587"
            preserveAspectRatio="xMidYMid meet"
            style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none", zIndex:2 }}
          >
            <defs>
              <filter id="glow2"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            </defs>

            {pts && (
              <polyline
                points={polyline}
                fill="none" stroke="#38BDF8" strokeWidth="4"
                strokeDasharray="12 8" strokeLinecap="round" strokeLinejoin="round"
                style={{ animation:"moveDash 1.5s linear infinite", filter:"drop-shadow(0 0 6px rgba(56,189,248,0.8))" }}
              />
            )}

            {gatePos && (
              <g filter="url(#glow2)">
                <circle cx={gatePos.x} cy={gatePos.y} r="14" fill="none" stroke="#10B981" strokeWidth="2" opacity="0.6" style={{animation:"pulse 2s infinite"}}/>
                <circle cx={gatePos.x} cy={gatePos.y} r="7" fill="#10B981"/>
                <text x={gatePos.x} y={gatePos.y-18} textAnchor="middle" fill="#10B981" fontSize="12" fontWeight="700">
                  {flight ? GATE_LABELS[flight.gate] : ""}
                </text>
              </g>
            )}

            <g filter="url(#glow2)">
              <circle cx={userPos.x} cy={userPos.y} r="14" fill="none" stroke="#38BDF8" strokeWidth="2" opacity="0.5" style={{animation:"pulse 2s infinite"}}/>
              <circle cx={userPos.x} cy={userPos.y} r="7" fill="#38BDF8"/>
              <circle cx={userPos.x} cy={userPos.y} r="3" fill="#fff"/>
            </g>
            <text x={userPos.x} y={userPos.y+26} fill="#E0F2FE" fontSize="11" textAnchor="middle">Tu ești aici</text>
          </svg>
        </div>

        <style>{`
          @keyframes moveDash { to { stroke-dashoffset: -200; } }
          @keyframes pulse { 0%,100%{transform:scale(0.9);opacity:1} 50%{transform:scale(1.3);opacity:0.7} }
        `}</style>
      </div>

      {/* Info strip */}
      {flight && (
        <div className="fade-in" style={{ marginTop:10, padding:"10px 14px", borderRadius:"var(--radius-md)", border:`1px solid var(--brand)`, background:"rgba(255,102,0,0.1)", display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
          <i className="ti ti-plane" style={{color:"var(--brand)",fontSize:20}}/>
          <div style={{flex:1}}>
            <div style={{fontWeight:600,fontSize:14}}>{flight.flight} → {flight.dest}</div>
            <div style={{fontSize:12,color:"var(--text-muted)"}}>
              {GATE_LABELS[flight.gate]} · Decolare {flight.departs} · Urci la etaj după securitate
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Heatmap center — Google Maps + Orange Population Density ── */

// LRIA airport center
const LRIA_CENTER = { lat: 47.1729, lng: 27.6240 };

// Zone labels mapped to geohash approximate positions on the T4 terminal
// Used for the SVG overlay on top of the map
const TERMINAL_ZONES = [
  { id: "security", label: "Securitate",  lat: 47.1732, lng: 27.6215, base: 210, limit: 150 },
  { id: "checkin",  label: "Check-in",    lat: 47.1729, lng: 27.6225, base: 85,  limit: 120 },
  { id: "dutyfree", label: "Duty Free",   lat: 47.1735, lng: 27.6250, base: 47,  limit: 80  },
  { id: "gateC3",   label: "Poarta C3",   lat: 47.1726, lng: 27.6265, base: 89,  limit: 60  },
];

interface DensityCell {
  geohash: string;
  dataType: string;
  pplDensity?: number;
  minPplDensity?: number;
  maxPplDensity?: number;
}
interface DensityResponse {
  timedPopulationDensityData: { startTime: string; endTime: string; cellPopulationDensityData: DensityCell[] }[];
  status: string;
  fromFixture?: boolean;
}

// Decode geohash → {lat, lng} (simple base32 decode, precision 7)
function decodeGeohash(hash: string): { lat: number; lng: number } {
  const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
  let lat = [-90, 90], lng = [-180, 180];
  let isLng = true;
  for (const c of hash) {
    const v = BASE32.indexOf(c);
    for (let i = 4; i >= 0; i--) {
      const bit = (v >> i) & 1;
      if (isLng) { const mid = (lng[0] + lng[1]) / 2; lng[bit ? 0 : 1] = mid; }
      else        { const mid = (lat[0] + lat[1]) / 2; lat[bit ? 0 : 1] = mid; }
      isLng = !isLng;
    }
  }
  return { lat: (lat[0] + lat[1]) / 2, lng: (lng[0] + lng[1]) / 2 };
}

function heatColor(density: number): string {
  if (density > 150) return "var(--danger)";
  if (density > 60)  return "var(--warning)";
  return "var(--success)";
}

function HeatmapCenter({ onLog }: { onLog:(m:string,ok?:boolean)=>void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const heatmapLayerRef = useRef<google.maps.visualization.HeatmapLayer | null>(null);
  const [densityData, setDensityData] = useState<DensityCell[]>([]);
  const [loading, setLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [fromFixture, setFromFixture] = useState(false);
  const [hasGoogleKey, setHasGoogleKey] = useState(true);
  const [tick, setTick] = useState(0);

  const fetchDensity = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/population-density", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const d: DensityResponse = await r.json();
      const cells = d.timedPopulationDensityData?.[0]?.cellPopulationDensityData ?? [];
      setDensityData(cells);
      setFromFixture(!!d.fromFixture);
      setTick(p => p + 1);
      onLog(`Population Density · ${cells.length} celule · Orange API${d.fromFixture ? " (fixture)" : ""}`);
    } catch { onLog("Eroare Population Density API", false); }
    finally { setLoading(false); }
  };

  // Init Google Maps
  useEffect(() => {
    const apiKey = (window as any).__GOOGLE_MAPS_KEY__ as string | undefined;
    if (!apiKey) { setHasGoogleKey(false); return; }

    import("@googlemaps/js-api-loader").then(({ Loader }) => {
      const loader = new Loader({
        apiKey,
        version: "weekly",
        libraries: ["visualization"],
      });
      loader.load().then(() => {
        if (!mapRef.current) return;
        const map = new google.maps.Map(mapRef.current, {
          center: LRIA_CENTER,
          zoom: 16,
          mapTypeId: "satellite",
          disableDefaultUI: true,
          zoomControl: true,
          styles: [{ featureType: "all", elementType: "labels", stylers: [{ visibility: "off" }] }],
        });
        googleMapRef.current = map;
        heatmapLayerRef.current = new google.maps.visualization.HeatmapLayer({ map, radius: 40 });
        setMapReady(true);
      }).catch(() => setHasGoogleKey(false));
    }).catch(() => setHasGoogleKey(false));
  }, []);

  // Update heatmap layer when density data changes
  useEffect(() => {
    if (!mapReady || !heatmapLayerRef.current || !densityData.length) return;
    const points = densityData
      .filter(c => c.dataType === "DENSITY_ESTIMATION" && c.pplDensity)
      .map(c => {
        const { lat, lng } = decodeGeohash(c.geohash);
        return { location: new google.maps.LatLng(lat, lng), weight: c.pplDensity! };
      });
    heatmapLayerRef.current.setData(points);
  }, [tick, mapReady]);

  // Auto-refresh 30s
  useEffect(() => {
    fetchDensity();
    const t = setInterval(fetchDensity, 30000);
    return () => clearInterval(t);
  }, []);

  const totalPpl = Math.round(densityData.filter(c => c.pplDensity).reduce((s,c) => s + (c.pplDensity ?? 0), 0));

  return (
    <>
      <div className="map-header">
        <div>
          <div className="map-title">Heatmap Terminal T4 — LRIA</div>
          <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>
            Orange Population Density API · geohash precision 7
            {fromFixture && <span style={{ color:"var(--warning)", marginLeft:8 }}>· fixture</span>}
          </div>
        </div>
        <div className="badges">
          <div className="badge badge-live"><span className="dot red pulse-red"/>Live</div>
          <button onClick={fetchDensity} style={{ background:"var(--bg-hover)", border:"1px solid var(--border-color)", borderRadius:"var(--radius-md)", color:"var(--text-muted)", padding:"4px 10px", cursor:"pointer", fontSize:12 }}>
            <i className={`ti ti-refresh${loading?" spin":""}`}/>
          </button>
        </div>
      </div>

      <div className="map-container" style={{ position:"relative", flex:1, borderRadius:"var(--radius-md)", overflow:"hidden", border:"1px solid var(--border-color)" }}>
        {/* Google Maps div */}
        <div ref={mapRef} style={{ width:"100%", height:"100%", display: hasGoogleKey ? "block" : "none" }}/>

        {/* Fallback SVG când nu e Google Maps key */}
        {!hasGoogleKey && (
          <svg viewBox="0 0 600 400" style={{ width:"100%", height:"100%", background:"#0B1120" }} preserveAspectRatio="xMidYMid meet">
            <text x="300" y="205" textAnchor="middle" fill="var(--text-muted)" fontSize="13">Culoar principal de acces</text>
            {/* Zone colorate din date Orange */}
            {TERMINAL_ZONES.map((z, i) => {
              const cell = densityData[i];
              const density = cell?.pplDensity ?? z.base;
              const color = heatColor(density);
              const positions = [
                { x:20,  y:20,  w:160, h:130 },
                { x:200, y:20,  w:155, h:130 },
                { x:165, y:255, w:155, h:120 },
                { x:340, y:255, w:245, h:120 },
              ];
              const p = positions[i];
              return (
                <g key={z.id}>
                  <rect x={p.x} y={p.y} width={p.w} height={p.h} rx="12"
                    fill={`${color === "var(--danger)" ? "rgba(239,83,80" : color === "var(--warning)" ? "rgba(255,167,38" : "rgba(102,187,106"},0.18)`}
                    stroke={color} strokeWidth="2"
                  />
                  <text x={p.x+p.w/2} y={p.y+p.h/2-8}  textAnchor="middle" fill={color} fontSize="14" fontWeight="600">{z.label}</text>
                  <text x={p.x+p.w/2} y={p.y+p.h/2+12} textAnchor="middle" fill={color} fontSize="12" opacity="0.85">~{Math.round(density)} pax/km²</text>
                </g>
              );
            })}
          </svg>
        )}

        {/* Badge total */}
        {totalPpl > 0 && (
          <div style={{ position:"absolute", top:10, left:10, background:"rgba(11,17,32,0.85)", border:"1px solid var(--border-color)", borderRadius:"var(--radius-md)", padding:"6px 12px", fontSize:12, color:"var(--text-main)", backdropFilter:"blur(4px)" }}>
            <span style={{ color:"var(--text-muted)" }}>Densitate totală: </span>
            <span style={{ fontWeight:700, color:"var(--brand)" }}>{totalPpl.toLocaleString()} pax/km²</span>
          </div>
        )}

        {!hasGoogleKey && (
          <div style={{ position:"absolute", bottom:8, left:0, right:0, textAlign:"center", fontSize:11, color:"var(--text-muted)" }}>
            Adaugă <code style={{color:"var(--brand)"}}>GOOGLE_MAPS_API_KEY</code> în <code>.env</code> pentru harta satelit
          </div>
        )}
      </div>
    </>
  );
}

/* ═══════════════════════════ RIGHT PANEL ═══════════════════════════ */
function RightPanel({
  feature, onLog, weatherProvider, setWeatherProvider,
}: {
  feature: Feature; onLog:(m:string,ok?:boolean)=>void;
  weatherProvider: WeatherProvider; setWeatherProvider: (p: WeatherProvider) => void;
}) {
  return (
    <div className="card sidebar-right">
      {feature === "weather" && <WeatherRight weatherProvider={weatherProvider} setWeatherProvider={setWeatherProvider} />}
      {feature === "route"   && <RouteRight onLog={onLog} />}
      {feature === "heatmap" && <HeatmapRight />}
    </div>
  );
}

const WEATHER_PROVIDERS: { id: WeatherProvider; label: string; icon: string; sub: string }[] = [
  { id: "open-meteo",      label: "Open-Meteo",      icon: "ti-cloud",       sub: "Gratuit · fără autentificare" },
  { id: "openweathermap",  label: "OpenWeatherMap",   icon: "ti-cloud-storm", sub: "API Key · 60 req/min"         },
  { id: "accuweather",     label: "AccuWeather",      icon: "ti-sun",         sub: "API Key · 50 req/zi"          },
];

function WeatherRight({
  weatherProvider, setWeatherProvider,
}: {
  weatherProvider: WeatherProvider; setWeatherProvider: (p: WeatherProvider) => void;
}) {
  const [m, setM] = useState<MData|null>(null);
  useEffect(() => {
    fetch("/api/metar?station=LRIA").then(r => r.json()).then(setM).catch(() => {});
  }, []);

  const qnh = m?.altimeter?.qnhHpa ?? 1013;
  const temp = m?.temperature;
  const wind = m?.wind;
  const cat = m?.flightCategory ?? "VFR";

  // ISA deviation
  const elevFt = 321;
  const isaStd = 15 - 2 * (elevFt / 1000);
  const isaDev = temp ? Math.round((temp.tempC - isaStd) * 10) / 10 : null;

  // Transition altitude Romania: FL070 standard
  // QNH-based transition level varies — simplified
  const transAlt = 7000;
  const transFL = Math.ceil((transAlt + (1013 - qnh) * 27) / 500) * 5;

  return (
    <>
      {/* ── Provider picker ── */}
      <div className="section-title">Furnizor Meteo</div>
      <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:16, flexShrink:0 }}>
        {WEATHER_PROVIDERS.map(p => (
          <button
            key={p.id}
            className={`provider-card${weatherProvider === p.id ? " active" : ""}`}
            onClick={() => setWeatherProvider(p.id)}
          >
            <i className={`ti ${p.icon}`} style={{ fontSize:18, flexShrink:0 }} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:600 }}>{p.label}</div>
              <div style={{ fontSize:11, opacity:0.8 }}>{p.sub}</div>
            </div>
            {weatherProvider === p.id && (
              <i className="ti ti-check" style={{ fontSize:14, flexShrink:0 }} />
            )}
          </button>
        ))}
      </div>

      <div className="section-title">Stația LRIA</div>
      <div className="stats-list" style={{ marginBottom:12 }}>
        {[
          ["ICAO", "LRIA"], ["Elevație", "321 ft / 98 m"], ["Pistă", "08/26 · 2400m"],
          ["Tip", "ILS Cat I"], ["ATC freq.", "TWR 118.7 MHz"],
        ].map(([l,v]) => (
          <div key={l} className="stat-item">
            <span className="stat-label">{l}</span>
            <span className="stat-value" style={{ fontSize:13 }}>{v}</span>
          </div>
        ))}
      </div>

      <div className="section-title">Calculat din METAR</div>
      <div className="stats-list" style={{ marginBottom:12 }}>
        <div className="stat-item">
          <span className="stat-label">ISA Deviation</span>
          <span className="stat-value" style={{ fontSize:13, color: isaDev && Math.abs(isaDev) > 10 ? "var(--warning)" : undefined }}>
            {isaDev !== null ? `ISA${isaDev >= 0 ? "+" : ""}${isaDev}°C` : "—"}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Transition Level</span>
          <span className="stat-value" style={{ fontSize:13 }}>FL{String(transFL).padStart(3,"0")}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">QNH → QFE</span>
          <span className="stat-value" style={{ fontSize:13 }}>{Math.round(qnh - elevFt * 0.04)} hPa</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Vânt magnetik</span>
          <span className="stat-value" style={{ fontSize:13 }}>
            {wind ? `${wind.isVariable ? "VRB" : String(wind.directionDeg).padStart(3,"0")}/${String(wind.speedKt).padStart(2,"0")}${wind.gustKt ? `G${wind.gustKt}` : ""}KT` : "—"}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Dew spread</span>
          <span className="stat-value" style={{ fontSize:13 }}>{temp ? `${temp.tempC - temp.dewpointC}°C` : "—"}</span>
        </div>
      </div>

      <div className="section-title">Limite Operaționale</div>
      <div className="stats-list">
        {[
          ["Cat I ILS", "DH 200ft · RVR 550m", "var(--success)"],
          ["Cat II ILS", "DH 100ft · RVR 300m", "var(--info)"],
          ["VFR circuit", "Plafon > 1000ft · Viz > 5km", "var(--text-muted)"],
          ["LVTO", "RVR ≥ 150m", "var(--warning)"],
        ].map(([l,v,c]) => (
          <div key={l} className="stat-item">
            <span className="stat-label">{l}</span>
            <span style={{ fontSize:11, color:c as string, textAlign:"right", maxWidth:130 }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Cat badge */}
      <div style={{ marginTop:12, padding:"10px 14px", borderRadius:"var(--radius-md)", border:`1px solid ${CAT_COL[cat]}44`, background:`${CAT_COL[cat]}15`, textAlign:"center" }}>
        <div style={{ fontWeight:700, fontSize:20, color:CAT_COL[cat] }}>{cat}</div>
        <div style={{ fontSize:11, color:CAT_COL[cat], opacity:0.85 }}>{CAT_LABEL[cat]}</div>
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
  const [cells, setCells] = useState<DensityCell[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string>("");

  useEffect(() => {
    const load = () =>
      fetch("/api/population-density", { method:"POST", headers:{"Content-Type":"application/json"}, body:"{}" })
        .then(r => r.json())
        .then((d: DensityResponse) => {
          setCells(d.timedPopulationDensityData?.[0]?.cellPopulationDensityData ?? []);
          setUpdatedAt(new Date().toLocaleTimeString("ro"));
        }).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const estimation = cells.filter(c => c.dataType === "DENSITY_ESTIMATION");
  const maxDensity = Math.max(...estimation.map(c => c.pplDensity ?? 0), 1);
  const totalDensity = Math.round(estimation.reduce((s,c) => s+(c.pplDensity??0),0));
  const alertCells = estimation.filter(c => (c.pplDensity??0) > 150);

  return (
    <>
      <div className="section-title">Densitate Populație</div>
      <div className="stats-list" style={{ marginBottom:12 }}>
        <div className="stat-item">
          <span className="stat-label">Total celule</span>
          <span className="stat-value">{cells.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Cu estimare</span>
          <span className="stat-value">{estimation.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Densitate max</span>
          <span className="stat-value" style={{ color: maxDensity > 150 ? "var(--danger)" : "var(--text-main)" }}>
            {maxDensity > 1 ? `${Math.round(maxDensity)} /km²` : "—"}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Zone alertă</span>
          <span className="stat-value" style={{ color: alertCells.length > 0 ? "var(--danger)" : "var(--success)" }}>
            {alertCells.length}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Actualizat</span>
          <span className="stat-value" style={{ fontSize:12, color:"var(--text-muted)" }}>{updatedAt || "—"}</span>
        </div>
      </div>

      <div className="section-title">Celule Geohash</div>
      <div style={{ flex:1, overflowY:"auto" }}>
        {estimation.map(c => {
          const color = heatColor(c.pplDensity ?? 0);
          const pct = Math.min(Math.round((c.pplDensity ?? 0) / maxDensity * 100), 100);
          return (
            <div key={c.geohash} className="zone-row">
              <span style={{ fontFamily:"monospace", fontSize:12, color:"var(--text-muted)" }}>{c.geohash}</span>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div className="zone-bar-wrap">
                  <div className="zone-bar" style={{ width:`${pct}%`, background:color }}/>
                </div>
                <span style={{ fontSize:12, fontWeight:600, color, width:50, textAlign:"right" }}>
                  {Math.round(c.pplDensity ?? 0)}/km²
                </span>
              </div>
            </div>
          );
        })}
        {cells.filter(c => c.dataType !== "DENSITY_ESTIMATION").map(c => (
          <div key={c.geohash} className="zone-row">
            <span style={{ fontFamily:"monospace", fontSize:12, color:"var(--text-muted)" }}>{c.geohash}</span>
            <span style={{ fontSize:11, color:"var(--text-muted)" }}>LOW_DENSITY</span>
          </div>
        ))}
      </div>

      {alertCells.length > 0 && (
        <div className="alert-box" style={{ marginTop:12 }}>
          <div className="alert-title"><i className="ti ti-alert-triangle"/> {alertCells.length} zone aglomerate</div>
          <div className="alert-desc">
            {alertCells.map(c => `${c.geohash}: ${Math.round(c.pplDensity??0)}/km²`).join(" · ")}
          </div>
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════ BOTTOM BAR ═══════════════════════════ */
function BottomBar({ logs }: { logs: { ts: string; msg: string; ok: boolean }[] }) {
  return (
    <div className="bottom-bar">
      {USER_NAV.map(n => (
        <button key={n.label} className="btn-tab">
          <i className={`ti ${n.icon}`} />
          <span className="btn-tab-label">{n.label}</span>
        </button>
      ))}

      <div className="activity-log">
        {logs.slice(0, 2).map((l, i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, whiteSpace:"nowrap", color:"var(--text-muted)" }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:l.ok?"var(--success)":"var(--danger)", flexShrink:0 }}/>
            <span>{l.ts}</span>
            <span style={{ color:l.ok?"var(--text-main)":"var(--danger)" }}>{l.msg}</span>
          </div>
        ))}
        {logs.length === 0 && <span style={{ fontSize:12, color:"var(--text-muted)" }}>Activity log</span>}
      </div>
    </div>
  );
}


import { useState, useEffect, useRef } from "react";
import { pixelToGps, gpsToPixel, LOCATIONS, IMG_W, IMG_H } from "../lib/geo-transform";
import type { WeatherProvider } from "../lib/weather";

type Feature = "weather" | "route" | "heatmap" | "flow-prediction" | "boarding-verify" | "admin" | "announcements";

export interface Announcement {
  id: number; type: "info" | "warning" | "danger"; text: string; time: string;
}

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
  const [feature, setFeature] = useState<Feature>("route");
  const [logs, setLogs] = useState<{ ts: string; msg: string; ok: boolean }[]>([]);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [weatherProvider, setWeatherProvider] = useState<WeatherProvider>("open-meteo");
  const [activePerson, setActivePerson] = useState<string>("you");
  const [announcements, setAnnouncements] = useState<Announcement[]>([
    { id: 1, type: "info",    text: "Zborul RO 321 începe îmbarcarea la Poarta T4 (Dozator Apă).", time: "12:15" },
    { id: 2, type: "warning", text: "Aglomerare la Filtrul de Securitate (Masa Echipei). Timp estimat: 25 min.", time: "12:22" },
  ]);

  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); }, [theme]);

  const addLog = (msg: string, ok = true) =>
    setLogs(p => [{ ts: new Date().toLocaleTimeString("ro"), msg, ok }, ...p].slice(0, 30));

  return (
    <div id="dashboard">
      <div className="dashboard-grid">
        <LeftPanel feature={feature} setFeature={setFeature} theme={theme} setTheme={setTheme} announcements={announcements} />
        <CenterPanel feature={feature} onLog={addLog} weatherProvider={weatherProvider} activePerson={activePerson} announcements={announcements} setAnnouncements={setAnnouncements} />
        <RightPanel feature={feature} onLog={addLog} weatherProvider={weatherProvider} setWeatherProvider={setWeatherProvider} />
      </div>
      <BottomBar logs={logs} activePerson={activePerson} setActivePerson={setActivePerson} />
    </div>
  );
}

/* ═══════════════════════════ LEFT PANEL ═══════════════════════════ */
const NAV: { id: Feature; icon: string; label: string; sub: string }[] = [
  { id: "weather", icon: "ti-cloud-storm", label: "Vreme / METAR",    sub: "LRIA · Open-Meteo · NOAA" },
  { id: "route",   icon: "ti-route",       label: "My Route",         sub: "Device Location · Orange"  },
  { id: "heatmap", icon: "ti-map-2",       label: "Heatmap Terminal", sub: "Aglomerație zone"          },
];

function LeftPanel({
  feature, setFeature, theme, setTheme, announcements,
}: {
  feature: Feature; setFeature: (f: Feature) => void;
  theme: "dark" | "light"; setTheme: (t: "dark" | "light") => void;
  announcements: Announcement[];
}) {
  return (
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

        <div style={{ marginTop: 12 }}>
          <div className="section-title">Operațiuni & Securitate</div>
        </div>
        {([
          { id:"flow-prediction",  icon:"ti-clock-play",           label:"Flow Prediction",      sub:"Estimează ETA cozi" },
          { id:"boarding-verify",  icon:"ti-shield-check",          label:"Verificare Boarding",  sub:"Prevenție fraudă SIM" },
          { id:"admin",            icon:"ti-settings-automation",   label:"Control Panel Admin",  sub:"QoD & Gestiune crize" },
          { id:"announcements",    icon:"ti-megaphone",             label:"Anunțuri Pasageri",    sub:`${announcements.length} alerte active` },
        ] as {id:Feature;icon:string;label:string;sub:string}[]).map(n => (
          <div key={n.id} className={`api-card${feature===n.id?" active":""}`} onClick={() => setFeature(n.id)}>
            <div className="api-card-header"><i className={`ti ${n.icon}`}/> {n.label}</div>
            <div className="api-val">{n.sub}</div>
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
function CenterPanel({
  feature, onLog, weatherProvider, activePerson, announcements, setAnnouncements,
}: {
  feature: Feature; onLog: (m: string, ok?: boolean) => void; weatherProvider: WeatherProvider;
  activePerson: string; announcements: Announcement[]; setAnnouncements: React.Dispatch<React.SetStateAction<Announcement[]>>;
}) {
  return (
    <div className="card main-center">
      {feature === "weather"          && <WeatherCenter onLog={onLog} provider={weatherProvider} />}
      {feature === "route"            && <RouteCenter   onLog={onLog} activePerson={activePerson} />}
      {feature === "heatmap"          && <HeatmapCenter onLog={onLog} />}
      {feature === "flow-prediction"  && <FlowPredictionCenter onLog={onLog} />}
      {feature === "boarding-verify"  && <BoardingVerifyCenter activePerson={activePerson} onLog={onLog} />}
      {feature === "admin"            && <AdminCenter onLog={onLog} setAnnouncements={setAnnouncements} />}
      {feature === "announcements"    && <AnnouncementsCenter announcements={announcements} />}
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
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, flexShrink:0 }}>
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
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, flexShrink:0 }}>
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
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, flexShrink:0 }}>
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

/* ── SVG affine calibration ── */
const CAL_KEY = "svg_cal_v1";
interface CalPoint { svgX: number; svgY: number; lat: number; lng: number }
interface CalTransform { A:number; B:number; C:number; D:number; E:number; F:number }

function solveAffine(pts: CalPoint[]): CalTransform | null {
  if (pts.length < 3) return null;
  // Least-squares: z = a*x + b*y + c
  function solve(getZ: (p: CalPoint) => number): [number,number,number] {
    let s00=0,s10=0,s01=0,s20=0,s11=0,s02=0,sz0=0,sz1=0,sz2=0;
    for (const p of pts) {
      s00+=1; s10+=p.svgX; s01+=p.svgY;
      s20+=p.svgX**2; s11+=p.svgX*p.svgY; s02+=p.svgY**2;
      const z=getZ(p); sz0+=z; sz1+=z*p.svgX; sz2+=z*p.svgY;
    }
    const n=pts.length;
    // Build 3x3 normal equations
    const M=[[s20,s11,s10],[s11,s02,s01],[s10,s01,n]];
    const b=[sz1,sz2,sz0];
    const det=(m:number[][])=>m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
    const D=det(M);
    if (Math.abs(D)<1e-15) return [0,0,0];
    return [0,1,2].map(i=>{ const N=M.map(r=>[...r]); for(let r=0;r<3;r++) N[r][i]=b[r]; return det(N)/D; }) as [number,number,number];
  }
  const [A,B,C]=solve(p=>p.lat);
  const [D,E,F]=solve(p=>p.lng);
  return {A,B,C,D,E,F};
}

function applyTransform(t: CalTransform, svgX: number, svgY: number): {lat:number;lng:number} {
  return { lat: t.A*svgX + t.B*svgY + t.C, lng: t.D*svgX + t.E*svgY + t.F };
}

function svgFromGps(t: CalTransform, lat: number, lng: number): {x:number;y:number} {
  // Invert 2x2: [A B; D E] * [x;y] = [lat-C; lng-F]
  const det = t.A*t.E - t.B*t.D;
  if (Math.abs(det)<1e-20) return {x:0,y:0};
  return {
    x: (t.E*(lat-t.C) - t.B*(lng-t.F))/det,
    y: (t.A*(lng-t.F) - t.D*(lat-t.C))/det,
  };
}

const defaultPoints: CalPoint[] = [
  { svgX: 852,  svgY: 349, lat: 47.17439229, lng: 27.61903507 }, // control check / masa echipei
  { svgX: 2244, svgY: 256, lat: 47.17406410, lng: 27.61970100 }, // destinație pasageri / dozator
  { svgX: 100,  svgY: 500, lat: 47.17460000, lng: 27.61850000 }, // colț stânga-jos (estimat)
];

function loadCalibration(): { points: CalPoint[]; transform: CalTransform | null } {
  try {
    const raw = localStorage.getItem(CAL_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.points?.length >= 3) return saved;
    }
  } catch { /* ignore */ }
  if (defaultPoints.length >= 3) return { points: defaultPoints, transform: solveAffine(defaultPoints) };
  return { points: [], transform: null };
}

function saveCalibration(points: CalPoint[], transform: CalTransform | null) {
  localStorage.setItem(CAL_KEY, JSON.stringify({ points, transform }));
}

// Puncte fixe calibrate
const SVG_SECURITY  = { x: 852,  y: 349 }; // control check / masa echipei
const SVG_GATE      = { x: 2244, y: 256 }; // destinație / dozator

// Puncte de start diferite pentru fiecare persoană
const SVG_STARTS: Record<string, {x:number;y:number}> = {
  you:    { x: 150, y: 500 },
  misu:   { x: 400, y: 480 },
  ionica: { x: 150, y: 150 },
  dorel:  { x: 400, y: 150 },
};

const GATE_SVG: Record<string, { x: number; y: number }> = {
  "1": SVG_GATE, "2": SVG_GATE, "3": SVG_GATE,
  "4": SVG_GATE, "5": SVG_GATE, "6": SVG_GATE, "T3": SVG_GATE,
};

function makeRoute(personId: string) {
  const s = SVG_STARTS[personId] ?? { x: 150, y: 500 };
  return [s, SVG_SECURITY, { x: 1600, y: 300 }, SVG_GATE];
}

const ROUTE_SVG: Record<string, { x: number; y: number }[]> = {
  "1": makeRoute("you"), "2": makeRoute("misu"),
  "3": makeRoute("ionica"), "4": makeRoute("dorel"),
  "5": makeRoute("you"), "6": makeRoute("you"), "T3": makeRoute("you"),
};

/* ── People config ── */
interface Person { id: string; name: string; flightId: string; color: string }
const PEOPLE: Person[] = [
  { id: "you",    name: "You",    flightId: "1", color: "#38BDF8" },
  { id: "misu",   name: "Misu",   flightId: "2", color: "#F97316" },
  { id: "ionica", name: "Ionica", flightId: "3", color: "#A78BFA" },
  { id: "dorel",  name: "Dorel",  flightId: "4", color: "#34D399" },
];

function RouteCenter({ onLog, activePerson }: { onLog:(m:string,ok?:boolean)=>void; activePerson: string }) {
  const [positions, setPositions] = useState<Record<string, {x:number;y:number}>>({
    you:    SVG_STARTS.you,
    misu:   SVG_STARTS.misu,
    ionica: SVG_STARTS.ionica,
    dorel:  SVG_STARTS.dorel,
  });
  const [locLoading, setLocLoading] = useState(false);
  const [pixelLog, setPixelLog] = useState(false);
  const [hoverPos, setHoverPos] = useState<{x:number;y:number}|null>(null);
  const [pixelEntries, setPixelEntries] = useState<{x:number;y:number;label:string}[]>([]);
  const [pixelLabel, setPixelLabel] = useState("");

  // Calibration state
  const [calMode, setCalMode] = useState(false);
  const [calPoints, setCalPoints] = useState<CalPoint[]>([]);
  const [calTransform, setCalTransform] = useState<CalTransform|null>(null);
  const [pendingPin, setPendingPin] = useState<{svgX:number;svgY:number}|null>(null);
  const [gpsInput, setGpsInput] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const saved = loadCalibration();
    setCalPoints(saved.points);
    setCalTransform(saved.transform);
  }, []);

  const person = PEOPLE.find(p => p.id === activePerson)!;
  const flight = FLIGHTS.find(f => f.id === person.flightId) ?? null;
  const pts = flight ? ROUTE_SVG[flight.gate] : null;
  const gatePos = flight ? GATE_SVG[flight.gate] : null;
  const polyline = pts ? pts.map(p => `${p.x},${p.y}`).join(" ") : "";

  const placeOnMap = (lat: number, lng: number, personId: string) => {
    if (calTransform) {
      setPositions(prev => ({ ...prev, [personId]: svgFromGps(calTransform, lat, lng) }));
    }
  };

  const getLocation = async () => {
    setLocLoading(true);
    try {
      const r = await fetch("/api/location", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person: activePerson }),
      });
      const d = await r.json();
      const lat = d.location?.latitude, lng = d.location?.longitude;
      if (lat && lng) {
        placeOnMap(lat, lng, activePerson);
        onLog(`${person.name} · ${lat.toFixed(4)}, ${lng.toFixed(4)}${d.fromFixture ? " (mock)" : ""}`);
      } else {
        onLog(`${person.name}: ${d.error ?? "fără locație"}`, false);
      }
    } catch { onLog("Eroare locație", false); }
    finally { setLocLoading(false); }
  };

  // ── Calibration handlers ──
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!calMode || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * 2262;
    const svgY = ((e.clientY - rect.top) / rect.height) * 587;
    setPendingPin({ svgX, svgY });
    setGpsInput("");
  };

  const confirmCalPoint = () => {
    if (!pendingPin) return;
    const parts = gpsInput.split(",").map(s => parseFloat(s.trim()));
    if (parts.length !== 2 || parts.some(isNaN)) return;
    const [lat, lng] = parts;
    const newPoints = [...calPoints, { svgX: pendingPin.svgX, svgY: pendingPin.svgY, lat, lng }];
    const newTransform = solveAffine(newPoints);
    setCalPoints(newPoints); setCalTransform(newTransform);
    saveCalibration(newPoints, newTransform);
    setPendingPin(null); setGpsInput("");
    onLog(`Cal point ${newPoints.length}: (${pendingPin.svgX.toFixed(0)}, ${pendingPin.svgY.toFixed(0)}) → ${lat}, ${lng}`);
  };

  const clearCalibration = () => {
    setCalPoints([]); setCalTransform(null); setPendingPin(null);
    saveCalibration([], null);
  };

  const userPos = positions[activePerson];

  return (
    <>
      {/* ── Controls row ── */}
      <div style={{ display:"flex", gap:6, marginBottom:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ width:8, height:8, borderRadius:"50%", background:person.color, display:"inline-block" }}/>
          <span style={{ fontSize:13, fontWeight:600, color:person.color }}>{person.name}</span>
          {flight && <span style={{ fontSize:12, color:"var(--text-muted)" }}>· {flight.flight} → {flight.dest}</span>}
        </div>
        <button onClick={getLocation} disabled={locLoading} style={{
          marginLeft:"auto", padding:"6px 12px", borderRadius:"var(--radius-md)", cursor:"pointer", fontSize:12,
          border:"1px solid var(--border-color)", background:"var(--bg-hover)", color:"var(--text-muted)",
          display:"flex", alignItems:"center", gap:6,
        }}>
          <i className={`ti ti-map-pin${locLoading?" spin":""}`}/> Localizează
        </button>
        <button onClick={() => { setCalMode(m => !m); setPendingPin(null); }} style={{
          padding:"6px 10px", borderRadius:"var(--radius-md)", cursor:"pointer", fontSize:12,
          border:`1px solid ${calMode?"var(--brand)":"var(--border-color)"}`,
          background: calMode ? "rgba(255,102,0,0.2)" : "var(--bg-hover)",
          color: calMode ? "var(--brand)" : "var(--text-muted)",
        }}>
          <i className="ti ti-ruler-measure"/>
        </button>
        <button onClick={() => { setPixelLog(m => !m); }} style={{
          padding:"6px 10px", borderRadius:"var(--radius-md)", cursor:"pointer", fontSize:12,
          border:`1px solid ${pixelLog?"#F59E0B":"var(--border-color)"}`,
          background: pixelLog ? "rgba(245,158,11,0.15)" : "var(--bg-hover)",
          color: pixelLog ? "#F59E0B" : "var(--text-muted)",
        }} title="Pixel Logger">
          <i className="ti ti-crosshair"/>
        </button>
      </div>

      {/* Calibration banner */}
      {calMode && (
        <div style={{ margin:"0 0 6px", padding:"8px 12px", background:"rgba(255,102,0,0.1)", border:"1px solid var(--brand)", borderRadius:"var(--radius-md)", fontSize:12, color:"var(--brand)", display:"flex", alignItems:"center", gap:10 }}>
          <i className="ti ti-info-circle" style={{ fontSize:16 }}/>
          <span>Click pe hartă → introdu GPS. Minim 3 puncte.</span>
          {calPoints.length >= 3 && (
            <button onClick={async () => {
              const r = await fetch("/api/save-calibration", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ points: calPoints }) });
              const d = await r.json();
              onLog(d.ok ? `✓ ${calPoints.length} puncte salvate în cod` : `Eroare: ${d.error}`, d.ok);
            }} style={{ background:"var(--brand)", border:"none", borderRadius:4, color:"#fff", padding:"2px 10px", cursor:"pointer", fontSize:11 }}>
              Salvează în cod
            </button>
          )}
          <button onClick={clearCalibration} style={{ marginLeft:"auto", background:"transparent", border:"1px solid var(--border-color)", borderRadius:4, color:"var(--text-muted)", padding:"2px 8px", cursor:"pointer", fontSize:11 }}>Resetează</button>
        </div>
      )}

      {calMode && pendingPin && (
        <div style={{ margin:"0 0 6px", padding:"8px 12px", background:"var(--bg-card)", border:"1px solid var(--brand)", borderRadius:"var(--radius-md)", display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:12, color:"var(--text-muted)", whiteSpace:"nowrap" }}>SVG ({pendingPin.svgX.toFixed(0)}, {pendingPin.svgY.toFixed(0)})</span>
          <input autoFocus placeholder="lat, lng" value={gpsInput} onChange={e => setGpsInput(e.target.value)} onKeyDown={e => e.key==="Enter" && confirmCalPoint()}
            style={{ flex:1, background:"var(--bg-body)", border:"1px solid var(--border-color)", borderRadius:4, color:"var(--text-main)", padding:"4px 8px", fontSize:12, outline:"none" }} />
          <button onClick={confirmCalPoint} style={{ background:"var(--brand)", border:"none", borderRadius:4, color:"#fff", padding:"4px 10px", cursor:"pointer", fontSize:12 }}>OK</button>
          <button onClick={() => setPendingPin(null)} style={{ background:"transparent", border:"1px solid var(--border-color)", borderRadius:4, color:"var(--text-muted)", padding:"4px 8px", cursor:"pointer", fontSize:12 }}>✕</button>
        </div>
      )}

      {/* Map */}
      <div className="map-container" style={{ position:"relative", flex:1, borderRadius:"var(--radius-md)", overflow:"hidden", border:`1px solid ${calMode?"var(--brand)":pixelLog?"#F59E0B":"var(--border-color)"}`, cursor: calMode||pixelLog ? "crosshair" : "default" }}>
        <img src="/harta_completa.svg" alt="Hartă T4 LRIA" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"contain", display:"block", zIndex:1 }} />

        {/* Pixel logger input popover */}
        {pixelLog && hoverPos && (
          <div style={{ position:"absolute", top:8, left:8, zIndex:10, background:"rgba(11,17,32,0.92)", border:"1px solid #F59E0B", borderRadius:6, padding:"6px 10px", fontSize:12, color:"#F59E0B", pointerEvents:"none" }}>
            x: <b>{hoverPos.x.toFixed(0)}</b> · y: <b>{hoverPos.y.toFixed(0)}</b>
          </div>
        )}

        <svg ref={svgRef} viewBox="0 0 2262 587" preserveAspectRatio="xMidYMid meet"
          onClick={e => {
            if (pixelLog && svgRef.current) {
              const rect = svgRef.current.getBoundingClientRect();
              const x = ((e.clientX-rect.left)/rect.width)*2262;
              const y = ((e.clientY-rect.top)/rect.height)*587;
              const label = window.prompt(`SVG (${x.toFixed(0)}, ${y.toFixed(0)}) — ce este acest punct?`) ?? "";
              if (label) setPixelEntries(prev => [...prev, {x, y, label}]);
            } else { handleSvgClick(e); }
          }}
          onMouseMove={e => {
            if (!pixelLog || !svgRef.current) { setHoverPos(null); return; }
            const rect = svgRef.current.getBoundingClientRect();
            setHoverPos({ x:((e.clientX-rect.left)/rect.width)*2262, y:((e.clientY-rect.top)/rect.height)*587 });
          }}
          onMouseLeave={() => setHoverPos(null)}
          style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents: calMode||pixelLog ? "all" : "none", zIndex:2 }}>
          <defs>
            <filter id="glow2"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>

          {/* Route for active person */}
          {!calMode && pts && (
            <polyline points={polyline} fill="none" stroke={person.color} strokeWidth="4"
              strokeDasharray="12 8" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation:"moveDash 1.5s linear infinite", filter:`drop-shadow(0 0 6px ${person.color}88)` }} />
          )}

          {/* Gate */}
          {!calMode && gatePos && (
            <g filter="url(#glow2)">
              <circle cx={gatePos.x} cy={gatePos.y} r="14" fill="none" stroke="#10B981" strokeWidth="2" opacity="0.6" style={{animation:"pulse 2s infinite"}}/>
              <circle cx={gatePos.x} cy={gatePos.y} r="7" fill="#10B981"/>
              <text x={gatePos.x} y={gatePos.y-18} textAnchor="middle" fill="#10B981" fontSize="12" fontWeight="700">{GATE_LABELS[flight?.gate ?? ""]}</text>
            </g>
          )}

          {/* All person dots */}
          {!calMode && PEOPLE.map(p => {
            const pos = positions[p.id];
            return (
              <g key={p.id} filter="url(#glow2)" opacity={p.id === activePerson ? 1 : 0.5}>
                <circle cx={pos.x} cy={pos.y} r={p.id===activePerson?14:10} fill="none" stroke={p.color} strokeWidth="2" opacity="0.5" style={p.id===activePerson?{animation:"pulse 2s infinite"}:{}}/>
                <circle cx={pos.x} cy={pos.y} r={p.id===activePerson?7:5} fill={p.color}/>
                <circle cx={pos.x} cy={pos.y} r="2" fill="#fff"/>
                <text x={pos.x} y={pos.y+20} textAnchor="middle" fill={p.color} fontSize="10" fontWeight="600">{p.name}</text>
              </g>
            );
          })}

          {/* Calibration points */}
          {calMode && calPoints.map((p, i) => (
            <g key={i}>
              <circle cx={p.svgX} cy={p.svgY} r="7" fill="#ff6600" stroke="#fff" strokeWidth="1.5"/>
              <text x={p.svgX+10} y={p.svgY+4} fill="#ff6600" fontSize="10">{i+1}</text>
            </g>
          ))}
          {calMode && pendingPin && (
            <g>
              <line x1={pendingPin.svgX} y1={pendingPin.svgY-14} x2={pendingPin.svgX} y2={pendingPin.svgY+14} stroke="#ff6600" strokeWidth="2"/>
              <line x1={pendingPin.svgX-14} y1={pendingPin.svgY} x2={pendingPin.svgX+14} y2={pendingPin.svgY} stroke="#ff6600" strokeWidth="2"/>
              <circle cx={pendingPin.svgX} cy={pendingPin.svgY} r="5" fill="none" stroke="#ff6600" strokeWidth="2"/>
            </g>
          )}
        </svg>
        <style>{`
          @keyframes moveDash { to { stroke-dashoffset: -200; } }
          @keyframes pulse { 0%,100%{transform:scale(0.9);opacity:1} 50%{transform:scale(1.3);opacity:0.7} }
        `}</style>
      </div>

      {/* Pixel log panel */}
      {pixelLog && pixelEntries.length > 0 && (
        <div style={{ marginTop:8, padding:"8px 12px", background:"rgba(245,158,11,0.08)", border:"1px solid #F59E0B44", borderRadius:"var(--radius-md)", fontSize:11, flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
            <span style={{ color:"#F59E0B", fontWeight:600 }}>Pixel Log</span>
            <button onClick={() => { navigator.clipboard.writeText(pixelEntries.map(e=>`{ svgX: ${e.x.toFixed(0)}, svgY: ${e.y.toFixed(0)} } // ${e.label}`).join("\n")); }}
              style={{ background:"transparent", border:"none", color:"#F59E0B", cursor:"pointer", fontSize:11 }}>
              📋 Copy
            </button>
            <button onClick={() => setPixelEntries([])} style={{ background:"transparent", border:"none", color:"var(--text-muted)", cursor:"pointer", fontSize:11 }}>✕ Clear</button>
          </div>
          {pixelEntries.map((e,i) => (
            <div key={i} style={{ fontFamily:"monospace", color:"var(--text-muted)", lineHeight:1.6 }}>
              <span style={{ color:"#F59E0B" }}>({e.x.toFixed(0)}, {e.y.toFixed(0)})</span> — {e.label}
            </div>
          ))}
        </div>
      )}

      {/* Flight info strip */}
      {flight && (
        <div style={{ marginTop:8, padding:"10px 14px", borderRadius:"var(--radius-md)", border:`1px solid ${person.color}44`, background:`${person.color}11`, display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
          <i className="ti ti-plane" style={{color:person.color,fontSize:20}}/>
          <div style={{flex:1}}>
            <div style={{fontWeight:600,fontSize:14,color:person.color}}>{person.name} · {flight.flight} → {flight.dest}</div>
            <div style={{fontSize:12,color:"var(--text-muted)"}}>{GATE_LABELS[flight.gate]} · Decolare {flight.departs}</div>
          </div>
        </div>
      )}
    </>
  );
}
/* ── Heatmap center — Google Maps + Orange Population Density ── */

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
  const [densityData, setDensityData] = useState<DensityCell[]>([]);
  const [loading, setLoading] = useState(false);
  const [fromFixture, setFromFixture] = useState(false);

  const fetchDensity = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/population-density", { method:"POST", headers:{"Content-Type":"application/json"}, body:"{}" });
      const d: DensityResponse = await r.json();
      const cells = d.timedPopulationDensityData?.[0]?.cellPopulationDensityData ?? [];
      setDensityData(cells);
      setFromFixture(!!d.fromFixture);
      onLog(`Population Density · ${cells.length} celule${d.fromFixture?" (fixture)":""}`);
    } catch { onLog("Eroare Population Density API", false); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchDensity();
    const t = setInterval(fetchDensity, 30000);
    return () => clearInterval(t);
  }, []);

  // Map celule direct pe pozițiile SVG cunoscute (nu depinde de calibrare)
  const SVG_ZONE_MAP = [SVG_SECURITY, SVG_GATE];
  const maxDensity = Math.max(...densityData.map(c => c.pplDensity ?? 0), 1);

  const circles = densityData
    .filter(c => c.pplDensity)
    .map((c, i) => {
      const pos = SVG_ZONE_MAP[i] ?? SVG_ZONE_MAP[0];
      const intensity = (c.pplDensity ?? 0) / maxDensity;
      const r = 40 + intensity * 80;
      const color = intensity > 0.7 ? "#EF5350" : intensity > 0.35 ? "#FFA726" : "#66BB6A";
      const label = i === 0 ? "Security Check" : "Boarding Gate";
      return { ...pos, r, color, intensity, density: c.pplDensity ?? 0, label };
    });

  return (
    <>
      <div className="map-header">
        <div>
          <div className="map-title">Heatmap Terminal T4 — LRIA</div>
          <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>
            Orange Population Density API{fromFixture && <span style={{ color:"var(--warning)", marginLeft:6 }}>· fixture</span>}
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
        <img src="/harta_completa.svg" alt="Hartă T4" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"contain", display:"block", zIndex:1 }}/>
        <svg viewBox="0 0 2262 587" preserveAspectRatio="xMidYMid meet"
          style={{ position:"absolute", inset:0, width:"100%", height:"100%", zIndex:2 }}>
          <defs>
            {circles.map((c, i) => (
              <radialGradient key={i} id={`hg${i}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={c.color} stopOpacity={0.6 + c.intensity * 0.3}/>
                <stop offset="100%" stopColor={c.color} stopOpacity="0"/>
              </radialGradient>
            ))}
          </defs>
          {circles.map((c, i) => (
            <g key={i}>
              <circle cx={c.x} cy={c.y} r={c.r} fill={`url(#hg${i})`}/>
              <circle cx={c.x} cy={c.y} r={10} fill={c.color} opacity="0.95"/>
              <text x={c.x} y={c.y + c.r + 16} textAnchor="middle" fill={c.color} fontSize="13" fontWeight="700">{c.label}</text>
              <text x={c.x} y={c.y + c.r + 30} textAnchor="middle" fill={c.color} fontSize="11" opacity="0.85">{c.density} pax/km²</text>
            </g>
          ))}
        </svg>
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
  const [densityData, setDensityData] = useState<DensityCell[]>([]);
  const [sel, setSel] = useState<string|null>(null);
  const [verifyRes, setVerifyRes] = useState<{decision:string;simSwapped:boolean}|null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/population-density", { method:"POST", headers:{"Content-Type":"application/json"}, body:"{}" })
      .then(r => r.json())
      .then((d: DensityResponse) => setDensityData(d.timedPopulationDensityData?.[0]?.cellPopulationDensityData ?? []))
      .catch(() => {});
  }, []);

  const securityDensity = densityData[0]?.pplDensity ?? 185;
  const boardingDensity = densityData[1]?.pplDensity ?? 95;
  const securityETA = Math.ceil((securityDensity * 45) / (2 * 60));
  const boardingETA = Math.ceil((boardingDensity * 30) / (3 * 60));

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

  const etaColor = (eta: number) => eta > 20 ? "var(--danger)" : eta > 10 ? "var(--warning)" : "var(--success)";

  return (
    <>
      <div className="section-title">Timp estimat așteptare</div>
      <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:12 }}>
        <div style={{ padding:"12px 14px", background:"var(--bg-body)", border:"1px solid var(--border-color)", borderRadius:"var(--radius-md)" }}>
          <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:4, display:"flex", alignItems:"center", gap:6 }}>
            <i className="ti ti-shield-check" style={{ color:"var(--brand)" }}/> Security Check (Masa Echipei)
          </div>
          <div style={{ fontSize:24, fontWeight:700, color:etaColor(securityETA) }}>{securityETA} min</div>
          <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>{securityDensity} pax detectați · 2 linii active</div>
          <div style={{ marginTop:6, height:4, background:"var(--bg-hover)", borderRadius:2 }}>
            <div style={{ width:`${Math.min(100,(securityDensity/250)*100)}%`, height:"100%", background:etaColor(securityETA), borderRadius:2, transition:"width 0.5s" }}/>
          </div>
        </div>
        <div style={{ padding:"12px 14px", background:"var(--bg-body)", border:"1px solid var(--border-color)", borderRadius:"var(--radius-md)" }}>
          <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:4, display:"flex", alignItems:"center", gap:6 }}>
            <i className="ti ti-door-enter" style={{ color:"var(--success)" }}/> Boarding Gate (Dozator)
          </div>
          <div style={{ fontSize:24, fontWeight:700, color:etaColor(boardingETA) }}>{boardingETA} min</div>
          <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>{boardingDensity} pax detectați · 3 ghișee active</div>
          <div style={{ marginTop:6, height:4, background:"var(--bg-hover)", borderRadius:2 }}>
            <div style={{ width:`${Math.min(100,(boardingDensity/250)*100)}%`, height:"100%", background:etaColor(boardingETA), borderRadius:2, transition:"width 0.5s" }}/>
          </div>
        </div>
      </div>

      <div className="section-title">Zboruri</div>
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
function BottomBar({ logs, activePerson, setActivePerson }: { logs:{ts:string;msg:string;ok:boolean}[]; activePerson: string; setActivePerson: (id:string)=>void }) {
  return (
    <div className="bottom-bar">
      {PEOPLE.map(p => (
        <button key={p.id} className={`btn-tab${activePerson===p.id?" active":""}`} onClick={() => setActivePerson(p.id)}
          style={{ color: activePerson===p.id ? p.color : undefined, borderBottom: activePerson===p.id ? `2px solid ${p.color}` : undefined }}>
          <i className={`ti ${p.id==="you" ? "ti-user-circle" : "ti-user"}`}/> {p.name}
        </button>
      ))}
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
        <i className="ti ti-help-circle"/> Ajutor
      </button>
    </div>
  );
}

/* ═══════════════════════════ NEW FEATURE COMPONENTS ═══════════════════════════ */

function FlowPredictionCenter({ onLog }: { onLog:(m:string,ok?:boolean)=>void }) {
  const [securityLanes, setSecurityLanes] = useState(2);
  const securityETA = Math.ceil((185 * 45) / securityLanes / 60);
  return (
    <div style={{ padding:20 }}>
      <h2><i className="ti ti-trending-up"/> Predictor Fluxuri T4</h2>
      <div style={{ padding:15, background:"rgba(255,255,255,0.03)", borderRadius:8, marginTop:20 }}>
        <h3>Filtru Securitate (Masa Echipei)</h3>
        <div style={{ fontSize:28, fontWeight:"bold", margin:"10px 0", color:securityETA>15?"var(--warning)":"var(--success)" }}>
          {securityETA} min <span style={{ fontSize:14, fontWeight:"normal", color:"var(--text-muted)" }}>așteptare estimată</span>
        </div>
        <p>Pasageri detectați de Orange API: <strong>185</strong></p>
        <label style={{ fontSize:12, color:"var(--text-muted)", display:"block", marginBottom:5 }}>Linii de filtrare deschise:</label>
        <div style={{ display:"flex", gap:8 }}>
          {[1,2,3,4].map(n => (
            <button key={n} onClick={() => { setSecurityLanes(n); onLog(`Filtre securitate: ${n} linii active`); }}
              style={{ padding:"6px 12px", background:securityLanes===n?"var(--brand)":"rgba(255,255,255,0.1)", border:"none", borderRadius:4, cursor:"pointer", color:"#fff" }}>
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function BoardingVerifyCenter({ activePerson, onLog }: { activePerson:string; onLog:(m:string,ok?:boolean)=>void }) {
  const [status, setStatus] = useState<"idle"|"verified"|"flagged">("idle");
  const run = () => {
    setStatus("idle");
    onLog("Inițiere protocol securitate...");
    setTimeout(() => {
      if (activePerson === "dorel") { setStatus("flagged"); onLog("ALERTĂ: SIM Swap detectat pentru Dorel!", false); }
      else { setStatus("verified"); onLog("Identitate validată. Număr confirmat."); }
    }, 1000);
  };
  return (
    <div style={{ padding:20 }}>
      <h2><i className="ti ti-shield-lock"/> Verificare Boarding</h2>
      <div style={{ padding:20, background:"rgba(255,255,255,0.02)", borderRadius:8, marginTop:20 }}>
        <button onClick={run} style={{ padding:"10px 20px", background:"var(--brand)", border:"none", borderRadius:4, fontWeight:"bold", cursor:"pointer", color:"#fff" }}>
          Verifică Pasagerul Curent ({activePerson})
        </button>
        {status==="verified" && (
          <div style={{ background:"rgba(40,167,69,0.1)", border:"1px solid var(--success)", padding:15, borderRadius:6, marginTop:20 }}>
            <div style={{ color:"var(--success)", fontWeight:"bold" }}><i className="ti ti-circle-check"/> VALIDAT DIGITAL</div>
            <p style={{ fontSize:13 }}>Nu s-au detectat modificări recente ale cartelei SIM.</p>
          </div>
        )}
        {status==="flagged" && (
          <div style={{ background:"rgba(220,53,69,0.1)", border:"1px solid var(--danger)", padding:15, borderRadius:6, marginTop:20 }}>
            <div style={{ color:"var(--danger)", fontWeight:"bold" }}><i className="ti ti-alert-triangle"/> ACCES BLOCAT</div>
            <p style={{ fontSize:13 }}>SIM_SWAP suspect detectat. Interdicție îmbarcare.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminCenter({ onLog, setAnnouncements }: { onLog:(m:string,ok?:boolean)=>void; setAnnouncements:React.Dispatch<React.SetStateAction<Announcement[]>> }) {
  const [inputText, setInputText] = useState("");
  const handleBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    setAnnouncements(prev => [{ id:Date.now(), type:"warning", text:inputText, time:new Date().toLocaleTimeString() }, ...prev]);
    onLog(`[ADMIN] Anunț trimis: "${inputText}"`);
    setInputText("");
  };
  return (
    <div style={{ padding:20 }}>
      <h2><i className="ti ti-settings-automation"/> Control Panel Admin</h2>
      <div style={{ padding:15, background:"rgba(255,255,255,0.02)", borderRadius:8, marginTop:20 }}>
        <h3>Emite Anunț Pasageri</h3>
        <form onSubmit={handleBroadcast} style={{ marginTop:10 }}>
          <textarea value={inputText} onChange={e => setInputText(e.target.value)} placeholder="Scrie un anunț..."
            style={{ width:"100%", height:70, background:"#111", border:"1px solid #333", borderRadius:4, color:"#fff", padding:8, boxSizing:"border-box" }}/>
          <button type="submit" style={{ background:"var(--brand)", color:"#fff", border:"none", padding:"6px 14px", borderRadius:4, marginTop:10, cursor:"pointer" }}>
            Trimite pe Monitor
          </button>
        </form>
      </div>
    </div>
  );
}

function AnnouncementsCenter({ announcements }: { announcements:Announcement[] }) {
  return (
    <div style={{ padding:20 }}>
      <h2><i className="ti ti-presentation"/> Monitoare Informare Pasageri</h2>
      <div style={{ display:"flex", flexDirection:"column", gap:12, marginTop:20 }}>
        {announcements.map(a => (
          <div key={a.id} style={{ padding:15, background:"rgba(255,255,255,0.02)", borderLeft:`5px solid var(--${a.type})`, borderRadius:"0 6px 6px 0" }}>
            <p style={{ margin:0, fontSize:14, fontWeight:500 }}>{a.text}</p>
            <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:5 }}>{a.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

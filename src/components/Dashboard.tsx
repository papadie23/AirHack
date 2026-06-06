import { useState, useEffect, useRef } from "react";
import { pixelToGps, gpsToPixel, LOCATIONS, IMG_W, IMG_H } from "../lib/geo-transform";
import type { WeatherProvider } from "../lib/weather";
import { findClient, ADMIN_USERNAME, ADMIN_PASSWORD } from "../lib/mock-auth";
import TrafficFlowCenter from "./TrafficFlowCenter";

type Feature = "weather" | "route" | "heatmap" | "flow-prediction" | "boarding-verify" | "admin" | "announcements" | "status-api" | "account" | "settings" | "my-flight" | "video-flow";

export interface Announcement {
  id: number; type: "info" | "warning" | "danger"; text: string; time: string;
}

interface AuthState {
  role: "admin" | "passenger";
  personId: string;
  displayName: string;
  flightIata?: string;
}

/* ── flights / route ── */
// Static fallback (used only if API fails)
const FLIGHTS_FALLBACK = [
  { id: "1", gate: "4",  flight: "RO 321",  dest: "București OTP", departs: "23:15", color: "var(--success)", status: "scheduled", delayed: null },
  { id: "2", gate: "2",  flight: "W6 4102", dest: "Londra LTN",    departs: "23:45", color: "var(--info)",    status: "scheduled", delayed: null },
  { id: "3", gate: "T3", flight: "LH 1407", dest: "Frankfurt FRA", departs: "00:10", color: "var(--warning)", status: "scheduled", delayed: null },
  { id: "4", gate: "5",  flight: "FR 8821", dest: "Milano BGY",    departs: "00:30", color: "var(--brand)",   status: "scheduled", delayed: null },
  { id: "5", gate: "T3", flight: "AF 1234", dest: "Paris CDG",     departs: "06:45", color: "var(--danger)",  status: "scheduled", delayed: null },
];

// Colors cycling for live flights
const FLIGHT_COLORS = [
  "var(--success)", "var(--info)", "var(--warning)", "var(--brand)", "var(--danger)",
  "var(--success)", "var(--info)", "var(--warning)", "var(--brand)", "var(--danger)",
];

type LiveFlight = {
  id: string; gate: string; flight: string; dest: string; departs: string;
  color: string; status: string; delayed: number | null;
};

// Keep backward compat: FLIGHTS is the static fallback used in ROUTE_PX / GATE_LABELS references
const FLIGHTS = FLIGHTS_FALLBACK;

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
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Shared flight state — o singură instanță, partajată între Center și Right
  const myFlight = useMyFlightState();

  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); }, [theme]);

  const addLog = (msg: string, ok = true) =>
    setLogs(p => [{ ts: new Date().toLocaleTimeString("ro"), msg, ok }, ...p].slice(0, 30));

  const handleLogin = (a: AuthState) => {
    setAuth(a);
    if (a.role === "passenger") {
      setActivePerson(a.personId);
      if (a.flightIata) {
        myFlight.setInput(a.flightIata);
        myFlight.search(a.flightIata);
        setFeature("my-flight");
      } else {
        setFeature("route");
      }
    } else {
      setActivePerson("you");
    }
  };

  return (
    <div id="dashboard" className={auth ? "has-topbar" : ""}>
      {!auth && <LoginModal onLogin={handleLogin} />}
      {auth && (
        <TopBar
          auth={auth}
          theme={theme}
          setTheme={setTheme}
          drawerOpen={drawerOpen}
          setDrawerOpen={setDrawerOpen}
          onLogout={() => { setAuth(null); setDrawerOpen(false); }}
        />
      )}
      <div className="dashboard-grid">
        <LeftPanel
          feature={feature} setFeature={setFeature}
          theme={theme} setTheme={setTheme}
          logs={logs} announcements={announcements}
          drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen}
          hasTopBar={!!auth}
          role={auth?.role ?? null}
        />
        <CenterPanel feature={feature} onLog={addLog} weatherProvider={weatherProvider} activePerson={activePerson} announcements={announcements} setAnnouncements={setAnnouncements} role={auth?.role ?? null} myFlight={myFlight} />
        <RightPanel feature={feature} onLog={addLog} weatherProvider={weatherProvider} setWeatherProvider={setWeatherProvider} myFlight={myFlight} />
      </div>
      {!auth && <BottomBar activePerson={activePerson} setActivePerson={setActivePerson} />}
    </div>
  );
}

/* ═══════════════════════════ LEFT PANEL ═══════════════════════════ */
const NAV: { id: Feature; icon: string; label: string; sub: string }[] = [
  { id: "weather",    icon: "ti-cloud-storm",    label: "Vreme / METAR",    sub: "LRIA · Open-Meteo · NOAA"  },
  { id: "route",      icon: "ti-route",           label: "My Route",         sub: "Device Location · Orange"  },
  { id: "heatmap",    icon: "ti-map-2",           label: "Heatmap Terminal", sub: "Aglomerație zone"          },
  { id: "video-flow", icon: "ti-video",           label: "Flow Optimization",sub: "CV + AI Dispatcher · IAS"  },
  { id: "my-flight",  icon: "ti-plane-departure", label: "Zborul meu",       sub: "Traseu live · AirLabs"     },
];

const USER_NAV = [
  { icon: "ti-user-circle",    label: "Contul meu"  },
  { icon: "ti-plane-departure",label: "Zborul meu"  },
  { icon: "ti-bell",           label: "Notificări"  },
  { icon: "ti-settings",       label: "Setări"      },
  { icon: "ti-help-circle",    label: "Ajutor"      },
];

function LeftPanel({
  feature, setFeature, theme, setTheme, logs, announcements, drawerOpen, setDrawerOpen, hasTopBar, role,
}: {
  feature: Feature; setFeature: (f: Feature) => void;
  theme: "dark" | "light"; setTheme: (t: "dark" | "light") => void;
  logs: { ts: string; msg: string; ok: boolean }[];
  announcements: Announcement[];
  drawerOpen: boolean; setDrawerOpen: (v: boolean) => void;
  hasTopBar: boolean;
  role: "admin" | "passenger" | null;
}) {
  const isPassenger = role === "passenger";
  const visibleNav = isPassenger ? NAV.filter(n => n.id === "route" || n.id === "my-flight") : NAV;

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

      {/* Floating hamburger — mobile only, hidden when TopBar provides its own */}
      {!hasTopBar && (
        <button
          className="hamburger-float"
          onClick={() => setDrawerOpen(true)}
          title="Meniu"
        >
          <i className="ti ti-menu-2" />
        </button>
      )}

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
          {visibleNav.map(n => (
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
          {visibleNav.map(n => (
            <div key={n.id} className={`api-card${feature === n.id ? " active" : ""}`} onClick={() => setFeature(n.id)}>
              <div className="api-card-header"><i className={`ti ${n.icon}`} /> {n.label}</div>
              <div className="api-val">{n.sub}</div>
              <div className="api-status">
                <span className="dot green pulse-green" />
                {feature === n.id ? "Activ acum" : "Disponibil"}
              </div>
            </div>
          ))}

          {!isPassenger && (
            <>
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
            </>
          )}
        </div>

        {!isPassenger && (
          <div className="alert-box" style={{ marginTop: 12 }}>
            <div className="alert-title"><i className="ti ti-alert-triangle" /> Alertă activă</div>
            <div className="alert-desc">Aglomerație poarta C3 — QoD alocat camere video.</div>
          </div>
        )}
      </div>
    </>
  );
}

/* ═══════════════════════════ CENTER PANEL ═══════════════════════════ */
function CenterPanel({
  feature, onLog, weatherProvider, activePerson, announcements, setAnnouncements, role, myFlight,
}: {
  feature: Feature; onLog: (m: string, ok?: boolean) => void; weatherProvider: WeatherProvider;
  activePerson: string; announcements: Announcement[]; setAnnouncements: React.Dispatch<React.SetStateAction<Announcement[]>>;
  role: "admin" | "passenger" | null;
  myFlight: MyFlightState;
}) {
  const isPassenger = role === "passenger";
  return (
    <div className="card main-center">
      {feature === "weather"          && !isPassenger && <WeatherCenter onLog={onLog} provider={weatherProvider} />}
      {feature === "route"            && <RouteCenter   onLog={onLog} activePerson={activePerson} />}
      {feature === "heatmap"          && !isPassenger && <HeatmapCenter onLog={onLog} />}
      {feature === "flow-prediction"  && <FlowPredictionCenter onLog={onLog} />}
      {feature === "boarding-verify"  && <BoardingVerifyCenter activePerson={activePerson} onLog={onLog} />}
      {feature === "admin"            && activePerson === "you" && <AdminCenter onLog={onLog} setAnnouncements={setAnnouncements} />}
      {feature === "admin"            && activePerson !== "you" && <AnnouncementsCenter announcements={announcements} />}
      {feature === "announcements"    && <AnnouncementsCenter announcements={announcements} />}
      {feature === "status-api"       && <StatusApiCenter />}
      {feature === "account"          && <AccountCenter activePerson={activePerson} />}
      {feature === "settings"         && <SettingsCenter />}
      {feature === "my-flight"        && <MyFlightCenter onLog={onLog} myFlight={myFlight} />}
      {feature === "video-flow"       && <TrafficFlowCenter onLog={onLog} />}
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

/* ── SVG affine calibration ── */
const CAL_KEY = "svg_cal_v2";
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
  { svgX: 70,   svgY: 335, lat: 47.1746342,  lng: 27.6192034  }, // baza scări (calibrat)
  { svgX: 2207, svgY: 269, lat: 47.1740641,  lng: 27.6197010  }, // baie spate (calibrat)
  { svgX: 852,  svgY: 349, lat: 47.17439229, lng: 27.61903507 }, // masa echipei / securitate
  { svgX: 2244, svgY: 256, lat: 47.17406410, lng: 27.61970100 }, // dozator / poartă
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
const SVG_GATE      = { x: 1435, y: 265 }; // destinație / dozator

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

// Zone etape pasager — ordonate pe traseul din terminal
interface Zone { id: string; label: string; x: number; y: number; color: string; w: number; h: number }
const ZONES: Zone[] = [
  { id: "checkin",              label: "Check-in",              x: 108,  y: 407, color: "#38BDF8", w: 160, h: 90 },
  { id: "control-securitate",   label: "Control Securitate",    x: 417,  y: 252, color: "#F97316", w: 180, h: 90 },
  { id: "verificare-documente", label: "Verificare Documente",  x: 793,  y: 323, color: "#A78BFA", w: 180, h: 90 },
  { id: "sosire-poarta",        label: "Sosire la Poartă",      x: 1435, y: 265, color: "#34D399", w: 170, h: 90 },
  { id: "imbarcare",            label: "Îmbarcare",             x: 2150, y: 265, color: "#FBBF24", w: 140, h: 90 },
];

// Waypoints traseu = centrele zonelor calibrate + gate final
const ZONE_WAYPOINTS = ZONES.map(z => ({ x: z.x, y: z.y }));

// Ortogonal L-shape între două puncte
function makeOrthoRoute(from: {x:number;y:number}, to: {x:number;y:number}): {x:number;y:number}[] {
  return [from, { x: to.x, y: from.y }, to];
}

function makeRoute(personId: string): {x:number;y:number}[] {
  const s = SVG_STARTS[personId] ?? { x: 150, y: 500 };
  const waypoints = [s, ...ZONE_WAYPOINTS];
  const result: {x:number;y:number}[] = [waypoints[0]];
  for (let i = 1; i < waypoints.length; i++) {
    const segs = makeOrthoRoute(waypoints[i-1], waypoints[i]);
    result.push(...segs.slice(1));
  }
  return result;
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

/* 3 mock phone numbers → passenger mock data */
const PHONE_PERSONS: Record<string, string> = {
  "+40721000001": "misu",
  "+40721000002": "ionica",
  "+40721000003": "dorel",
};

/* Estimated walking time (min) to each gate from check-in */
const GATE_ETA_MIN: Record<string, number> = {
  "1":5, "2":6, "3":7, "4":8, "5":10, "6":12, "T3":15,
};

function RouteCenter({ onLog, activePerson }: { onLog:(m:string,ok?:boolean)=>void; activePerson: string }) {
  const [positions, setPositions] = useState<Record<string, {x:number;y:number}>>({
    you:    SVG_STARTS.you,
    misu:   SVG_STARTS.misu,
    ionica: SVG_STARTS.ionica,
    dorel:  SVG_STARTS.dorel,
  });

  const [locLoading, setLocLoading] = useState(false);
  const watchIdRef = useRef<number|null>(null);
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

  // Zoom / pan state (disabled in calMode / pixelLog)
  const MAP_ASPECT = 2262 / 587; // landscape map aspect ratio — used for portrait fill zoom
  // SSR-safe defaults (must match server render to avoid hydration mismatch)
  const [mapZoom, setMapZoom] = useState(1);
  const [mapPan, setMapPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const mapWrapRef = useRef<HTMLDivElement>(null);

  // Portrait mode detection — starts false (SSR-safe), set correctly after mount
  const [isPortrait, setIsPortrait] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(orientation: portrait) and (max-width: 900px)");
    const handler = (e: MediaQueryListEvent) => setIsPortrait(e.matches);
    mq.addEventListener("change", handler);
    setIsPortrait(mq.matches);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Auto-zoom to fill container when entering/leaving portrait mode
  const isPortraitRef = useRef(isPortrait);
  isPortraitRef.current = isPortrait;
  useEffect(() => {
    if (isPortrait) {
      setMapZoom(MAP_ASPECT);
      setMapPan({ x: 0, y: 0 });
    } else {
      setMapZoom(1);
      setMapPan({ x: 0, y: 0 });
    }
  }, [isPortrait]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fullscreen state + toggle
  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      mapWrapRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };
  useEffect(() => {
    const handler = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (fs) {
        // Wait one frame for the browser to resize the fullscreen element
        requestAnimationFrame(() => {
          const el = mapWrapRef.current;
          if (!el) return;
          const { width, height } = el.getBoundingClientRect();
          // Rotated map fits fully when Z = H/W (portrait: height > width)
          setMapZoom(height > width ? height / width : 1);
          setMapPan({ x: 0, y: 0 });
        });
      } else if (isPortraitRef.current) {
        // Back to normal portrait: restore fill zoom
        setMapZoom(MAP_ASPECT);
        setMapPan({ x: 0, y: 0 });
      }
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Dead-zone: only update position if moved > DEAD_ZONE_M metres
  const lastGps = useRef<Record<string, {lat:number;lng:number}>>({});
  const DEAD_ZONE_M = 5;

  // Haversine distance between two GPS points (in metres)
  const haversineM = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  useEffect(() => {
    const saved = loadCalibration();
    setCalPoints(saved.points);
    setCalTransform(saved.transform);
  }, []);

  useEffect(() => {
    const el = mapWrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (calMode || pixelLog) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      setMapZoom(z => Math.min(Math.max(z * factor, 0.5), 6));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [calMode, pixelLog]);

  const startDrag = (clientX: number, clientY: number) => {
    if (calMode || pixelLog) return;
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

  const [dynamicRoute, setDynamicRoute] = useState<{x:number;y:number}[]|null>(null);

  // ── Boarding task state machine ──
  type BoardingPhase = "idle"|"confirming"|"awaiting-location"|"task"|"done";
  const [boardingPhase, setBoardingPhase] = useState<BoardingPhase>("confirming");
  const [taskIdx, setTaskIdx] = useState(0);
  const TASKS = ZONES.map(z => ({ zone: z, label: z.label }));

  const advanceTask = () => {
    const next = taskIdx + 1;
    if (next >= TASKS.length) { setBoardingPhase("done"); }
    else { setTaskIdx(next); setBoardingPhase("task"); setDynamicRoute(null); }
  };

  const goToZone = () => {
    const zone = TASKS[taskIdx]?.zone;
    if (!zone || !positions[activePerson]) return;
    const from = positions[activePerson];
    const to = { x: zone.x, y: zone.y };
    const segs = makeOrthoRoute(from, to);
    setDynamicRoute(segs);
  };

  // Reset dynamic route when the active person changes
  const prevActivePerson = useRef(activePerson);
  if (prevActivePerson.current !== activePerson) {
    prevActivePerson.current = activePerson;
    setDynamicRoute(null);
  }

  const person = PEOPLE.find(p => p.id === activePerson)!;
  const flight = FLIGHTS.find(f => f.id === person.flightId) ?? null;
  const pts = activePerson === "you" ? dynamicRoute : null;
  const gatePos = flight ? GATE_SVG[flight.gate] : null;
  const polyline = pts ? pts.map(p => `${p.x},${p.y}`).join(" ") : "";

  const placeOnMap = (lat: number, lng: number, personId: string) => {
    if (!calTransform) return;
    const prev = lastGps.current[personId];
    if (prev && haversineM(prev.lat, prev.lng, lat, lng) < DEAD_ZONE_M) return;
    lastGps.current[personId] = { lat, lng };
    const svgPos = svgFromGps(calTransform, lat, lng);
    setPositions(p => ({ ...p, [personId]: svgPos }));
    // Pan map to keep active person centered, only if inside SVG bounds
    const SVG_W = 2262, SVG_H = 587;
    const inBounds = svgPos.x >= 0 && svgPos.x <= SVG_W && svgPos.y >= 0 && svgPos.y <= SVG_H;
    if (personId === activePerson && inBounds) {
      setMapPan(pan => {
        const containerEl = mapWrapRef.current;
        if (!containerEl) return pan;
        const { width, height } = containerEl.getBoundingClientRect();
        return { x: width / 2 - svgPos.x * mapZoom, y: height / 2 - svgPos.y * mapZoom };
      });
    }
    if (personId !== "you") return;
    // Zone proximity check — auto-advance task when entering active zone
    // We compare SVG distance (approx 1 SVG unit ≈ 0.04m at LRIA scale)
    // Recalculate route from current position if route is active
    setTaskIdx(idx => {
      setDynamicRoute(prev => {
        if (!prev) return prev;
        const zone = ZONES[idx];
        if (!zone) return prev;
        return makeOrthoRoute(svgPos, { x: zone.x, y: zone.y });
      });
      return idx;
    });
    setBoardingPhase(phase => {
      if (phase !== "task") return phase;
      return phase; // handled below via setState callback trick
    });
    setTaskIdx(idx => {
      const zone = ZONES[idx];
      if (!zone) return idx;
      const dist = Math.sqrt((svgPos.x - zone.x)**2 + (svgPos.y - zone.y)**2);
      if (dist < Math.max(zone.w, zone.h) * 0.6) {
        // entered zone — clear route, advance after short delay
        setTimeout(() => {
          setDynamicRoute(null);
          setBoardingPhase(p => p === "task" ? "task" : p);
          setTaskIdx(i => {
            const next = i + 1;
            if (next >= ZONES.length) { setBoardingPhase("done"); return i; }
            setBoardingPhase("task");
            return next;
          });
        }, 800);
      }
      return idx;
    });
  };

  // Auto-trigger permission prompt on mount for any logged-in user
  const locationAsked = useRef(false);
  useEffect(() => {
    if (navigator.geolocation && !locationAsked.current) {
      locationAsked.current = true;
      navigator.geolocation.getCurrentPosition(
        () => {}, // just request permission, do nothing yet
        () => {}, // ignore refusal — user can still click Localizează
        { timeout: 5000 }
      );
    }
  }, []);

  const getLocation = () => {
    if (!navigator.geolocation) { onLog("Geolocation indisponibil", false); return; }
    // Stop any existing watch
    if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); }
    setLocLoading(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        placeOnMap(lat, lng, activePerson);
        onLog(`${person.name} · ${lat.toFixed(4)}, ${lng.toFixed(4)} ±${pos.coords.accuracy.toFixed(0)}m`);
        setBoardingPhase(p => p === "awaiting-location" ? "task" : p);
        setLocLoading(false);
      },
      (err) => { onLog(`Eroare locație: ${err.message}`, false); setLocLoading(false); },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );
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

      {/* Map — zoomable/pannable (pan/wheel disabled in calMode/pixelLog) */}
      <div
        ref={mapWrapRef}
        className="map-container"
        style={{
          position: "relative", flex: 1,
          ...(isPortrait ? { height: "calc(100svh - 195px)", minHeight: 300 } : {}),
          borderRadius: "var(--radius-md)", overflow: "hidden",
          border: `1px solid ${calMode?"var(--brand)":pixelLog?"#F59E0B":"var(--border-color)"}`,
          cursor: calMode||pixelLog ? "crosshair" : (isDragging ? "grabbing" : "grab"),
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
        {/* Zoom controls — hidden in calMode/pixelLog */}
        {!calMode && !pixelLog && (
          <div style={{ position:"absolute", top:8, right:8, zIndex:10, display:"flex", flexDirection:"column", gap:4 }}>
            <button style={zoomBtnStyle} onClick={() => setMapZoom(z => Math.min(z * 1.25, 6))} title="Zoom in">+</button>
            <button style={zoomBtnStyle} onClick={() => setMapZoom(z => Math.max(z * 0.8, 0.5))} title="Zoom out">−</button>
            <button style={{ ...zoomBtnStyle, fontSize:12 }} onClick={() => { setMapZoom(isPortrait ? MAP_ASPECT : 1); setMapPan({ x:0, y:0 }); }} title="Reset">
              <i className="ti ti-home-2" />
            </button>
            <button style={{ ...zoomBtnStyle, fontSize:14 }} onClick={toggleFullscreen} title={isFullscreen ? "Ieși din ecran complet" : "Ecran complet"}>
              <i className={`ti ti-arrows-${isFullscreen ? "minimize" : "maximize"}`} />
            </button>
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

        {/* Pixel logger hover coords — outside transform so it stays fixed top-left */}
        {pixelLog && hoverPos && (
          <div style={{ position:"absolute", top:8, left:8, zIndex:10, background:"rgba(11,17,32,0.92)", border:"1px solid #F59E0B", borderRadius:6, padding:"6px 10px", fontSize:12, color:"#F59E0B", pointerEvents:"none" }}>
            x: <b>{hoverPos.x.toFixed(0)}</b> · y: <b>{hoverPos.y.toFixed(0)}</b>
          </div>
        )}

        {/* Transformable layer — floor plan + SVG overlay zoom/pan together */}
        <div style={{
          position: "absolute", inset: 0,
          transform: `translate(${mapPan.x}px, ${mapPan.y}px) scale(${mapZoom})${isPortrait ? " rotate(-90deg)" : ""}`,
          transition: "transform 0.4s ease-out",
          transformOrigin: "center center",
        }}>
          <img src="/harta_completa.svg" alt="Hartă T4 LRIA" draggable={false}
            style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"contain", display:"block", zIndex:1 }} />

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
              {ZONES.map(z => (
                <marker key={z.id} id={`arrow-${z.id}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L8,3 z" fill={z.color}/>
                </marker>
              ))}
              <marker id="arrow-default" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#38BDF8"/>
              </marker>
            </defs>

            {/* Route segments — thick arrows colored per zone */}
            {!calMode && pts && pts.slice(1).map((pt, i) => {
              const zone = ZONES[Math.min(i, ZONES.length-1)];
              const color = zone?.color ?? person.color;
              const markerId = zone ? `arrow-${zone.id}` : "arrow-default";
              const from = pts[i];
              return <line key={i} x1={from.x} y1={from.y} x2={pt.x} y2={pt.y}
                stroke={color} strokeWidth="6" strokeDasharray="16 10" strokeLinecap="round"
                markerEnd={`url(#${markerId})`}
                style={{ animation:"moveDash 1.2s linear infinite", filter:`drop-shadow(0 0 6px ${color}99)` }}/>;
            })}

            {/* Zone etape */}
            {!calMode && ZONES.map(z => {
              const words = z.label.split(" ");
              const lineH = 16;
              const totalH = words.length * lineH;
              const rot = isPortrait ? 90 : 0;
              return (
                <g key={z.id} transform={`rotate(${rot}, ${z.x}, ${z.y})`}>
                  <rect x={z.x - z.w/2} y={z.y - z.h/2} width={z.w} height={z.h} rx="10"
                    fill={`${z.color}22`} stroke={z.color} strokeWidth="1.5"/>
                  <text textAnchor="middle" fill={z.color} fontSize="13" fontWeight="800">
                    {words.map((w, i) => (
                      <tspan key={i} x={z.x} dy={i === 0 ? z.y - totalH/2 + lineH * 0.8 : lineH}>{w}</tspan>
                    ))}
                  </text>
                </g>
              );
            })}

            {/* Gate */}
            {!calMode && gatePos && (
              <g filter="url(#glow2)">
                <circle cx={gatePos.x} cy={gatePos.y} r="14" fill="none" stroke="#10B981" strokeWidth="2" style={{animation:"pulse 2s infinite"}}/>
                <circle cx={gatePos.x} cy={gatePos.y} r="7" fill="#10B981"/>
                <text x={gatePos.x} y={gatePos.y-18} textAnchor="middle" fill="#10B981" fontSize="12" fontWeight="700">{GATE_LABELS[flight?.gate ?? ""]}</text>
              </g>
            )}

            {/* All person dots — use smoothPositions for fluid movement */}
            {!calMode && PEOPLE.map(p => {
              const pos = positions[p.id];
              return (
                <g key={p.id} filter="url(#glow2)" opacity={p.id === activePerson ? 1 : 0.5}>
                  <circle cx={pos.x} cy={pos.y} r={p.id===activePerson?16:10} fill="none" stroke={p.color} strokeWidth="2.5" style={p.id===activePerson?{animation:"pulse 2s infinite"}:{}}/>
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
        </div>
        <style>{`
          @keyframes moveDash { to { stroke-dashoffset: -200; } }
          @keyframes pulse { 0%,100%{opacity:0.2} 50%{opacity:0.8} }
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

      {/* ETA card — shown on all screens, prominent on mobile */}
      {flight && (
        <div className="route-eta-card fade-in">
          <div style={{ display:"flex", alignItems:"center", gap:10, flex:1 }}>
            <i className="ti ti-walk" style={{ fontSize:22, color:"var(--brand)", flexShrink:0 }}/>
            <div>
              <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:2 }}>Timp estimat până la poartă</div>
              <div style={{ fontSize:22, fontWeight:700, color:"var(--text-main)", lineHeight:1 }}>
                {GATE_ETA_MIN[flight.gate] ?? 8}
                <span style={{ fontSize:13, fontWeight:400, color:"var(--text-muted)", marginLeft:4 }}>min mers</span>
              </div>
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, flexShrink:0 }}>
            <div style={{ fontSize:11, color:"var(--text-muted)" }}>Decolare</div>
            <div style={{ fontSize:15, fontWeight:600, color:person.color }}>{flight.departs}</div>
            <div style={{ fontSize:11, color:"var(--text-muted)" }}>{GATE_LABELS[flight.gate]}</div>
          </div>
        </div>
      )}

      {/* Flight info strip */}
      {flight && (
        <div style={{ marginTop:8, padding:"10px 14px", borderRadius:"var(--radius-md)", border:`1px solid ${person.color}44`, background:`${person.color}11`, display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
          <i className="ti ti-plane" style={{color:person.color,fontSize:20}}/>
          <div style={{flex:1}}>
            <div style={{fontWeight:600,fontSize:14,color:person.color}}>{flight.flight} → {flight.dest}</div>
            <div style={{fontSize:12,color:"var(--text-muted)"}}>{GATE_LABELS[flight.gate]} · Decolare {flight.departs}</div>
          </div>
        </div>
      )}

      {/* ── Boarding task overlay ── */}
      {boardingPhase === "confirming" && (
        <div style={{ marginTop:8, padding:"14px 16px", background:"var(--bg-card)", border:"1px solid var(--border-color)", borderRadius:12, flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
            <span style={{ fontSize:22 }}>✈️</span>
            <span style={{ fontWeight:700, fontSize:15 }}>Începeți procesul de îmbarcare?</span>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={() => setBoardingPhase("awaiting-location")}
              style={{ flex:1, padding:"10px 0", background:"var(--brand)", border:"none", borderRadius:8, color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer" }}>Da</button>
            <button onClick={() => setBoardingPhase("idle")}
              style={{ flex:1, padding:"10px 0", background:"var(--bg-hover)", border:"1px solid var(--border-color)", borderRadius:8, color:"var(--text-muted)", fontSize:14, cursor:"pointer" }}>Nu</button>
          </div>
        </div>
      )}

      {boardingPhase === "awaiting-location" && (
        <div style={{ marginTop:8, padding:"14px 16px", background:"rgba(56,189,248,0.1)", border:"1px solid #38BDF8", borderRadius:12, display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
          <i className="ti ti-map-pin" style={{ color:"#38BDF8", fontSize:22, flexShrink:0 }}/>
          <div>
            <div style={{ fontWeight:700, fontSize:14, color:"#38BDF8" }}>Activați localizarea</div>
            <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:2 }}>Apăsați butonul <b>Localizează</b> pentru a continua ghidarea.</div>
          </div>
        </div>
      )}

      {boardingPhase === "task" && TASKS[taskIdx] && (
        <div style={{ marginTop:8, padding:"14px 16px", background:`${TASKS[taskIdx].zone.color}18`, border:`1px solid ${TASKS[taskIdx].zone.color}`, borderRadius:12, flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
            <span style={{ background:TASKS[taskIdx].zone.color, color:"#000", fontWeight:800, fontSize:12, borderRadius:20, padding:"2px 10px" }}>
              {taskIdx + 1} / {TASKS.length}
            </span>
            <span style={{ fontWeight:700, fontSize:15, color:TASKS[taskIdx].zone.color }}>{TASKS[taskIdx].label}</span>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={advanceTask}
              style={{ flex:1, padding:"9px 0", background:TASKS[taskIdx].zone.color, border:"none", borderRadius:8, color:"#000", fontWeight:700, fontSize:13, cursor:"pointer" }}>
              ✓ Am făcut
            </button>
            <button onClick={goToZone}
              style={{ flex:1, padding:"9px 0", background:"var(--bg-hover)", border:`1px solid ${TASKS[taskIdx].zone.color}`, borderRadius:8, color:TASKS[taskIdx].zone.color, fontWeight:600, fontSize:13, cursor:"pointer" }}>
              ➜ Mergi spre {TASKS[taskIdx].label}
            </button>
          </div>
        </div>
      )}

      {boardingPhase === "done" && (
        <div style={{ marginTop:8, padding:"14px 16px", background:"rgba(52,211,153,0.15)", border:"1px solid #34D399", borderRadius:12, textAlign:"center", flexShrink:0 }}>
          <div style={{ fontSize:22 }}>🎉</div>
          <div style={{ fontWeight:700, fontSize:15, color:"#34D399", marginTop:4 }}>Îmbarcare completă! Zbor plăcut!</div>
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

  // Map GPS → SVG folosind cele 2 puncte ancorate (Security și Gate)
  // Interpolare liniară pe axa lng → x, lat → y
  const GPS_ANCHOR = [
    { lat: 47.17439, lng: 27.61903, svgX: 852,  svgY: 349 },
    { lat: 47.17406, lng: 27.61970, svgX: 2244, svgY: 256 },
  ];
  const dLng = GPS_ANCHOR[1].lng - GPS_ANCHOR[0].lng;
  const dLat = GPS_ANCHOR[1].lat - GPS_ANCHOR[0].lat;
  const dX   = GPS_ANCHOR[1].svgX - GPS_ANCHOR[0].svgX;
  const dY   = GPS_ANCHOR[1].svgY - GPS_ANCHOR[0].svgY;

  function gpsToSvg(lat: number, lng: number) {
    const tLng = (lng - GPS_ANCHOR[0].lng) / dLng;
    const tLat = (lat - GPS_ANCHOR[0].lat) / dLat;
    return {
      x: GPS_ANCHOR[0].svgX + tLng * dX + (tLat - tLng) * 200,
      y: GPS_ANCHOR[0].svgY + tLng * dY + (tLat - tLng) * (-120),
    };
  }

  const maxDensity = Math.max(...densityData.map(c => c.pplDensity ?? 0), 1);

  const circles = densityData
    .filter(c => c.pplDensity)
    .map(c => {
      const { lat, lng } = decodeGeohash(c.geohash);
      const pos = gpsToSvg(lat, lng);
      const intensity = (c.pplDensity ?? 0) / maxDensity;
      const r = 20 + intensity * 65;
      const color = intensity > 0.7 ? "#EF5350" : intensity > 0.35 ? "#FFA726" : "#66BB6A";
      return { ...pos, r, color, intensity, density: c.pplDensity ?? 0 };
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
              {c.intensity > 0.85 && <circle cx={c.x} cy={c.y} r={8} fill={c.color} opacity="0.95"/>}
            </g>
          ))}
          {/* Label cozi */}
          <text x={852}  y={320} textAnchor="middle" fill="#EF5350" fontSize="13" fontWeight="700">⚠ Coadă Security</text>
          <text x={2244} y={228} textAnchor="middle" fill="#EF5350" fontSize="13" fontWeight="700">⚠ Coadă Boarding</text>
        </svg>
      </div>
    </>
  );
}

/* ═══════════════════════════ RIGHT PANEL ═══════════════════════════ */
function RightPanel({
  feature, onLog, weatherProvider, setWeatherProvider, myFlight,
}: {
  feature: Feature; onLog:(m:string,ok?:boolean)=>void;
  weatherProvider: WeatherProvider; setWeatherProvider: (p: WeatherProvider) => void;
  myFlight: MyFlightState;
}) {
  return (
    <div className="card sidebar-right">
      {feature === "weather" && <WeatherRight weatherProvider={weatherProvider} setWeatherProvider={setWeatherProvider} />}
      {feature === "route"   && <RouteRight onLog={onLog} />}
      {feature === "heatmap" && <HeatmapRight />}
      {feature === "my-flight" && <MyFlightRight onLog={onLog} myFlight={myFlight} />}
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

  // Live flights state
  const [liveFlights, setLiveFlights] = useState<LiveFlight[]>([]);
  const [flightsLoading, setFlightsLoading] = useState(false);
  const [flightsFetchedAt, setFlightsFetchedAt] = useState<string>("");
  const [currentTimeRO, setCurrentTimeRO] = useState<string>("");
  const [flightsError, setFlightsError] = useState(false);

  const fetchFlights = () => {
    setFlightsLoading(true);
    setFlightsError(false);
    fetch("/api/flights")
      .then(r => r.json())
      .then((data) => {
        if (data.error) { setFlightsError(true); setLiveFlights([]); return; }
        const mapped: LiveFlight[] = (data.flights ?? []).map((f: any, i: number) => ({
          ...f,
          color: FLIGHT_COLORS[i % FLIGHT_COLORS.length],
        }));
        setLiveFlights(mapped);
        setFlightsFetchedAt(data.fetchedAt ?? "");
        setCurrentTimeRO(data.currentTimeRO ?? "");
        onLog(`AirLabs: ${mapped.length} zboruri IAS · ora ${data.currentTimeRO}`);
      })
      .catch(() => { setFlightsError(true); setLiveFlights([]); onLog("Eroare fetch zboruri AirLabs", false); })
      .finally(() => setFlightsLoading(false));
  };

  useEffect(() => {
    fetchFlights();
    const t = setInterval(fetchFlights, 60_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      {/* ── Header row cu ora curentă + refresh ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
        <div style={{ fontSize:11, color:"var(--text-muted)", display:"flex", alignItems:"center", gap:5 }}>
          <span className={`dot ${flightsError ? "red" : "green"}${!flightsError ? " pulse-green" : ""}`} style={{ width:6, height:6 }}/>
          {flightsError ? "Eroare AirLabs" : `Live · IAS · ora ${currentTimeRO || "—"}`}
        </div>
        <button
          onClick={fetchFlights}
          disabled={flightsLoading}
          title="Refresh zboruri"
          style={{ background:"transparent", border:"none", color:"var(--text-muted)", cursor:"pointer", padding:"2px 4px", fontSize:13 }}
        >
          <i className={`ti ti-refresh${flightsLoading ? " spin" : ""}`} />
        </button>
      </div>

      <div className="flight-list">
        {(liveFlights.length > 0 ? liveFlights : FLIGHTS_FALLBACK).map(f => {
          const isActive  = f.status === "active";
          const isCancelled = f.status === "cancelled";
          const hasDelay = f.delayed && f.delayed > 0;
          const statusColor = isCancelled ? "var(--danger)" : isActive ? "var(--brand)" : hasDelay ? "var(--warning)" : "var(--success)";
          const statusLabel = isCancelled ? "ANULAT" : isActive ? "ÎN AER" : hasDelay ? `+${f.delayed}min` : "LA TMP";
          return (
            <div key={f.id} className={`flight-item${sel===f.id?" active":""}`} onClick={() => setSel(sel===f.id?null:f.id)}>
              <i className="ti ti-plane" style={{ color: f.color, fontSize:18, opacity: isCancelled ? 0.4 : 1 }} />
              <div style={{ flex:1 }}>
                <div className="flight-nr" style={{ opacity: isCancelled ? 0.5 : 1 }}>{f.flight}</div>
                <div className="flight-dest">{f.dest}</div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:2 }}>
                <div className="flight-gate" style={{ color: f.color }}>
                  {f.gate !== "—" ? `G${f.gate} · ` : ""}{f.departs}
                </div>
                <div style={{ fontSize:10, fontWeight:700, color: statusColor, letterSpacing:"0.5px" }}>
                  {statusLabel}
                </div>
              </div>
            </div>
          );
        })}
        {liveFlights.length === 0 && !flightsLoading && !flightsError && (
          <div style={{ fontSize:12, color:"var(--text-muted)", textAlign:"center", padding:"12px 0" }}>
            Niciun zbor în fereastra curentă
          </div>
        )}
        {flightsLoading && liveFlights.length === 0 && (
          <div style={{ fontSize:12, color:"var(--text-muted)", textAlign:"center", padding:"12px 0", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
            <i className="ti ti-loader-2 spin" /> Se încarcă...
          </div>
        )}
      </div>

      {flightsFetchedAt && (
        <div style={{ fontSize:10, color:"var(--text-muted)", textAlign:"right", marginTop:2, marginBottom:6 }}>
          Actualizat {new Date(flightsFetchedAt).toLocaleTimeString("ro", { hour:"2-digit", minute:"2-digit", second:"2-digit" })} · refresh auto 60s
        </div>
      )}

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
            <div key={`est-${c.geohash}`} className="zone-row">
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
          <div key={`low-${c.geohash}`} className="zone-row">
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

/* ═══════════════════════════ MY FLIGHT — shared state hook ═══════════════════════════ */
const MF_KEY = "airhack_my_flight";

export interface MyFlightState {
  input: string;
  setInput: (v: string) => void;
  loading: boolean;
  detail: FlightDetail | null;
  error: string;
  search: (code: string) => Promise<void>;
}

function useMyFlightState(): MyFlightState {
  const [input, setInput]     = useState(() => {
    try { return localStorage.getItem(MF_KEY) ?? ""; } catch { return ""; }
  });
  const [loading, setLoading] = useState(false);
  const [detail, setDetail]   = useState<FlightDetail | null>(null);
  const [error, setError]     = useState("");

  const search = async (code: string) => {
    const c = code.trim().toUpperCase().replace(/\s/g, "");
    if (!c) return;
    setLoading(true); setError(""); setDetail(null);
    try {
      const r = await fetch(`/api/flight-details?flight=${encodeURIComponent(c)}`);
      const d = await r.json();
      if (d.error) { setError(d.error); }
      else {
        setDetail(d);
        try { localStorage.setItem(MF_KEY, c); } catch {}
      }
    } catch { setError("Eroare de rețea. Încearcă din nou."); }
    finally   { setLoading(false); }
  };

  // Auto-load din localStorage la mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MF_KEY);
      if (saved) search(saved);
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { input, setInput, loading, detail, error, search };
}

/* ─── Airport coordinates for route map (lat/lon) ─── */
const AIRPORT_COORDS: Record<string, { lat: number; lon: number; label: string }> = {
  IAS: { lat: 47.178, lon: 27.621, label: "Iași" },
  OTP: { lat: 44.572, lon: 26.102, label: "București" },
  BCN: { lat: 41.297, lon: 2.078,  label: "Barcelona" },
  DUB: { lat: 53.421, lon: -6.270, label: "Dublin" },
  VIE: { lat: 48.110, lon: 16.570, label: "Viena" },
  LTN: { lat: 51.874, lon: -0.368, label: "Londra" },
  MXP: { lat: 45.630, lon: 8.728,  label: "Milano" },
  BGY: { lat: 45.669, lon: 9.704,  label: "Milano BGY" },
  CDG: { lat: 49.009, lon: 2.548,  label: "Paris" },
  FRA: { lat: 50.037, lon: 8.562,  label: "Frankfurt" },
  MUC: { lat: 48.354, lon: 11.786, label: "München" },
  AMS: { lat: 52.310, lon: 4.768,  label: "Amsterdam" },
  MAD: { lat: 40.472, lon: -3.561, label: "Madrid" },
  FCO: { lat: 41.800, lon: 12.239, label: "Roma" },
  ATH: { lat: 37.936, lon: 23.944, label: "Atena" },
  SKG: { lat: 40.520, lon: 22.971, label: "Salonic" },
  RHO: { lat: 36.405, lon: 28.086, label: "Rodos" },
  LCA: { lat: 34.875, lon: 33.625, label: "Larnaca" },
  FMM: { lat: 47.988, lon: 10.239, label: "Memmingen" },
  IST: { lat: 41.275, lon: 28.752, label: "Istanbul" },
  TLV: { lat: 32.011, lon: 34.887, label: "Tel Aviv" },
  WAW: { lat: 52.166, lon: 20.967, label: "Varșovia" },
  BUD: { lat: 47.437, lon: 19.261, label: "Budapesta" },
  PRG: { lat: 50.100, lon: 14.260, label: "Praga" },
  ZRH: { lat: 47.458, lon: 8.548,  label: "Zürich" },
  BRU: { lat: 50.901, lon: 4.484,  label: "Bruxelles" },
  LIS: { lat: 38.774, lon: -9.135, label: "Lisabona" },
  CLJ: { lat: 46.785, lon: 23.686, label: "Cluj" },
  TSR: { lat: 45.809, lon: 21.338, label: "Timișoara" },
};


/* ─── SVG Route Map ─── */
function RouteMapSVG({ dep, arr, progress }: {
  dep: string; arr: string; progress: number | null;
}) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const from = AIRPORT_COORDS[dep];
  const to   = AIRPORT_COORDS[arr];
  if (!from || !to) return (
    <div style={{ textAlign:"center", padding:32, color:"var(--text-muted)", fontSize:12 }}>
      <i className="ti ti-map-off" style={{ fontSize:28, display:"block", marginBottom:8, opacity:0.4 }} />
      Coordonate indisponibile pentru {dep} → {arr}
    </div>
  );

  const minLon = Math.min(from.lon, to.lon);
  const maxLon = Math.max(from.lon, to.lon);
  const minLat = Math.min(from.lat, to.lat);
  const maxLat = Math.max(from.lat, to.lat);

  const fontSize = 10;
  const citySize = 9;
  const dotR     = 6;
  const planeSize = 8;

  if (isMobile) {
    // Portrait: swap axes so route runs vertically on phone
    // latitude → X axis, longitude → Y axis (higher lon = lower = more south visually rotated)
    const W   = 220;
    const H   = 400;
    const PAD = 40;

    const spanLat = Math.max(maxLat - minLat, 0.5);
    const spanLon = Math.max(maxLon - minLon, 1);

    const project = (lat: number, lon: number) => ({
      x: PAD + ((lat - minLat) / spanLat) * (W - 2 * PAD),
      y: PAD + ((lon - minLon) / spanLon) * (H - 2 * PAD),
    });

    const pDep = project(from.lat, from.lon);
    const pArr = project(to.lat, to.lon);
    const dist = Math.hypot(pArr.x - pDep.x, pArr.y - pDep.y);

    // Arc curves to the right (eastward = rightward in this rotated projection)
    const mx = (pDep.x + pArr.x) / 2 + dist * 0.22;
    const my = (pDep.y + pArr.y) / 2;

    const pathD = `M ${pDep.x} ${pDep.y} Q ${mx} ${my} ${pArr.x} ${pArr.y}`;

    let planeX = mx, planeY = my, planeAngle = 0;
    if (progress !== null) {
      const t = progress / 100;
      const bx = (1-t)*(1-t)*pDep.x + 2*(1-t)*t*mx + t*t*pArr.x;
      const by = (1-t)*(1-t)*pDep.y + 2*(1-t)*t*my + t*t*pArr.y;
      const t2 = Math.min(t + 0.01, 1);
      const bx2 = (1-t2)*(1-t2)*pDep.x + 2*(1-t2)*t2*mx + t2*t2*pArr.x;
      const by2 = (1-t2)*(1-t2)*pDep.y + 2*(1-t2)*t2*my + t2*t2*pArr.y;
      planeX = bx; planeY = by;
      planeAngle = Math.atan2(by2 - by, bx2 - bx) * (180 / Math.PI);
    }

    const gridLines = [0.25, 0.5, 0.75].map(f => (
      <line key={f} x1={PAD/2} y1={PAD + f*(H-2*PAD)} x2={W-PAD/2} y2={PAD + f*(H-2*PAD)}
        stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3,4" />
    ));

    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto", borderRadius:"var(--radius-md)", background:"var(--bg-body)", border:"1px solid var(--border-color)" }}>
        {gridLines}
        <path d={pathD} fill="none" stroke="var(--border-color)" strokeWidth="1.5" strokeDasharray="6,4" />
        {progress !== null && progress > 0 && (
          <path d={pathD} fill="none" stroke="var(--brand)" strokeWidth="3"
            strokeDasharray={`${progress * 4} 9999`} strokeLinecap="round" opacity="0.9" />
        )}
        <circle cx={pDep.x} cy={pDep.y} r={dotR} fill="var(--success)" opacity="0.9" />
        <circle cx={pDep.x} cy={pDep.y} r={dotR/2} fill="#fff" />
        <text x={pDep.x} y={pDep.y - dotR - 4} textAnchor="middle" fontSize={fontSize} fill="var(--success)" fontWeight="700">{dep}</text>
        <text x={pDep.x} y={pDep.y + dotR + 14} textAnchor="middle" fontSize={citySize} fill="var(--text-muted)">{from.label}</text>
        <circle cx={pArr.x} cy={pArr.y} r={dotR} fill="var(--info)" opacity="0.9" />
        <circle cx={pArr.x} cy={pArr.y} r={dotR/2} fill="#fff" />
        <text x={pArr.x} y={pArr.y - dotR - 4} textAnchor="middle" fontSize={fontSize} fill="var(--info)" fontWeight="700">{arr}</text>
        <text x={pArr.x} y={pArr.y + dotR + 14} textAnchor="middle" fontSize={citySize} fill="var(--text-muted)">{to.label}</text>
        {progress !== null && (
          <g transform={`translate(${planeX},${planeY}) rotate(${planeAngle})`}>
            <polygon points={`-${planeSize},${planeSize*0.6} ${planeSize},0 -${planeSize},-${planeSize*0.6}`} fill="var(--brand)" opacity="0.95" />
            <circle cx="0" cy="0" r={planeSize + 2} fill="var(--brand)" opacity="0.15" />
          </g>
        )}
      </svg>
    );
  }

  // Desktop: wide & compact landscape
  const W   = 440;
  const H   = 200;
  const PAD = 32;
  const minSpan = 2;

  const spanLon = Math.max(maxLon - minLon, minSpan);
  const spanLat = Math.max(maxLat - minLat, minSpan);

  const project = (lat: number, lon: number) => ({
    x: PAD + ((lon - minLon) / spanLon) * (W - 2 * PAD),
    y: (H - PAD) - ((lat - minLat) / spanLat) * (H - 2 * PAD),
  });

  const pDep = project(from.lat, from.lon);
  const pArr = project(to.lat, to.lon);

  // Arc midpoint elevated (great circle approximation)
  const mx = (pDep.x + pArr.x) / 2;
  const my = (pDep.y + pArr.y) / 2 - Math.hypot(pArr.x - pDep.x, pArr.y - pDep.y) * 0.22;

  const pathD = `M ${pDep.x} ${pDep.y} Q ${mx} ${my} ${pArr.x} ${pArr.y}`;

  let planeX = mx, planeY = my, planeAngle = 0;
  if (progress !== null) {
    const t = progress / 100;
    const bx = (1-t)*(1-t)*pDep.x + 2*(1-t)*t*mx + t*t*pArr.x;
    const by = (1-t)*(1-t)*pDep.y + 2*(1-t)*t*my + t*t*pArr.y;
    const t2 = Math.min(t + 0.01, 1);
    const bx2 = (1-t2)*(1-t2)*pDep.x + 2*(1-t2)*t2*mx + t2*t2*pArr.x;
    const by2 = (1-t2)*(1-t2)*pDep.y + 2*(1-t2)*t2*my + t2*t2*pArr.y;
    planeX = bx; planeY = by;
    planeAngle = Math.atan2(by2 - by, bx2 - bx) * (180 / Math.PI);
  }

  const gridLines = [0.25, 0.5, 0.75].map(f => (
    <line key={f} x1={PAD + f*(W-2*PAD)} y1={PAD/2} x2={PAD + f*(W-2*PAD)} y2={H-PAD/2}
      stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3,4" />
  ));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto", borderRadius:"var(--radius-md)", background:"var(--bg-body)", border:"1px solid var(--border-color)" }}>
      {gridLines}
      <path d={pathD} fill="none" stroke="var(--border-color)" strokeWidth="1.5" strokeDasharray="6,4" />
      {progress !== null && progress > 0 && (
        <path d={pathD} fill="none" stroke="var(--brand)" strokeWidth="2.5"
          strokeDasharray={`${progress * 4} 9999`} strokeLinecap="round" opacity="0.9" />
      )}
      <circle cx={pDep.x} cy={pDep.y} r={dotR} fill="var(--success)" opacity="0.9" />
      <circle cx={pDep.x} cy={pDep.y} r={dotR/2} fill="#fff" />
      <text x={pDep.x} y={pDep.y - dotR - 4} textAnchor="middle" fontSize={fontSize} fill="var(--success)" fontWeight="700">{dep}</text>
      <text x={pDep.x} y={pDep.y + dotR + 14} textAnchor="middle" fontSize={citySize} fill="var(--text-muted)">{from.label}</text>
      <circle cx={pArr.x} cy={pArr.y} r={dotR} fill="var(--info)" opacity="0.9" />
      <circle cx={pArr.x} cy={pArr.y} r={dotR/2} fill="#fff" />
      <text x={pArr.x} y={pArr.y - dotR - 4} textAnchor="middle" fontSize={fontSize} fill="var(--info)" fontWeight="700">{arr}</text>
      <text x={pArr.x} y={pArr.y + dotR + 14} textAnchor="middle" fontSize={citySize} fill="var(--text-muted)">{to.label}</text>
      {progress !== null && (
        <g transform={`translate(${planeX},${planeY}) rotate(${planeAngle})`}>
          <polygon points={`-${planeSize},${planeSize*0.6} ${planeSize},0 -${planeSize},-${planeSize*0.6}`} fill="var(--brand)" opacity="0.95" />
          <circle cx="0" cy="0" r={planeSize + 2} fill="var(--brand)" opacity="0.15" />
        </g>
      )}
    </svg>
  );
}

/* ─── MyFlightCenter ─── */
function MyFlightCenter({ onLog, myFlight }: { onLog:(m:string,ok?:boolean)=>void; myFlight: MyFlightState }) {
  const { input, setInput, loading, detail, error, search } = myFlight;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search(input);
  };

  const status = detail ? (STATUS_META[detail.status] ?? { label: detail.status, color: "var(--text-muted)", icon: "ti-question-mark" }) : null;

  useEffect(() => {
    if (detail) onLog(`Zborul meu: ${detail.flight} ${detail.departure.iata}→${detail.arrival.iata} · ${status?.label}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  return (
    <div style={{ padding:24, height:"100%", display:"flex", flexDirection:"column", gap:0, overflowY:"auto" }}>
      {/* Header */}
      <div className="map-header" style={{ marginBottom:16 }}>
        <div>
          <div className="map-title"><i className="ti ti-plane-departure" style={{ marginRight:8 }} />Zborul meu</div>
          <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>
            Traseu live · AirLabs · {detail ? `${detail.departure.iata} → ${detail.arrival.iata}` : "Introdu codul IATA"}
          </div>
        </div>
        {detail && status && (
          <div className="badge" style={{ background:`${status.color}22`, color:status.color, border:`1px solid ${status.color}44`, fontSize:12, fontWeight:700, padding:"5px 12px" }}>
            <i className={`ti ${status.icon}`} style={{ marginRight:4 }} />{status.label}
          </div>
        )}
      </div>

      {/* Search */}
      <form onSubmit={handleSubmit} style={{ display:"flex", gap:8, marginBottom:20, flexShrink:0 }}>
        <input
          type="text"
          className="phone-input"
          placeholder="Cod IATA zbor — ex: LH6381, W43653, RO708"
          value={input}
          onChange={e => setInput(e.target.value)}
          style={{ flex:1, textTransform:"uppercase" }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="btn-primary"
          style={{ padding:"9px 20px", display:"flex", alignItems:"center", gap:6 }}
        >
          <i className={`ti ti-${loading ? "loader-2 spin" : "search"}`} />
          {loading ? "..." : "Caută"}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div style={{ padding:"10px 14px", borderRadius:"var(--radius-md)", background:"var(--danger-bg)", border:"1px solid var(--danger)", color:"var(--danger)", fontSize:13, marginBottom:16, display:"flex", alignItems:"center", gap:8 }}>
          <i className="ti ti-alert-circle" /> {error}
        </div>
      )}

      {/* Map */}
      {detail ? (
        <>
          {/* Progress bar zbor activ */}
          {detail.status === "active" && detail.progressPct !== null && (
            <div style={{ marginBottom:14, padding:"12px 16px", background:"var(--bg-body)", border:"1px solid var(--border-color)", borderRadius:"var(--radius-md)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--text-muted)", marginBottom:6 }}>
                <span style={{ fontWeight:600, color:"var(--success)" }}>
                  <i className="ti ti-plane-departure" /> {detail.departure.iata} · {detail.departure.actual !== "—" ? detail.departure.actual : detail.departure.scheduled}
                </span>
                <span style={{ color:"var(--brand)", fontWeight:700 }}>
                  <i className="ti ti-clock" /> {detail.remainingMin} min rămași
                </span>
                <span style={{ fontWeight:600, color:"var(--info)" }}>
                  <i className="ti ti-plane-arrival" /> {detail.arrival.iata} · {detail.arrival.estimated !== "—" ? detail.arrival.estimated : detail.arrival.scheduled}
                </span>
              </div>
              <div style={{ height:8, background:"var(--bg-hover)", borderRadius:4, overflow:"hidden" }}>
                <div style={{ width:`${detail.progressPct}%`, height:"100%", background:"var(--brand)", borderRadius:4, boxShadow:"0 0 10px var(--brand)", transition:"width 1s" }} />
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--text-muted)", marginTop:4 }}>
                <span>{detail.elapsedMin} min scurși</span>
                <span style={{ fontWeight:600 }}>{detail.progressPct}% din rută</span>
                <span>{detail.duration} min total</span>
              </div>
            </div>
          )}

          {/* SVG route map */}
          <div style={{ marginBottom:16 }}>
            <div className="section-title" style={{ marginBottom:8 }}>Traseul zborului</div>
            <RouteMapSVG
              dep={detail.departure.iata}
              arr={detail.arrival.iata}
              progress={detail.progressPct}
            />
          </div>

          {/* Info cards row */}
          <div className="flight-info-grid" style={{ marginBottom:14 }}>
            <div className="fig-dep" style={{ background:"var(--bg-body)", border:"1px solid var(--border-color)", borderRadius:"var(--radius-md)", padding:"12px", textAlign:"center" }}>
              <div style={{ fontSize:10, color:"var(--text-muted)", marginBottom:4 }}>Plecare</div>
              <div style={{ fontSize:18, fontWeight:800 }}>{detail.departure.iata}</div>
              <div style={{ fontSize:11, color:"var(--text-muted)" }}>{detail.departure.airport}</div>
              <div style={{ fontSize:13, fontWeight:700, marginTop:4 }}>{detail.departure.actual !== "—" ? detail.departure.actual : detail.departure.scheduled}</div>
              {detail.departure.gate !== "—" && (
                <div style={{ fontSize:11, color:"var(--brand)", marginTop:2 }}>Poartă {detail.departure.gate}</div>
              )}
            </div>
            <div className="fig-middle" style={{ background:"var(--bg-body)", border:"1px solid var(--border-color)", borderRadius:"var(--radius-md)", padding:"12px", textAlign:"center", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4 }}>
              <i className="ti ti-plane" style={{ fontSize:22, color:"var(--brand)" }} />
              {detail.duration ? (
                <div style={{ fontSize:12, fontWeight:600 }}>{Math.floor(detail.duration/60)}h {detail.duration%60}min</div>
              ) : null}
              <div style={{ fontSize:11, color:"var(--text-muted)" }}>{detail.airline}</div>
              {detail.departure.delayed && detail.departure.delayed > 0 ? (
                <div style={{ fontSize:11, color:"var(--warning)", fontWeight:600 }}>+{detail.departure.delayed}min întârziere</div>
              ) : null}
            </div>
            <div className="fig-arr" style={{ background:"var(--bg-body)", border:"1px solid var(--border-color)", borderRadius:"var(--radius-md)", padding:"12px", textAlign:"center" }}>
              <div style={{ fontSize:10, color:"var(--text-muted)", marginBottom:4 }}>Sosire</div>
              <div style={{ fontSize:18, fontWeight:800 }}>{detail.arrival.iata}</div>
              <div style={{ fontSize:11, color:"var(--text-muted)" }}>{detail.arrival.airport}</div>
              <div style={{ fontSize:13, fontWeight:700, marginTop:4 }}>{detail.arrival.estimated !== "—" ? detail.arrival.estimated : detail.arrival.scheduled}</div>
              {detail.arrival.baggage !== "—" && (
                <div style={{ fontSize:11, color:"var(--info)", marginTop:2 }}>Belt {detail.arrival.baggage}</div>
              )}
            </div>
          </div>

          <div style={{ fontSize:10, color:"var(--text-muted)", textAlign:"center" }}>
            Date live AirLabs · actualizat {new Date(detail.fetchedAt).toLocaleTimeString("ro", { hour:"2-digit", minute:"2-digit", second:"2-digit" })}
          </div>
        </>
      ) : !error && !loading && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"var(--text-muted)", gap:12 }}>
          <i className="ti ti-map-pin-off" style={{ fontSize:48, opacity:0.2 }} />
          <div style={{ fontSize:14 }}>Introdu codul IATA pentru a vedea traseul</div>
          <div style={{ fontSize:12, opacity:0.7 }}>ex: LH6381, W43653, RO708</div>
        </div>
      )}
    </div>
  );
}

/* ─── MyFlightRight ─── */
function MyFlightRight({ onLog, myFlight }: { onLog:(m:string,ok?:boolean)=>void; myFlight: MyFlightState }) {
  const { input, setInput, loading, detail, error, search } = myFlight;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search(input);
  };

  const status = detail ? (STATUS_META[detail.status] ?? { label: detail.status, color: "var(--text-muted)", icon: "ti-question-mark" }) : null;

  return (
    <>
      <div className="section-title">Zborul meu — Detalii</div>

      {/* Quick search */}
      <form onSubmit={handleSubmit} style={{ display:"flex", gap:6, marginBottom:12 }}>
        <input
          type="text"
          className="phone-input"
          placeholder="Cod IATA..."
          value={input}
          onChange={e => setInput(e.target.value)}
          style={{ flex:1, fontSize:12, padding:"7px 10px", textTransform:"uppercase" }}
        />
        <button type="submit" disabled={loading || !input.trim()}
          style={{ padding:"7px 10px", background:"var(--brand)", border:"none", borderRadius:"var(--radius-md)", color:"#fff", cursor:"pointer", fontSize:13 }}>
          <i className={`ti ti-${loading ? "loader-2 spin" : "search"}`} />
        </button>
      </form>

      {error && (
        <div style={{ fontSize:12, color:"var(--danger)", padding:"8px 10px", background:"var(--danger-bg)", border:"1px solid var(--danger)", borderRadius:"var(--radius-md)", marginBottom:10, display:"flex", gap:6 }}>
          <i className="ti ti-alert-circle" /> {error}
        </div>
      )}

      {detail && status && (
        <div className="fade-in">
          {/* Status */}
          <div style={{ padding:"10px 12px", borderRadius:"var(--radius-md)", background:`${status.color}18`, border:`1px solid ${status.color}44`, display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
            <i className={`ti ${status.icon}`} style={{ fontSize:18, color:status.color, flexShrink:0 }} />
            <div>
              <div style={{ fontWeight:700, fontSize:14, color:status.color }}>{status.label}</div>
              <div style={{ fontSize:11, color:"var(--text-muted)" }}>{detail.airline} · {detail.flight}</div>
            </div>
            {detail.departure.delayed && detail.departure.delayed > 0 ? (
              <div style={{ marginLeft:"auto", fontWeight:700, fontSize:12, color:"var(--warning)" }}>+{detail.departure.delayed}min</div>
            ) : null}
          </div>

          {/* Progress bar activ */}
          {detail.status === "active" && detail.progressPct !== null && (
            <div style={{ marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"var(--text-muted)", marginBottom:3 }}>
                <span>{detail.departure.iata}</span>
                <span style={{ color:"var(--brand)", fontWeight:600 }}>{detail.remainingMin} min rămași</span>
                <span>{detail.arrival.iata}</span>
              </div>
              <div style={{ height:5, background:"var(--bg-hover)", borderRadius:3, overflow:"hidden" }}>
                <div style={{ width:`${detail.progressPct}%`, height:"100%", background:"var(--brand)", borderRadius:3, boxShadow:"0 0 6px var(--brand)" }} />
              </div>
            </div>
          )}

          {/* DEP stats */}
          <div className="stats-list" style={{ marginBottom:10 }}>
            <div className="stat-item">
              <span className="stat-label"><i className="ti ti-plane-departure" style={{ marginRight:3 }} />Plecare</span>
              <span className="stat-value" style={{ fontWeight:700 }}>{detail.departure.iata}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Programat</span>
              <span className="stat-value">{detail.departure.scheduled}</span>
            </div>
            {detail.departure.actual !== "—" && (
              <div className="stat-item">
                <span className="stat-label">Actual</span>
                <span className="stat-value" style={{ color:"var(--success)" }}>{detail.departure.actual}</span>
              </div>
            )}
            {detail.departure.gate !== "—" && (
              <div className="stat-item">
                <span className="stat-label">Poartă</span>
                <span className="stat-value" style={{ color:"var(--brand)", fontWeight:700 }}>{detail.departure.gate}</span>
              </div>
            )}
            {detail.departure.terminal !== "—" && (
              <div className="stat-item">
                <span className="stat-label">Terminal</span>
                <span className="stat-value">{detail.departure.terminal}</span>
              </div>
            )}
          </div>

          {/* ARR stats */}
          <div className="stats-list" style={{ marginBottom:10 }}>
            <div className="stat-item">
              <span className="stat-label"><i className="ti ti-plane-arrival" style={{ marginRight:3 }} />Sosire</span>
              <span className="stat-value" style={{ fontWeight:700 }}>{detail.arrival.iata}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Programat</span>
              <span className="stat-value">{detail.arrival.scheduled}</span>
            </div>
            {detail.arrival.estimated !== "—" && detail.arrival.estimated !== detail.arrival.scheduled && (
              <div className="stat-item">
                <span className="stat-label">Estimat</span>
                <span className="stat-value" style={{ color:"var(--warning)" }}>{detail.arrival.estimated}</span>
              </div>
            )}
            {detail.arrival.delayed && detail.arrival.delayed > 0 ? (
              <div className="stat-item">
                <span className="stat-label">Întârziere</span>
                <span className="stat-value" style={{ color:"var(--warning)" }}>+{detail.arrival.delayed} min</span>
              </div>
            ) : null}
            {detail.arrival.terminal !== "—" && (
              <div className="stat-item">
                <span className="stat-label">Terminal</span>
                <span className="stat-value">{detail.arrival.terminal}</span>
              </div>
            )}
            {detail.arrival.baggage !== "—" && (
              <div className="stat-item">
                <span className="stat-label">Bagaje</span>
                <span className="stat-value" style={{ color:"var(--info)" }}>Belt {detail.arrival.baggage}</span>
              </div>
            )}
          </div>

          {/* Duration */}
          {detail.duration ? (
            <div className="stats-list">
              <div className="stat-item">
                <span className="stat-label">Durată</span>
                <span className="stat-value">{Math.floor(detail.duration/60)}h {detail.duration%60}min</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Companie</span>
                <span className="stat-value">{detail.airline}</span>
              </div>
            </div>
          ) : null}

          <div style={{ fontSize:10, color:"var(--text-muted)", textAlign:"center", marginTop:10 }}>
            Live AirLabs · {new Date(detail.fetchedAt).toLocaleTimeString("ro", { hour:"2-digit", minute:"2-digit", second:"2-digit" })}
          </div>
        </div>
      )}

      {!detail && !error && !loading && (
        <div style={{ textAlign:"center", padding:"16px 0", color:"var(--text-muted)" }}>
          <i className="ti ti-ticket" style={{ fontSize:28, display:"block", marginBottom:8, opacity:0.25 }} />
          <div style={{ fontSize:12 }}>Introdu codul de pe bilet</div>
        </div>
      )}

      <div style={{ borderTop:"1px solid var(--border-color)", margin:"16px 0" }} />
    </>
  );
}

/* ═══════════════════════════ LOGIN MODAL ═══════════════════════════ */
function LoginModal({ onLogin }: { onLogin: (a: AuthState) => void }) {
  const [tab, setTab] = useState<"admin" | "passenger">("passenger");
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [phone, setPhone] = useState("");
  const [iata, setIata] = useState("");
  const [error, setError] = useState("");

  const submitAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminUser === ADMIN_USERNAME && adminPass === ADMIN_PASSWORD) {
      onLogin({ role: "admin", personId: "you", displayName: "Admin" });
    } else {
      setError("Utilizator sau parolă incorectă.");
    }
  };

  const submitPassenger = (e: React.FormEvent) => {
    e.preventDefault();
    const client = findClient(phone, iata);
    if (client) {
      onLogin({ role: "passenger", personId: client.personId, displayName: client.displayName, flightIata: client.flightIata });
    } else {
      setError("Număr de telefon sau zbor IATA incorect.");
    }
  };

  return (
    <div className="login-overlay">
      <div className="login-modal fade-in">
        <div className="login-brand">
          <div className="brand-icon"><i className="ti ti-wifi" /></div>
          <div>
            <div className="brand-title">AirFlow Nexus</div>
            <div className="brand-sub">powered by Orange APIs</div>
          </div>
        </div>

        <div className="login-tabs">
          <button
            className={`login-tab${tab === "passenger" ? " active" : ""}`}
            onClick={() => { setTab("passenger"); setError(""); }}
          >
            <i className="ti ti-user" /> Pasager
          </button>
          <button
            className={`login-tab${tab === "admin" ? " active" : ""}`}
            onClick={() => { setTab("admin"); setError(""); }}
          >
            <i className="ti ti-shield-half" /> Personal
          </button>
        </div>

        {tab === "passenger" && (
          <form onSubmit={submitPassenger} className="login-form">
            <div className="login-field">
              <label>Număr de telefon</label>
              <input
                type="tel"
                className="phone-input"
                placeholder="+40721000001"
                value={phone}
                onChange={e => { setPhone(e.target.value); setError(""); }}
                autoFocus
              />
            </div>
            <div className="login-field">
              <label>Cod zbor (IATA)</label>
              <input
                type="text"
                className="phone-input"
                placeholder="RO321"
                value={iata}
                onChange={e => { setIata(e.target.value); setError(""); }}
              />
            </div>
            {error && <div className="login-error">{error}</div>}
            <button type="submit" className="btn-primary login-submit">
              <i className="ti ti-login" /> Intră
            </button>
            <div className="login-hint">
              <i className="ti ti-info-circle" />
              Demo: +40721000001 / RO321
            </div>
          </form>
        )}

        {tab === "admin" && (
          <form onSubmit={submitAdmin} className="login-form">
            <div className="login-field">
              <label>Utilizator</label>
              <input
                type="text"
                className="phone-input"
                placeholder="admin"
                value={adminUser}
                onChange={e => { setAdminUser(e.target.value); setError(""); }}
                autoFocus
                autoComplete="username"
              />
            </div>
            <div className="login-field">
              <label>Parolă</label>
              <input
                type="password"
                className="phone-input"
                placeholder="••••••"
                value={adminPass}
                onChange={e => { setAdminPass(e.target.value); setError(""); }}
                autoComplete="current-password"
              />
            </div>
            {error && <div className="login-error">{error}</div>}
            <button type="submit" className="btn-primary login-submit">
              <i className="ti ti-login" /> Autentificare
            </button>
            <div className="login-hint">
              <i className="ti ti-info-circle" />
              Demo: admin / admin
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════ MY FLIGHT MODAL ═══════════════════════════ */
interface FlightDetail {
  flight: string;
  flightNumber: string;
  airline: string;
  airlineIata: string;
  status: string;
  departure: {
    iata: string; airport: string; terminal: string; gate: string;
    scheduled: string; estimated: string; actual: string; delayed: number | null;
  };
  arrival: {
    iata: string; airport: string; terminal: string; gate: string;
    baggage: string; scheduled: string; estimated: string; delayed: number | null;
  };
  duration: number | null;
  elapsedMin: number | null;
  remainingMin: number | null;
  progressPct: number | null;
  fetchedAt: string;
}

const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  scheduled: { label: "Programat",   color: "var(--info)",    icon: "ti-clock"          },
  active:    { label: "În zbor",     color: "var(--brand)",   icon: "ti-plane"          },
  landed:    { label: "Aterizat",    color: "var(--success)", icon: "ti-plane-arrival"  },
  cancelled: { label: "Anulat",      color: "var(--danger)",  icon: "ti-ban"            },
  incident:  { label: "Incident",    color: "var(--danger)",  icon: "ti-alert-triangle" },
  diverted:  { label: "Deviat",      color: "var(--warning)", icon: "ti-route-off"      },
};

function MyFlightModal({ onClose }: { onClose: () => void }) {
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const [detail, setDetail]   = useState<FlightDetail | null>(null);
  const [error, setError]     = useState("");

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = input.trim().toUpperCase().replace(/\s/g, "");
    if (!code) return;
    setLoading(true);
    setError("");
    setDetail(null);
    try {
      const r = await fetch(`/api/flight-details?flight=${encodeURIComponent(code)}`);
      const d = await r.json();
      if (d.error) { setError(d.error); }
      else { setDetail(d); }
    } catch {
      setError("Eroare de rețea. Încearcă din nou.");
    } finally { setLoading(false); }
  };

  const status = detail ? (STATUS_META[detail.status] ?? { label: detail.status, color: "var(--text-muted)", icon: "ti-question-mark" }) : null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position:"fixed", inset:0, zIndex:500,
        background:"rgba(0,0,0,0.65)", backdropFilter:"blur(4px)",
        display:"flex", alignItems:"center", justifyContent:"center",
        padding:"16px",
      }}
    >
      <div
        className="fade-in"
        style={{
          background:"var(--bg-card)", border:"1px solid var(--border-color)",
          borderRadius:"var(--radius-lg, 14px)", padding:"28px 24px",
          width:"100%", maxWidth:460, maxHeight:"90vh", overflowY:"auto",
          boxShadow:"0 24px 64px rgba(0,0,0,0.5)",
          position:"relative",
        }}
      >
        {/* ── Header ── */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div className="brand-icon" style={{ width:32, height:32, fontSize:16 }}>
              <i className="ti ti-plane-departure" />
            </div>
            <div>
              <div style={{ fontWeight:700, fontSize:16 }}>Zborul meu</div>
              <div style={{ fontSize:11, color:"var(--text-muted)" }}>Detalii live · AirLabs</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background:"transparent", border:"none", color:"var(--text-muted)", cursor:"pointer", fontSize:20, lineHeight:1, padding:"2px 6px" }}
          >
            <i className="ti ti-x" />
          </button>
        </div>

        {/* ── Search form ── */}
        <form onSubmit={search} style={{ display:"flex", gap:8, marginBottom:20 }}>
          <input
            type="text"
            className="phone-input"
            placeholder="ex: LH6381, RO708, W43653"
            value={input}
            onChange={e => { setInput(e.target.value); setError(""); }}
            style={{ flex:1, textTransform:"uppercase" }}
            autoFocus
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="btn-primary"
            style={{ padding:"9px 16px", display:"flex", alignItems:"center", gap:6, whiteSpace:"nowrap" }}
          >
            <i className={`ti ti-${loading ? "loader-2 spin" : "search"}`} />
            {loading ? "" : "Caută"}
          </button>
        </form>

        {/* ── Error ── */}
        {error && (
          <div style={{ padding:"10px 14px", borderRadius:"var(--radius-md)", background:"var(--danger-bg)", border:"1px solid var(--danger)", color:"var(--danger)", fontSize:13, marginBottom:16, display:"flex", alignItems:"center", gap:8 }}>
            <i className="ti ti-alert-circle" /> {error}
          </div>
        )}

        {/* ── Flight detail card ── */}
        {detail && status && (
          <div className="fade-in">
            {/* Status banner */}
            <div style={{
              padding:"10px 16px", borderRadius:"var(--radius-md)",
              background:`${status.color}18`, border:`1px solid ${status.color}44`,
              display:"flex", alignItems:"center", gap:12, marginBottom:16,
            }}>
              <i className={`ti ${status.icon}`} style={{ fontSize:22, color:status.color }} />
              <div>
                <div style={{ fontWeight:700, fontSize:17, color:status.color }}>{status.label}</div>
                <div style={{ fontSize:12, color:"var(--text-muted)" }}>
                  {detail.airline} · {detail.flight}
                </div>
              </div>
              {detail.departure.delayed && detail.departure.delayed > 0 ? (
                <div style={{ marginLeft:"auto", fontWeight:700, fontSize:13, color:"var(--warning)" }}>
                  +{detail.departure.delayed} min
                </div>
              ) : null}
            </div>

            {/* Progress bar — zbor activ */}
            {detail.status === "active" && detail.progressPct !== null && (
              <div style={{ marginBottom:16 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--text-muted)", marginBottom:4 }}>
                  <span><i className="ti ti-plane-departure" /> {detail.departure.iata}</span>
                  <span style={{ color:"var(--brand)", fontWeight:600 }}>
                    {detail.remainingMin !== null ? `${detail.remainingMin} min rămași` : ""}
                  </span>
                  <span><i className="ti ti-plane-arrival" /> {detail.arrival.iata}</span>
                </div>
                <div style={{ height:6, background:"var(--bg-hover)", borderRadius:3, overflow:"hidden" }}>
                  <div style={{
                    width:`${detail.progressPct}%`, height:"100%",
                    background:"var(--brand)", borderRadius:3,
                    boxShadow:"0 0 8px var(--brand)",
                  }} />
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--text-muted)", marginTop:3 }}>
                  <span>{detail.elapsedMin} min scurși</span>
                  <span>{detail.progressPct}%</span>
                  <span>{detail.duration} min total</span>
                </div>
              </div>
            )}

            {/* DEP / ARR cards */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
              {/* Departure */}
              <div style={{ background:"var(--bg-body)", border:"1px solid var(--border-color)", borderRadius:"var(--radius-md)", padding:"14px" }}>
                <div style={{ fontSize:10, color:"var(--text-muted)", marginBottom:6, letterSpacing:"0.5px", textTransform:"uppercase" }}>
                  <i className="ti ti-plane-departure" /> Plecare
                </div>
                <div style={{ fontSize:22, fontWeight:800, letterSpacing:1 }}>{detail.departure.iata}</div>
                <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:8 }}>{detail.departure.airport}</div>
                <div style={{ fontSize:11, display:"flex", flexDirection:"column", gap:4 }}>
                  <div style={{ display:"flex", justifyContent:"space-between" }}>
                    <span style={{ color:"var(--text-muted)" }}>Programat</span>
                    <span style={{ fontWeight:600 }}>{detail.departure.scheduled}</span>
                  </div>
                  {detail.departure.estimated !== "—" && detail.departure.estimated !== detail.departure.scheduled && (
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <span style={{ color:"var(--text-muted)" }}>Estimat</span>
                      <span style={{ fontWeight:600, color:"var(--warning)" }}>{detail.departure.estimated}</span>
                    </div>
                  )}
                  {detail.departure.actual !== "—" && (
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <span style={{ color:"var(--text-muted)" }}>Actual</span>
                      <span style={{ fontWeight:600, color:"var(--success)" }}>{detail.departure.actual}</span>
                    </div>
                  )}
                  <div style={{ display:"flex", justifyContent:"space-between", marginTop:4, paddingTop:4, borderTop:"1px solid var(--border-color)" }}>
                    <span style={{ color:"var(--text-muted)" }}>Terminal</span>
                    <span style={{ fontWeight:600 }}>{detail.departure.terminal}</span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between" }}>
                    <span style={{ color:"var(--text-muted)" }}>Poartă</span>
                    <span style={{ fontWeight:600, color:"var(--brand)" }}>{detail.departure.gate}</span>
                  </div>
                </div>
              </div>

              {/* Arrival */}
              <div style={{ background:"var(--bg-body)", border:"1px solid var(--border-color)", borderRadius:"var(--radius-md)", padding:"14px" }}>
                <div style={{ fontSize:10, color:"var(--text-muted)", marginBottom:6, letterSpacing:"0.5px", textTransform:"uppercase" }}>
                  <i className="ti ti-plane-arrival" /> Sosire
                </div>
                <div style={{ fontSize:22, fontWeight:800, letterSpacing:1 }}>{detail.arrival.iata}</div>
                <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:8 }}>{detail.arrival.airport}</div>
                <div style={{ fontSize:11, display:"flex", flexDirection:"column", gap:4 }}>
                  <div style={{ display:"flex", justifyContent:"space-between" }}>
                    <span style={{ color:"var(--text-muted)" }}>Programat</span>
                    <span style={{ fontWeight:600 }}>{detail.arrival.scheduled}</span>
                  </div>
                  {detail.arrival.estimated !== "—" && detail.arrival.estimated !== detail.arrival.scheduled && (
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <span style={{ color:"var(--text-muted)" }}>Estimat</span>
                      <span style={{ fontWeight:600, color:"var(--warning)" }}>{detail.arrival.estimated}</span>
                    </div>
                  )}
                  {detail.arrival.delayed && detail.arrival.delayed > 0 ? (
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <span style={{ color:"var(--text-muted)" }}>Întârziere</span>
                      <span style={{ fontWeight:600, color:"var(--warning)" }}>+{detail.arrival.delayed} min</span>
                    </div>
                  ) : null}
                  <div style={{ display:"flex", justifyContent:"space-between", marginTop:4, paddingTop:4, borderTop:"1px solid var(--border-color)" }}>
                    <span style={{ color:"var(--text-muted)" }}>Terminal</span>
                    <span style={{ fontWeight:600 }}>{detail.arrival.terminal}</span>
                  </div>
                  {detail.arrival.baggage !== "—" && (
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <span style={{ color:"var(--text-muted)" }}>Bagaje</span>
                      <span style={{ fontWeight:600, color:"var(--info)" }}>Belt {detail.arrival.baggage}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Extra info */}
            <div style={{ display:"flex", gap:8, marginBottom:10 }}>
              {detail.duration ? (
                <div style={{ flex:1, background:"var(--bg-body)", border:"1px solid var(--border-color)", borderRadius:"var(--radius-md)", padding:"10px 12px", textAlign:"center" }}>
                  <div style={{ fontSize:10, color:"var(--text-muted)", marginBottom:3 }}>Durată zbor</div>
                  <div style={{ fontWeight:700, fontSize:14 }}>
                    {Math.floor(detail.duration / 60)}h {detail.duration % 60}min
                  </div>
                </div>
              ) : null}
              <div style={{ flex:1, background:"var(--bg-body)", border:"1px solid var(--border-color)", borderRadius:"var(--radius-md)", padding:"10px 12px", textAlign:"center" }}>
                <div style={{ fontSize:10, color:"var(--text-muted)", marginBottom:3 }}>Companie</div>
                <div style={{ fontWeight:700, fontSize:13 }}>{detail.airline}</div>
              </div>
            </div>

            <div style={{ fontSize:10, color:"var(--text-muted)", textAlign:"center", marginTop:8 }}>
              Date live de la AirLabs · {new Date(detail.fetchedAt).toLocaleTimeString("ro", { hour:"2-digit", minute:"2-digit", second:"2-digit" })}
            </div>
          </div>
        )}

        {/* Hint când nu s-a căutat nimic */}
        {!detail && !error && !loading && (
          <div style={{ textAlign:"center", padding:"20px 0", color:"var(--text-muted)" }}>
            <i className="ti ti-ticket" style={{ fontSize:36, display:"block", marginBottom:10, opacity:0.3 }} />
            <div style={{ fontSize:13 }}>Introdu codul IATA de pe biletul tău</div>
            <div style={{ fontSize:11, marginTop:4, opacity:0.7 }}>ex: LH6381, W43653, RO708</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════ TOP BAR ═══════════════════════════ */
function TopBar({
  auth, theme, setTheme, drawerOpen, setDrawerOpen, onLogout,
}: {
  auth: AuthState;
  theme: "dark" | "light"; setTheme: (t: "dark" | "light") => void;
  drawerOpen: boolean; setDrawerOpen: (v: boolean) => void;
  onLogout: () => void;
}) {
  return (
    <>
      <div className="top-bar">
        <button
          className="hamburger-float top-bar-hamburger"
          onClick={() => setDrawerOpen(!drawerOpen)}
          title="Meniu"
        >
          <i className="ti ti-menu-2" />
        </button>

        <div className="top-bar-brand">
          <div className="brand-icon" style={{ width:28, height:28, fontSize:14 }}>
            <i className="ti ti-wifi" />
          </div>
          <span className="brand-title" style={{ fontSize:14 }}>AirFlow Nexus</span>
        </div>

        <div style={{ flex:1 }} />

        <span className={`role-badge ${auth.role}`}>
          {auth.role === "admin" ? (
            <><i className="ti ti-shield-half" /> Admin</>
          ) : (
            <><i className="ti ti-user" /> Pasager</>
          )}
        </span>

        <span style={{ fontSize:12, color:"var(--text-muted)", maxWidth:120, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {auth.displayName}
        </span>

        <button
          className="btn-theme-toggle"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title="Schimbă tema"
        >
          <i className={`ti ${theme === "dark" ? "ti-sun" : "ti-moon"}`} />
        </button>

        <button className="btn-theme-toggle" onClick={onLogout} title="Deconectare">
          <i className="ti ti-logout" />
        </button>
      </div>
    </>
  );
}

/* ═══════════════════════════ BOTTOM BAR ═══════════════════════════ */
const PHONE_HISTORY_KEY = "airhack_phone_history";

function loadPhoneHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(PHONE_HISTORY_KEY) ?? "[]"); }
  catch { return []; }
}
function savePhoneHistory(num: string) {
  const prev = loadPhoneHistory().filter(n => n !== num);
  localStorage.setItem(PHONE_HISTORY_KEY, JSON.stringify([num, ...prev].slice(0, 10)));
}

function BottomBar({ activePerson, setActivePerson }: {
  activePerson: string; setActivePerson: (id:string)=>void;
}) {
  const [phone, setPhone] = useState("");
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => { setHistory(loadPhoneHistory()); }, []);

  const handlePhone = (val: string) => {
    setPhone(val);
    const match = PHONE_PERSONS[val.trim()];
    if (match) {
      setActivePerson(match);
      savePhoneHistory(val.trim());
      setHistory(loadPhoneHistory());
    }
  };

  const person = PEOPLE.find(p => p.id === activePerson && p.id !== "you");
  const flight = person ? FLIGHTS.find(f => f.id === person.flightId) : null;
  const isAdmin = activePerson === "you";

  return (
    <div className="bottom-bar">
      {/* Admin button */}
      <button
        className={`btn-tab${isAdmin ? " active" : ""}`}
        onClick={() => { setActivePerson("you"); setPhone(""); }}
        style={{ flex:"0 0 auto", gap:6, color: isAdmin ? "var(--brand)" : undefined, borderColor: isAdmin ? "var(--brand)" : undefined }}
      >
        <i className="ti ti-shield-half" style={{ fontSize:17 }}/>
        <span>Admin</span>
      </button>

      {/* Phone input + matched passenger info */}
      <div style={{ flex:1, display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
        <div style={{ flex:1, position:"relative", minWidth:0 }}>
          {/* datalist for autocomplete from history */}
          <datalist id="phone-history">
            {history.map(n => <option key={n} value={n} />)}
          </datalist>
          <input
            type="tel"
            list="phone-history"
            className="phone-input"
            placeholder="Introdu numărul de telefon"
            value={phone}
            onChange={e => handlePhone(e.target.value)}
          />
        </div>
        {person && flight && (
          <div className="fade-in" style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
            <span style={{ width:8, height:8, borderRadius:"50%", background:person.color, flexShrink:0 }}/>
            <span style={{ fontSize:12, fontWeight:600, color:person.color, whiteSpace:"nowrap" }}>
              {flight.flight} · {GATE_LABELS[flight.gate]}
            </span>
            <span style={{ fontSize:11, color:"var(--text-muted)", whiteSpace:"nowrap" }}>
              {flight.departs}
            </span>
          </div>
        )}
        {!person && !isAdmin && phone.length > 4 && (
          <span style={{ fontSize:12, color:"var(--text-muted)", whiteSpace:"nowrap" }}>
            Număr nerecunoscut
          </span>
        )}
      </div>
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
      <h2><i className="ti ti-presentation"/> Anunțuri Aeroport</h2>
      {announcements.length === 0 && <p style={{ color:"var(--text-muted)", marginTop:20 }}>Niciun anunț activ.</p>}
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

function StatusApiCenter() {
  const apis = [
    { name:"Device Location",      endpoint:"camara/location-retrieval/v0.3",       status:"UP", latency:"142ms", calls:1240 },
    { name:"Population Density",   endpoint:"camara/population-density-data/v0.2",  status:"UP", latency:"89ms",  calls:432  },
    { name:"Number Verification",  endpoint:"camara/number-verification/v1",         status:"UP", latency:"201ms", calls:87   },
    { name:"SIM Swap",             endpoint:"camara/sim-swap/v1",                    status:"UP", latency:"178ms", calls:23   },
  ];
  return (
    <div style={{ padding:20 }}>
      <h2><i className="ti ti-server"/> Status API Orange</h2>
      <div style={{ display:"flex", flexDirection:"column", gap:10, marginTop:20 }}>
        {apis.map(a => (
          <div key={a.name} style={{ padding:"12px 16px", background:"var(--bg-body)", border:"1px solid var(--border-color)", borderRadius:"var(--radius-md)", display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ width:8, height:8, borderRadius:"50%", background:"var(--success)", flexShrink:0 }}/>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:600, fontSize:13 }}>{a.name}</div>
              <div style={{ fontSize:11, color:"var(--text-muted)" }}>{a.endpoint}</div>
            </div>
            <div style={{ textAlign:"right", fontSize:12 }}>
              <div style={{ color:"var(--success)", fontWeight:600 }}>{a.status}</div>
              <div style={{ color:"var(--text-muted)" }}>{a.latency} · {a.calls.toLocaleString()} req</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const PERSON_PROFILES: Record<string, { role:string; flight:string; gate:string; boarding:string }> = {
  you:    { role:"Admin Aeroport", flight:"—",       gate:"—",  boarding:"—"     },
  misu:   { role:"Pasager",        flight:"W6 4102", gate:"G2", boarding:"23:45" },
  ionica: { role:"Pasager",        flight:"LH 1407", gate:"T3", boarding:"00:10" },
  dorel:  { role:"Pasager",        flight:"FR 8821", gate:"G5", boarding:"00:30" },
};

function AccountCenter({ activePerson }: { activePerson:string }) {
  const person = PEOPLE.find(p => p.id === activePerson)!;
  const profile = PERSON_PROFILES[activePerson];
  return (
    <div style={{ padding:20 }}>
      <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:24 }}>
        <div style={{ width:56, height:56, borderRadius:"50%", background:`${person.color}22`, border:`2px solid ${person.color}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, color:person.color }}>
          <i className="ti ti-user"/>
        </div>
        <div>
          <div style={{ fontSize:20, fontWeight:700 }}>{person.name}</div>
          <div style={{ fontSize:13, color:"var(--text-muted)" }}>{profile.role}</div>
        </div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {([
          ["Zbor", profile.flight],
          ["Poartă", profile.gate],
          ["Îmbarcare", profile.boarding],
          ["Status", activePerson==="you" ? "🟢 Admin activ" : "🟢 Check-in finalizat"],
        ] as [string,string][]).map(([l,v]) => (
          <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"10px 14px", background:"var(--bg-body)", border:"1px solid var(--border-color)", borderRadius:"var(--radius-md)" }}>
            <span style={{ color:"var(--text-muted)", fontSize:13 }}>{l}</span>
            <span style={{ fontWeight:600, fontSize:13 }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsCenter() {
  return (
    <div style={{ padding:20 }}>
      <h2><i className="ti ti-settings"/> Setări</h2>
      <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:20 }}>
        {([
          ["Interval refresh date", "30 secunde"],
          ["Mod fixture (mock data)", "Activ"],
          ["Limbă interfață", "Română"],
          ["Versiune aplicație", "1.0.0 · AirHack 2026"],
        ] as [string,string][]).map(([l,v]) => (
          <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"10px 14px", background:"var(--bg-body)", border:"1px solid var(--border-color)", borderRadius:"var(--radius-md)" }}>
            <span style={{ color:"var(--text-muted)", fontSize:13 }}>{l}</span>
            <span style={{ fontWeight:600, fontSize:13 }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

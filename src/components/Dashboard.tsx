import { useState, useEffect, useRef } from "react";
import { LOCATIONS, IMG_W, IMG_H } from "../lib/geo-transform";
import type { WeatherProvider } from "../lib/weather";
import { findClient, ADMIN_USERNAME, ADMIN_PASSWORD } from "../lib/mock-auth";
import TrafficFlowCenter from "./TrafficFlowCenter";

type Feature = "weather" | "route" | "heatmap" | "admin" | "announcements" | "account" | "settings" | "my-flight" | "video-flow" | "weather-pass";

export interface Announcement {
  id: number; type: "info" | "warning" | "danger"; text: string; time: string; sender?: string;
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

const FLIGHTS = FLIGHTS_FALLBACK;

// Waypoints in percentage space relative to IMG_W x IMG_H
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
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [seenCount, setSeenCount] = useState(0);
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [heatmapSelected, setHeatmapSelected] = useState<string | null>(null);

  // Shared flight state — o singură instanță, partajată între Center și Right
  const myFlight = useMyFlightState();

  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); }, [theme]);

  // SSE: subscribe to real-time announcements once logged in
  useEffect(() => {
    if (!auth) return;
    const es = new EventSource("/api/notifications");
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.__deleted) {
          setAnnouncements(prev => prev.filter(a => a.id !== data.__deleted));
        } else {
          const a = data as Announcement;
          setAnnouncements(prev => prev.some(p => p.id === a.id) ? prev : [a, ...prev]);
        }
      } catch { /* ignore malformed frames */ }
    };
    return () => es.close();
  }, [auth]);

  // Mark all as read whenever the notification panel is open
  useEffect(() => {
    if (notifOpen) setSeenCount(announcements.length);
  }, [notifOpen, announcements.length]);

  const addLog = (msg: string, ok = true) =>
    setLogs(p => [{ ts: new Date().toLocaleTimeString("ro"), msg, ok }, ...p].slice(0, 30));

  const handleLogin = (a: AuthState) => {
    setAuth(a);
    if (a.role === "admin") { setFeature("weather"); }
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
          drawerOpen={drawerOpen}
          setDrawerOpen={setDrawerOpen}
          notifOpen={notifOpen}
          setNotifOpen={setNotifOpen}
          unreadCount={Math.max(0, announcements.length - seenCount)}
          onLogout={() => { setAuth(null); setDrawerOpen(false); setNotifOpen(false); setSeenCount(0); setAnnouncements([]); }}
        />
      )}
      {auth && (
        <NotifPanel
          open={notifOpen}
          onClose={() => setNotifOpen(false)}
          role={auth.role}
          announcements={announcements}
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
        <CenterPanel feature={feature} onLog={addLog} weatherProvider={weatherProvider} activePerson={activePerson} announcements={announcements} role={auth?.role ?? null} myFlight={myFlight} heatmapSelected={heatmapSelected} setHeatmapSelected={setHeatmapSelected} />
        <RightPanel feature={feature} onLog={addLog} weatherProvider={weatherProvider} setWeatherProvider={setWeatherProvider} myFlight={myFlight} heatmapSelected={heatmapSelected} />
      </div>
      {!auth && <BottomBar activePerson={activePerson} setActivePerson={setActivePerson} />}
    </div>
  );
}

/* ═══════════════════════════ LEFT PANEL ═══════════════════════════ */
const PASSENGER_NAV: { id: Feature; icon: string; label: string; sub: string }[] = [
  { id: "route",         icon: "ti-map-pin",         label: "My Location",    sub: "Device Location · Orange"       },
  { id: "my-flight",     icon: "ti-plane-departure", label: "My Flight",      sub: "Live · AirLabs"                 },
  { id: "weather-pass",  icon: "ti-cloud-sun",       label: "Weather",        sub: "Departure & Arrival airports"   },
  { id: "announcements", icon: "ti-bell",            label: "Anunțuri",       sub: "De la personalul aeroportului"  },
];
const ADMIN_NAV: { id: Feature; icon: string; label: string; sub: string }[] = [
  { id: "weather",       icon: "ti-cloud-storm",    label: "Vreme LRIA",        sub: "METAR · Open-Meteo · NOAA"  },
  { id: "heatmap",       icon: "ti-map-2",          label: "Heatmap",           sub: "Aglomerație zone terminal"   },
  { id: "video-flow",    icon: "ti-video",          label: "CV Dispatcher",     sub: "CV + AI · IAS"              },
  { id: "admin",         icon: "ti-megaphone",      label: "Anunțuri Pasageri", sub: "Trimite notificări"         },
  { id: "settings",      icon: "ti-settings",       label: "Settings",          sub: "About · API Status"         },
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
  const visibleNav = isPassenger ? PASSENGER_NAV : ADMIN_NAV;

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
          <button
            className="btn-tab"
            style={{ justifyContent:"flex-start", flex:"unset", padding:"10px 12px" }}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <i className={`ti ${theme === "dark" ? "ti-sun" : "ti-moon"}`} style={{ fontSize:17 }} />
            Theme
          </button>
        </div>

        {logs.length > 0 && !isPassenger && (
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
          <div
            className="api-card"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            style={{ cursor:"pointer" }}
          >
            <div className="api-card-header">
              <i className={`ti ${theme === "dark" ? "ti-sun" : "ti-moon"}`} /> Theme
            </div>
            <div className="api-val">{theme === "dark" ? "Dark mode" : "Light mode"}</div>
          </div>
        </div>

      </div>
    </>
  );
}

/* ═══════════════════════════ CENTER PANEL ═══════════════════════════ */
function CenterPanel({
  feature, onLog, weatherProvider, activePerson, announcements, role, myFlight, heatmapSelected, setHeatmapSelected,
}: {
  feature: Feature; onLog: (m: string, ok?: boolean) => void; weatherProvider: WeatherProvider;
  activePerson: string; announcements: Announcement[];
  role: "admin" | "passenger" | null;
  myFlight: MyFlightState;
  heatmapSelected: string | null; setHeatmapSelected: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const isPassenger = role === "passenger";
  return (
    <div className="card main-center">
      {feature === "weather"      && !isPassenger && <WeatherCenter onLog={onLog} provider={weatherProvider} />}
      {feature === "route"         && <RouteCenter onLog={onLog} activePerson={activePerson} />}
      {feature === "heatmap"       && !isPassenger && <HeatmapCenter onLog={onLog} selected={heatmapSelected} setSelected={setHeatmapSelected} />}
      {feature === "video-flow"    && !isPassenger && <TrafficFlowCenter onLog={onLog} />}
      {feature === "admin"         && !isPassenger && <AdminCenter onLog={onLog} />}
      {feature === "announcements" && <AnnouncementsCenter announcements={announcements} />}
      {feature === "my-flight"     && <MyFlightCenter onLog={onLog} myFlight={myFlight} />}
      {feature === "weather-pass"  && <PassengerWeatherCenter myFlight={myFlight} />}
      {feature === "account"       && <AccountCenter activePerson={activePerson} />}
      {feature === "settings"      && <SettingsCenter />}
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
const CAL_KEY = "svg_cal_v7";
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

// GPS → SVG: solved directly via least-squares on the calibration points (numerically
// stable — GPS coords are first converted to metre offsets from the centroid).
const LAT_SCALE = 111320;
const LNG_SCALE = 111320 * Math.cos(47.174 * Math.PI / 180);

interface InvTransform { a:number; b:number; c:number; d:number; e:number; f:number; latMid:number; lngMid:number }

function solveInverse(pts: CalPoint[]): InvTransform | null {
  if (pts.length < 3) return null;
  const latMid = pts.reduce((s,p) => s+p.lat, 0) / pts.length;
  const lngMid = pts.reduce((s,p) => s+p.lng, 0) / pts.length;
  // Normalise GPS to metres
  const scaled = pts.map(p => ({ u: (p.lat-latMid)*LAT_SCALE, v: (p.lng-lngMid)*LNG_SCALE, sx: p.svgX, sy: p.svgY }));
  function fit(getZ: (p: typeof scaled[0]) => number): [number,number,number] {
    let s20=0,s11=0,s10=0,s02=0,s01=0,n=0,sz1=0,sz2=0,sz0=0;
    for (const p of scaled) {
      s20+=p.u**2; s11+=p.u*p.v; s10+=p.u; s02+=p.v**2; s01+=p.v; n++;
      const z=getZ(p); sz1+=z*p.u; sz2+=z*p.v; sz0+=z;
    }
    const M=[[s20,s11,s10],[s11,s02,s01],[s10,s01,n]];
    const b=[sz1,sz2,sz0];
    const det=(m:number[][])=>m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
    const D=det(M);
    if (Math.abs(D)<1e-15) return [0,0,0];
    return [0,1,2].map(i=>{ const N=M.map(r=>[...r]); for(let r=0;r<3;r++) N[r][i]=b[r]; return det(N)/D; }) as [number,number,number];
  }
  const [a,b,c]=fit(p=>p.sx);
  const [d,e,f]=fit(p=>p.sy);
  return {a,b,c,d,e,f,latMid,lngMid};
}

function svgFromGps(_t: CalTransform, lat: number, lng: number, inv: InvTransform): {x:number;y:number} {
  const u = (lat - inv.latMid) * LAT_SCALE;
  const v = (lng - inv.lngMid) * LNG_SCALE;
  return { x: inv.a*u + inv.b*v + inv.c, y: inv.d*u + inv.e*v + inv.f };
}

const defaultPoints: CalPoint[] = [
  { svgX: 0,   svgY: 2262, lat: 47.174029,   lng: 27.619728   }, // colt stanga-sus portret — masurat
  { svgX: 587, svgY: 0,    lat: 47.174602,   lng: 27.619221   }, // colt dreapta-jos portret — masurat
  { svgX: 76,  svgY: 2220, lat: 47.1743459,  lng: 27.6194596  }, // masa echipei — masurat
];

function loadCalibration(): { points: CalPoint[]; transform: CalTransform | null; inverse: InvTransform | null } {
  try {
    const raw = localStorage.getItem(CAL_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.points?.length >= 3) {
        // Re-solve inverse from saved points to ensure it uses the new algorithm
        return { ...saved, inverse: solveInverse(saved.points) };
      }
    }
  } catch { /* ignore */ }
  if (defaultPoints.length >= 3) return { points: defaultPoints, transform: solveAffine(defaultPoints), inverse: solveInverse(defaultPoints) };
  return { points: [], transform: null, inverse: null };
}

const SVG_GATE      = { x: 1435, y: 265 }; // destinație / dozator

// Puncte de start diferite pentru fiecare persoană
const SVG_STARTS: Record<string, {x:number;y:number}> = {
  you:    { x: 1277, y: 345 },
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

function makeOrthoRouteVia(from: {x:number;y:number}, via: {x:number;y:number}, to: {x:number;y:number}): {x:number;y:number}[] {
  return [from, { x: via.x, y: from.y }, via, { x: to.x, y: via.y }, to];
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
  const positionsRef = useRef(positions);
  positionsRef.current = positions;

  const [locLoading, setLocLoading] = useState(false);
  const [locationLoaded, setLocationLoaded] = useState(false);
  const watchIdRef = useRef<number|null>(null);
  const [pixelLog, setPixelLog] = useState(false);

  // Calibration state (points + transforms kept for GPS→SVG mapping)
  const [calPoints, setCalPoints] = useState<CalPoint[]>([]);
  const [calTransform, setCalTransform] = useState<CalTransform|null>(null);
  const [calInverse, setCalInverse] = useState<InvTransform|null>(null);
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
  const activePersonRef = useRef(activePerson);
  activePersonRef.current = activePerson;

  // Track container dimensions for pan clamping
  const containerSizeRef = useRef({ W: 0, H: 0 });
  useEffect(() => {
    const el = mapWrapRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      containerSizeRef.current = { W: r.width, H: r.height };
      // Re-clamp pan whenever the container resizes (e.g. ETA card appears/disappears)
      // so the map always fills the container — prevents the black-bar-at-bottom bug on mobile.
      if (isPortraitRef.current) {
        setMapPan(p => clampPan(p.x, p.y, mapZoomRef.current));
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Clamp pan so the map image never shows empty/black areas (portrait only)
  // After rotate(-90deg)+scale(Z): image visual = (W/MAP_ASPECT)*Z wide × W*Z tall
  const clampPan = (panX: number, panY: number, zoom: number) => {
    if (!isPortraitRef.current) return { x: panX, y: panY };
    const { W, H } = containerSizeRef.current;
    if (W === 0) return { x: panX, y: panY };
    const maxX = Math.max(0, ((W / MAP_ASPECT) * zoom - W) / 2);
    const maxY = Math.max(0, (W * zoom - H) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, panX)),
      y: Math.max(-maxY, Math.min(maxY, panY)),
    };
  };

  // Helper: compute pan to center SVG point (svgX, svgY) in a W×H container at zoom Z (portrait)
  const centerOnSvgPoint = (svgX: number, svgY: number, W: number, H: number, Z: number) => {
    const imgH = W / MAP_ASPECT;
    const lx = (svgX / 2262) * W;
    const ly = (H - imgH) / 2 + (svgY / 587) * imgH;
    return clampPan(-Z * (ly - H / 2), Z * (lx - W / 2), Z);
  };

  // Auto-follow: when the active person moves, keep them centred (like Google Maps)
  const [isFollowing, setIsFollowing] = useState(true);
  const isFollowingRef = useRef(true);
  useEffect(() => {
    if (!isFollowingRef.current || !isPortraitRef.current) return;
    const { W, H } = containerSizeRef.current;
    if (W === 0) return;
    const pos = positionsRef.current[activePersonRef.current];
    if (!pos) return;
    setMapPan(centerOnSvgPoint(pos.x, pos.y, W, H, mapZoomRef.current));
  }, [positions]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isPortrait) {
      setIsFollowing(true);
      isFollowingRef.current = true;
      requestAnimationFrame(() => {
        const { W, H } = containerSizeRef.current;
        const pos = positionsRef.current[activePerson];
        setMapZoom(MAP_ASPECT);
        if (W > 0 && pos) {
          setMapPan(centerOnSvgPoint(pos.x, pos.y, W, H, MAP_ASPECT));
        } else {
          setMapPan({ x: 0, y: 0 });
        }
      });
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
      requestAnimationFrame(() => {
        const { W, H } = containerSizeRef.current;
        if (W === 0) return;
        if (fs) {
          // Cover zoom, anchor map bottom to screen bottom — no black bars
          const panY = clampPan(0, (H - W * MAP_ASPECT) / 2, MAP_ASPECT).y;
          setMapZoom(MAP_ASPECT);
          setMapPan({ x: 0, y: panY });
        } else if (isPortraitRef.current) {
          const pos = positionsRef.current[activePersonRef.current];
          setMapZoom(MAP_ASPECT);
          setMapPan(pos ? centerOnSvgPoint(pos.x, pos.y, W, H, MAP_ASPECT) : { x: 0, y: 0 });
        }
      });
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Dead-zone: only update position if moved > DEAD_ZONE_M metres
  const lastGps = useRef<Record<string, {lat:number;lng:number}>>({});
  const DEAD_ZONE_M = 1;

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
    setCalInverse(saved.inverse);
  }, []);

  // Refs so native event handlers never capture stale closures
  const pixelLogRef = useRef(pixelLog);
  pixelLogRef.current = pixelLog;
  const mapZoomRef = useRef(mapZoom);
  mapZoomRef.current = mapZoom;
  const mapPanRef = useRef(mapPan);
  mapPanRef.current = mapPan;

  useEffect(() => {
    const el = mapWrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (pixelLogRef.current) return;
      e.preventDefault();
      isFollowingRef.current = false;
      setIsFollowing(false);
      const minZ = isPortraitRef.current ? MAP_ASPECT : 0.5;
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      setMapZoom(z => {
        const nz = Math.min(Math.max(z * factor, minZ), 10);
        setMapPan(p => clampPan(p.x, p.y, nz));
        return nz;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Native touch handlers (passive:false required for preventDefault)
  // Supports single-touch pan + two-finger pinch-to-zoom
  useEffect(() => {
    const el = mapWrapRef.current;
    if (!el) return;

    type PinchState = { dist: number; midX: number; midY: number; zoom: number; panX: number; panY: number };
    let pinch: PinchState | null = null;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    const onTouchStart = (e: TouchEvent) => {
      if (pixelLogRef.current) return;
      // Any touch = stop auto-follow
      isFollowingRef.current = false;
      setIsFollowing(false);
      if (e.touches.length === 1) {
        const rect = el.getBoundingClientRect();
        dragRef.current = {
          startX: e.touches[0].clientX - rect.left,
          startY: e.touches[0].clientY - rect.top,
          panX: mapPanRef.current.x,
          panY: mapPanRef.current.y,
        };
        setIsDragging(true);
        pinch = null;
      } else if (e.touches.length === 2) {
        dragRef.current = null;
        setIsDragging(false);
        const rect = el.getBoundingClientRect();
        pinch = {
          dist: dist(e.touches),
          midX: (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left,
          midY: (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top,
          zoom: mapZoomRef.current,
          panX: mapPanRef.current.x,
          panY: mapPanRef.current.y,
        };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (pixelLogRef.current) return;
      if (e.touches.length === 1 && dragRef.current) {
        const rect = el.getBoundingClientRect();
        const { startX, startY, panX, panY } = dragRef.current;
        const cx = e.touches[0].clientX - rect.left;
        const cy = e.touches[0].clientY - rect.top;
        const raw = { x: panX + cx - startX, y: panY + cy - startY };
        setMapPan(clampPan(raw.x, raw.y, mapZoomRef.current));
      } else if (e.touches.length === 2 && pinch) {
        const newDist = dist(e.touches);
        const rect = el.getBoundingClientRect();
        const W = rect.width, H = rect.height;
        const newMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const newMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
        const minZ = isPortraitRef.current ? MAP_ASPECT : 0.3;
        const newZoom = Math.min(Math.max(pinch.zoom * (newDist / pinch.dist), minZ), 10);
        const ratio = newZoom / pinch.zoom;
        const cmx = pinch.midX - W / 2;
        const cmy = pinch.midY - H / 2;
        const driftX = newMidX - pinch.midX;
        const driftY = newMidY - pinch.midY;
        const rawPan = { x: cmx - (cmx - pinch.panX) * ratio + driftX, y: cmy - (cmy - pinch.panY) * ratio + driftY };
        setMapZoom(newZoom);
        setMapPan(clampPan(rawPan.x, rawPan.y, newZoom));
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        dragRef.current = null;
        setIsDragging(false);
        pinch = null;
      } else if (e.touches.length === 1) {
        pinch = null;
        const rect = el.getBoundingClientRect();
        dragRef.current = {
          startX: e.touches[0].clientX - rect.left,
          startY: e.touches[0].clientY - rect.top,
          panX: mapPanRef.current.x,
          panY: mapPanRef.current.y,
        };
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove",  onTouchMove,  { passive: false });
    el.addEventListener("touchend",   onTouchEnd,   { passive: false });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove",  onTouchMove);
      el.removeEventListener("touchend",   onTouchEnd);
    };
  }, []); // refs keep values fresh — no deps needed

  const startDrag = (clientX: number, clientY: number) => {
    if (pixelLog) return;
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
  const boardingPhaseRef = useRef<BoardingPhase>("confirming");
  boardingPhaseRef.current = boardingPhase;
  const [taskIdx, setTaskIdx] = useState(0);
  const taskIdxRef = useRef(0);
  taskIdxRef.current = taskIdx;
  const arrivedZoneRef = useRef<string | null>(null); // zone id already notified
  const [atZone, setAtZone] = useState(false); // true when user is physically in current zone
  const [showTaskPopup, setShowTaskPopup] = useState(true); // auto-show on mount
  const TASKS = ZONES.map(z => ({ zone: z, label: z.label }));

  const advanceTask = () => {
    arrivedZoneRef.current = null; // allow next zone to trigger popup
    setAtZone(false);
    const next = taskIdx + 1;
    if (next >= TASKS.length) { setBoardingPhase("done"); setShowTaskPopup(true); }
    else { setTaskIdx(next); setBoardingPhase("task"); setDynamicRoute(null); setShowTaskPopup(true); }
  };

  const goToZone = () => {
    const zone = TASKS[taskIdx]?.zone;
    const from = positionsRef.current[activePerson];
    if (!zone || !from) return;
    setDynamicRoute(zone.id === "imbarcare" && from.x < SVG_GATE.x
      ? makeOrthoRouteVia(from, SVG_GATE, { x: zone.x, y: zone.y })
      : makeOrthoRoute(from, { x: zone.x, y: zone.y }));
    setShowTaskPopup(false);
  };

  // Reset dynamic route when the active person changes
  const prevActivePerson = useRef(activePerson);
  if (prevActivePerson.current !== activePerson) {
    prevActivePerson.current = activePerson;
    setDynamicRoute(null);
  }

  const person = PEOPLE.find(p => p.id === activePerson)!;
  const flight = FLIGHTS.find(f => f.id === person.flightId) ?? null;
  const pts = dynamicRoute ?? (flight ? ROUTE_PX[flight.gate] ?? null : null);
  const gatePos = flight ? GATE_SVG[flight.gate] : null;
  const polyline = pts ? pts.map(p => `${p.x},${p.y}`).join(" ") : "";

  const placeOnMap = (lat: number, lng: number, personId: string) => {
    if (!calTransform || !calInverse) return;
    lastGps.current[personId] = { lat, lng };
    const svgPos = svgFromGps(calTransform, lat, lng, calInverse);
    setPositions(p => ({ ...p, [personId]: svgPos }));
    // Pan: landscape centers on user, portrait handled by positions effect
    const SVG_W = 2262, SVG_H = 587;
    const inBounds = svgPos.x >= 0 && svgPos.x <= SVG_W && svgPos.y >= 0 && svgPos.y <= SVG_H;
    if (personId === activePersonRef.current && inBounds && isFollowingRef.current && !isPortraitRef.current) {
      const { W, H } = containerSizeRef.current;
      if (W > 0) setMapPan({ x: W / 2 - svgPos.x * mapZoomRef.current, y: H / 2 - svgPos.y * mapZoomRef.current });
    }
    if (personId !== activePersonRef.current) return;
    // Reroute + proximity using refs (no stale closure)
    const zone = ZONES[taskIdxRef.current];
    if (zone && boardingPhaseRef.current === "task") {
      setDynamicRoute(zone.id === "imbarcare" && svgPos.x < SVG_GATE.x
        ? makeOrthoRouteVia(svgPos, SVG_GATE, { x: zone.x, y: zone.y })
        : makeOrthoRoute(svgPos, { x: zone.x, y: zone.y }));
      const dist = Math.sqrt((svgPos.x - zone.x)**2 + (svgPos.y - zone.y)**2);
      if (dist < Math.max(zone.w, zone.h) * 0.6 && arrivedZoneRef.current !== zone.id) {
        arrivedZoneRef.current = zone.id;
        setAtZone(true);
        setShowTaskPopup(true);
      }
    }
  };

  // Auto-start location watching on mount — no hardcoded pin until real GPS arrives
  const locationAsked = useRef(false);
  useEffect(() => {
    if (navigator.geolocation && !locationAsked.current) {
      locationAsked.current = true;
      getLocation();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        onLog(`📍 ${lat.toFixed(5)}, ${lng.toFixed(5)} ±${pos.coords.accuracy.toFixed(0)}m`);
        placeOnMap(lat, lng, activePersonRef.current);
        setBoardingPhase(p => p === "awaiting-location" ? "task" : p);
        isFollowingRef.current = true;
        setIsFollowing(true);
        setLocLoading(false);
        setLocationLoaded(true);
      },
      (err) => { onLog(`Eroare locație: ${err.message}`, false); setLocLoading(false); setLocationLoaded(true); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
    );
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
        <button onClick={getLocation} style={{
          marginLeft:"auto", padding:"6px 12px", borderRadius:"var(--radius-md)", cursor:"pointer", fontSize:12,
          border:"1px solid var(--border-color)", background:"var(--bg-hover)", color:"var(--text-muted)",
          display:"flex", alignItems:"center", gap:6,
        }}>
          <i className={`ti ti-map-pin${locLoading?" spin":""}`}/> Localizează
        </button>
        <button onClick={() => { setPixelLog(m => !m); }} style={{
          padding:"6px 10px", borderRadius:"var(--radius-md)", cursor:"pointer", fontSize:12,
          border:`1px solid ${pixelLog?"#F59E0B":"var(--border-color)"}`,
          background: pixelLog ? "rgba(245,158,11,0.15)" : "var(--bg-hover)",
          color: pixelLog ? "#F59E0B" : "var(--text-muted)",
        }} title="Crosshair SVG coords">
          <i className="ti ti-crosshair"/>
        </button>
      </div>

      {/* Map — zoomable/pannable */}
      <div
        ref={mapWrapRef}
        className="map-container"
        style={{
          position: "relative", flex: 1, minHeight: 0,
          borderRadius: "var(--radius-md)", overflow: "hidden",
          border: `1px solid ${pixelLog?"#F59E0B":"var(--border-color)"}`,
          cursor: isDragging ? "grabbing" : "grab",
          userSelect: "none",
        }}
        onMouseDown={e => startDrag(e.clientX, e.clientY)}
        onMouseMove={e => moveDrag(e.clientX, e.clientY)}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
      >
        {/* GPS loading overlay — shown until first real location fix */}
        {!locationLoaded && (
          <div style={{
            position:"absolute", inset:0, zIndex:20,
            background:"rgba(0,0,0,0.55)", backdropFilter:"blur(4px)",
            display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14,
          }}>
            <div style={{
              width:44, height:44, borderRadius:"50%",
              border:"3px solid var(--brand)", borderTopColor:"transparent",
              animation:"spin 0.8s linear infinite",
            }} />
            <div style={{ fontSize:13, color:"var(--text-main)", fontWeight:600 }}>Se obține locația GPS...</div>
            <div style={{ fontSize:11, color:"var(--text-muted)" }}>Permite accesul la locație când ți se cere</div>
          </div>
        )}

        {/* Zoom controls — hidden when crosshair active */}
        {!pixelLog && (
          <div style={{ position:"absolute", top:8, right:8, zIndex:10, display:"flex", flexDirection:"column", gap:4 }}>
            <button style={zoomBtnStyle} onClick={() => {
              isFollowingRef.current = false; setIsFollowing(false);
              setMapZoom(z => { const nz = Math.min(z * 1.25, 10); setMapPan(p => clampPan(p.x, p.y, nz)); return nz; });
            }} title="Zoom in">+</button>
            <button style={zoomBtnStyle} onClick={() => {
              isFollowingRef.current = false; setIsFollowing(false);
              const minZ = isPortrait ? MAP_ASPECT : 0.5;
              setMapZoom(z => { const nz = Math.max(z * 0.8, minZ); setMapPan(p => clampPan(p.x, p.y, nz)); return nz; });
            }} title="Zoom out">−</button>
            <button style={{ ...zoomBtnStyle, fontSize:12 }} onClick={() => {
              isFollowingRef.current = true; setIsFollowing(true);
              const Z = isPortrait ? MAP_ASPECT : 1;
              const { W, H } = containerSizeRef.current;
              const pos = positionsRef.current[activePerson];
              setMapZoom(Z);
              setMapPan(isPortrait && pos && W > 0 ? centerOnSvgPoint(pos.x, pos.y, W, H, Z) : { x: 0, y: 0 });
            }} title="Centrează pe mine">
              <i className="ti ti-home-2" />
            </button>
            {/* Follow-me indicator: blue when following, muted when free */}
            {isPortrait && (
              <button style={{ ...zoomBtnStyle, color: isFollowing ? "#38BDF8" : "var(--text-muted)", borderColor: isFollowing ? "#38BDF8" : "var(--border-color)" }}
                onClick={() => {
                  isFollowingRef.current = true; setIsFollowing(true);
                  const { W, H } = containerSizeRef.current;
                  const pos = positionsRef.current[activePerson];
                  if (pos && W > 0) setMapPan(centerOnSvgPoint(pos.x, pos.y, W, H, mapZoomRef.current));
                }} title="Urmărire automată">
                <i className="ti ti-navigation" style={{ fontSize:13 }} />
              </button>
            )}
            <button style={{ ...zoomBtnStyle, fontSize:14 }} onClick={toggleFullscreen} title={isFullscreen ? "Ieși din ecran complet" : "Ecran complet"}>
              <i className={`ti ti-arrows-${isFullscreen ? "minimize" : "maximize"}`} />
            </button>
            {/* Boarding guide button — always visible; reopens or restarts the process */}
            <button
              onClick={() => {
                if (boardingPhase === "idle") {
                  setBoardingPhase("confirming");
                  setTaskIdx(0);
                  setDynamicRoute(null);
                }
                setShowTaskPopup(true);
              }}
              title="Procesul de îmbarcare"
              style={{ ...zoomBtnStyle,
                color: boardingPhase === "task" ? TASKS[taskIdx]?.zone.color ?? "var(--brand)" : boardingPhase === "done" ? "#34D399" : "var(--brand)",
                borderColor: boardingPhase === "task" ? TASKS[taskIdx]?.zone.color ?? "var(--border-color)" : boardingPhase === "done" ? "#34D399" : "var(--brand)",
                fontSize: 13,
              }}>
              <i className="ti ti-list-check" />
            </button>
          </div>
        )}

        {/* Center crosshair — shows SVG coords of the map center */}
        {pixelLog && (() => {
          const { W, H } = containerSizeRef.current;
          // Invert the CSS transform: center pixel → SVG coords
          // transform: translate(panX, panY) scale(zoom) [rotate(-90) if portrait]
          // center of container in transformed space:
          const cx = W > 0 ? ((W/2 - mapPan.x) / mapZoom) : 0;
          const cy = H > 0 ? ((H/2 - mapPan.y) / mapZoom) : 0;
          // In portrait the SVG is rotated -90°, so swap and flip axes
          const svgX = isPortrait ? cy : cx;
          const svgY = isPortrait ? (2262 - cx) : cy;
          return (
            <>
              {/* crosshair lines */}
              <div style={{ position:"absolute", inset:0, zIndex:15, pointerEvents:"none" }}>
                <div style={{ position:"absolute", top:"50%", left:0, right:0, height:1, background:"#F59E0B", opacity:0.7 }}/>
                <div style={{ position:"absolute", left:"50%", top:0, bottom:0, width:1, background:"#F59E0B", opacity:0.7 }}/>
                <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:16, height:16, borderRadius:"50%", border:"2px solid #F59E0B" }}/>
              </div>
              {/* coords badge */}
              <div style={{ position:"absolute", top:8, left:8, zIndex:16, background:"rgba(11,17,32,0.92)", border:"1px solid #F59E0B", borderRadius:6, padding:"6px 10px", fontSize:13, color:"#F59E0B", pointerEvents:"none", fontVariantNumeric:"tabular-nums" }}>
                x: <b>{svgX.toFixed(0)}</b> · y: <b>{svgY.toFixed(0)}</b>
              </div>
            </>
          );
        })()}

        {/* Transformable layer — floor plan + SVG overlay zoom/pan together */}
        <div style={{
          position: "absolute", inset: 0,
          transform: `translate(${mapPan.x}px, ${mapPan.y}px) scale(${mapZoom})${isPortrait ? " rotate(-90deg)" : ""}`,
          transformOrigin: "center center",
          willChange: "transform",
          // Smooth when auto-following; instant when the user is dragging/pinching
          transition: (isFollowing && !isDragging) ? "transform 0.45s cubic-bezier(0.25,0.46,0.45,0.94)" : "none",
        }}>
          <img src="/harta_completa.svg" alt="Hartă T4 LRIA" draggable={false}
            style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"contain", display:"block", zIndex:1 }} />

          <svg ref={svgRef} viewBox="0 0 2262 587" preserveAspectRatio="xMidYMid meet"
            style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none", zIndex:2 }}>
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
            {pts && pts.slice(1).map((pt, i) => {
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
            {ZONES.map(z => {
              const words = z.label.split(" ");
              const lineH = 16;
              const totalH = words.length * lineH;
              const rot = isPortrait ? 90 : 0;
              const isActiveZone = boardingPhase === "task" && TASKS[taskIdx]?.zone.id === z.id;
              return (
                <g key={z.id} transform={`rotate(${rot}, ${z.x}, ${z.y})`}>
                  <rect x={z.x - z.w/2} y={z.y - z.h/2} width={z.w} height={z.h} rx="10"
                    fill={isActiveZone ? `${z.color}44` : `${z.color}22`}
                    stroke={z.color} strokeWidth={isActiveZone ? "3" : "1.5"}/>
                  <text textAnchor="middle" fill={z.color} fontSize="13" fontWeight="800">
                    {words.map((w, i) => (
                      <tspan key={i} x={z.x} dy={i === 0 ? z.y - totalH/2 + lineH * 0.8 : lineH}>{w}</tspan>
                    ))}
                  </text>
                </g>
              );
            })}

            {/* Gate */}
            {gatePos && (
              <g filter="url(#glow2)">
                <circle cx={gatePos.x - 40} cy={gatePos.y} r="14" fill="none" stroke="#10B981" strokeWidth="2"/>
                <circle cx={gatePos.x - 40} cy={gatePos.y} r="7" fill="#10B981"/>
              </g>
            )}

            {/* Active person dot — only shown after real GPS fix, never hardcoded */}
            {locationLoaded && (() => {
              const p = PEOPLE.find(p => p.id === activePerson);
              if (!p) return null;
              const pos = positions[p.id];
              return (
                <g filter="url(#glow2)">
                  <circle cx={pos.x} cy={pos.y} r="12" fill={p.color} opacity="0.3">
                    <animate attributeName="r" values="12;22;12" dur="1.8s" repeatCount="indefinite"/>
                    <animate attributeName="opacity" values="0.3;0;0.3" dur="1.8s" repeatCount="indefinite"/>
                  </circle>
                  <circle cx={pos.x} cy={pos.y} r="7" fill={p.color}/>
                  <circle cx={pos.x} cy={pos.y} r="2.5" fill="#fff"/>
                </g>
              );
            })()}
          </svg>
        </div>
        <style>{`
          @keyframes moveDash { to { stroke-dashoffset: -200; } }
          @keyframes pulse { 0%,100%{opacity:0.2} 50%{opacity:0.8} }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>

        {/* ── Boarding task popup — lives inside mapWrapRef so it is visible in
            browser fullscreen (position:fixed descendants of the fullscreen element
            are positioned relative to it, not the hidden page behind it) ── */}
        {showTaskPopup && boardingPhase !== "idle" && (
          <div
            onClick={() => { if (boardingPhase !== "confirming") setShowTaskPopup(false); }}
            style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(0,0,0,0.55)", backdropFilter:"blur(3px)", display:"flex", alignItems:"flex-end", justifyContent:"center", padding:"0 0 76px" }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ background:"var(--bg-card)", border:"1px solid var(--border-color)", borderRadius:"20px 20px 0 0", padding:"20px 20px 24px", width:"100%", maxWidth:500, boxShadow:"0 -8px 40px rgba(0,0,0,0.45)" }}
            >
              {/* Handle bar */}
              <div style={{ width:36, height:4, background:"var(--border-color)", borderRadius:2, margin:"0 auto 18px" }}/>

              {boardingPhase === "confirming" && (
                <>
                  <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
                    <span style={{ fontSize:36 }}>✈️</span>
                    <div>
                      <div style={{ fontWeight:800, fontSize:17, color:"var(--text-main)" }}>Procesul de îmbarcare</div>
                      <div style={{ fontSize:13, color:"var(--text-muted)", marginTop:4 }}>Doriți ghidare pas cu pas prin terminal?</div>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:10 }}>
                    <button onClick={() => { setBoardingPhase("awaiting-location"); getLocation(); setTaskIdx(0); }}
                      style={{ flex:1, padding:"13px 0", background:"var(--brand)", border:"none", borderRadius:12, color:"#fff", fontWeight:700, fontSize:15, cursor:"pointer" }}>
                      Da, începe
                    </button>
                    <button onClick={() => { setBoardingPhase("idle"); setShowTaskPopup(false); }}
                      style={{ flex:1, padding:"13px 0", background:"var(--bg-hover)", border:"1px solid var(--border-color)", borderRadius:12, color:"var(--text-muted)", fontSize:15, cursor:"pointer" }}>
                      Nu acum
                    </button>
                  </div>
                </>
              )}

              {boardingPhase === "awaiting-location" && (
                <>
                  <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20 }}>
                    <i className="ti ti-map-pin" style={{ fontSize:30, color:"#38BDF8", flexShrink:0 }}/>
                    <div>
                      <div style={{ fontWeight:700, fontSize:16, color:"#38BDF8" }}>Activați localizarea</div>
                      <div style={{ fontSize:13, color:"var(--text-muted)", marginTop:4 }}>Apăsați <b>Localizează</b> pe hartă pentru a începe ghidarea.</div>
                    </div>
                  </div>
                  <button onClick={() => setShowTaskPopup(false)}
                    style={{ width:"100%", padding:"12px 0", background:"var(--bg-hover)", border:"1px solid var(--border-color)", borderRadius:12, color:"var(--text-muted)", fontSize:14, cursor:"pointer" }}>
                    Închide
                  </button>
                </>
              )}

              {boardingPhase === "task" && TASKS[taskIdx] && (() => {
                const task = TASKS[taskIdx];
                const c = task.zone.color;
                const isArrived = atZone;
                const prevTask = taskIdx > 0 ? TASKS[taskIdx - 1] : null;
                return (
                  <>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                      <span style={{ background:c, color:"#000", fontWeight:800, fontSize:11, borderRadius:20, padding:"3px 12px" }}>
                        {taskIdx + 1} / {TASKS.length}
                      </span>
                      <span style={{ fontSize:12, color:"var(--text-muted)" }}>{isArrived ? "Ai ajuns!" : "Următor pas"}</span>
                    </div>
                    <div style={{ fontSize:21, fontWeight:800, color:c, marginBottom:18 }}>{task.label}</div>
                    <div style={{ display:"flex", gap:10 }}>
                      {isArrived ? (
                        <>
                          <button onClick={advanceTask}
                            style={{ flex:2, padding:"13px 0", background:c, border:"none", borderRadius:12, color:"#000", fontWeight:700, fontSize:14, cursor:"pointer" }}>
                            ✓ Am ajuns
                          </button>
                          {prevTask && (
                            <button onClick={() => {
                              arrivedZoneRef.current = null;
                              setAtZone(false);
                              setTaskIdx(taskIdx - 1);
                              setBoardingPhase("task");
                              const from = positionsRef.current[activePersonRef.current];
                              const pz = prevTask.zone;
                              if (from) setDynamicRoute(makeOrthoRoute(from, { x: pz.x, y: pz.y }));
                              setShowTaskPopup(false);
                            }}
                              style={{ flex:1, padding:"13px 0", background:"var(--bg-hover)", border:`1px solid ${c}`, borderRadius:12, color:c, fontWeight:600, fontSize:13, cursor:"pointer" }}>
                              ← {prevTask.label}
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <button onClick={goToZone}
                            style={{ flex:2, padding:"13px 0", background:c, border:"none", borderRadius:12, color:"#000", fontWeight:700, fontSize:14, cursor:"pointer" }}>
                            ➜ Mergi spre {task.label}
                          </button>
                          <button onClick={advanceTask}
                            style={{ flex:1, padding:"13px 0", background:"var(--bg-hover)", border:`1px solid ${c}`, borderRadius:12, color:c, fontWeight:600, fontSize:14, cursor:"pointer" }}>
                            ✓ Am ajuns
                          </button>
                        </>
                      )}
                    </div>
                  </>
                );
              })()}

              {boardingPhase === "done" && (
                <>
                  <div style={{ textAlign:"center", marginBottom:20 }}>
                    <div style={{ fontSize:52, marginBottom:8 }}>🎉</div>
                    <div style={{ fontWeight:800, fontSize:19, color:"#34D399" }}>Îmbarcare completă!</div>
                    <div style={{ fontSize:14, color:"var(--text-muted)", marginTop:6 }}>Zbor plăcut!</div>
                  </div>
                  <button onClick={() => setShowTaskPopup(false)}
                    style={{ width:"100%", padding:"13px 0", background:"rgba(52,211,153,0.15)", border:"1px solid #34D399", borderRadius:12, color:"#34D399", fontWeight:700, fontSize:15, cursor:"pointer" }}>
                    Închide
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

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

    </>
  );
}
/* ── Heatmap center — Google Maps + Orange Population Density ── */

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

function heatColor(density: number): string {
  if (density > 150) return "var(--danger)";
  if (density > 60)  return "var(--warning)";
  return "var(--success)";
}

/* ═══════════════════════════ HEATMAP ═══════════════════════════ */

// Zonele aeroportului cu coordonatele SVG exacte
const AIRPORT_ZONES: {
  id: string; label: string; svgX: number; svgY: number;
  baseLoad: number;
  radius: number;
  icon: string;
}[] = [
  { id: "checkin",   label: "Check-in",          svgX:  87, svgY: 391, baseLoad: 0.6, radius: 90,  icon: "ti-luggage" },
  { id: "security",  label: "Control Securitate", svgX: 454, svgY: 261, baseLoad: 0.8, radius: 100, icon: "ti-shield-check" },
  { id: "documente", label: "Verificare Documente",svgX: 837, svgY: 324, baseLoad: 0.5, radius: 85,  icon: "ti-id-badge" },
  { id: "gate",      label: "Sosire la Poartă",   svgX:1371, svgY: 274, baseLoad: 0.7, radius: 95,  icon: "ti-door-enter" },
  { id: "imbarcare", label: "Îmbarcare",           svgX:1607, svgY: 241, baseLoad: 0.75,radius: 90,  icon: "ti-plane-departure" },
  { id: "bord",      label: "La bord",             svgX:1777, svgY: 271, baseLoad: 0.4, radius: 75,  icon: "ti-armchair" },
];

function generateSyntheticDensity(tick: number): { id: string; density: number; pax: number }[] {
  return AIRPORT_ZONES.map(z => {
    const wave = Math.sin(tick * 0.08 + AIRPORT_ZONES.indexOf(z) * 1.3) * 0.15;
    const noise = (Math.sin(tick * 0.31 + AIRPORT_ZONES.indexOf(z) * 2.7) * 0.05);
    const raw = Math.max(0.05, Math.min(1, z.baseLoad + wave + noise));
    const pax = Math.round(raw * 100);
    return { id: z.id, density: raw, pax };
  });
}

function zoneColor(intensity: number): string {
  if (intensity > 0.75) return "#EF5350";
  if (intensity > 0.50) return "#FFA726";
  if (intensity > 0.25) return "#FFEE58";
  return "#66BB6A";
}

function HeatmapCenter({ onLog, selected, setSelected }: { onLog:(m:string,ok?:boolean)=>void; selected: string | null; setSelected: React.Dispatch<React.SetStateAction<string | null>> }) {
  const [tick, setTick] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setTick(t => t + 1), 2000);
    return () => clearInterval(id);
  }, [paused]);

  useEffect(() => {
    if (tick % 10 === 0 && tick > 0) {
      const hot = data.filter(d => d.density > 0.7).map(d => AIRPORT_ZONES.find(z => z.id === d.id)?.label).join(", ");
      onLog(`Heatmap T4 · ${hot ? "Aglomerare: " + hot : "Flux normal"}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const data = generateSyntheticDensity(tick);
  const maxDensity = Math.max(...data.map(d => d.density), 0.01);
  const totalPax = data.reduce((s, d) => s + d.pax, 0);
  const avgDensity = data.reduce((s, d) => s + d.density, 0) / data.length;
  const alertZones = data.filter(d => d.density > 0.7);

  const selectedData = selected ? data.find(d => d.id === selected) : null;
  const selectedZone = selected ? AIRPORT_ZONES.find(z => z.id === selected) : null;

  const VB_W = 1920, VB_H = 587;

  return (
    <>
      {/* ── Header ── */}
      <div className="map-header">
        <div>
          <div className="map-title">
            <i className="ti ti-map-2" style={{ marginRight:6, color:"var(--brand)" }} />
            Heatmap Terminal T4 — LRIA
          </div>
          <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>
            Orange Population Density (date sintetice) · {totalPax} pax detectați · Aglomerare medie: {Math.round(avgDensity * 100)}%
          </div>
        </div>
        <div className="badges">
          <div className="badge badge-live">
            <span className={`dot ${paused ? "orange" : "red pulse-red"}`}/>
            {paused ? "Pauzat" : "Live"}
          </div>
          <button
            onClick={() => setPaused(p => !p)}
            title={paused ? "Reia simularea" : "Pauză"}
            style={{ background:"var(--bg-hover)", border:"1px solid var(--border-color)", borderRadius:"var(--radius-md)", color:"var(--text-muted)", padding:"4px 10px", cursor:"pointer", fontSize:12 }}
          >
            <i className={`ti ti-${paused ? "player-play" : "player-pause"}`}/>
          </button>
        </div>
      </div>

      {/* ── Alert strip ── */}
      {alertZones.length > 0 && (
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8, flexShrink:0 }}>
          {alertZones.map(az => {
            const z = AIRPORT_ZONES.find(z => z.id === az.id)!;
            return (
              <div key={az.id} style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 10px", borderRadius:6, background:"rgba(239,83,80,0.12)", border:"1px solid #EF535044", fontSize:11, color:"#EF5350" }}>
                <i className={`ti ${z.icon}`} />
                {z.label} · {az.pax} pax
              </div>
            );
          })}
        </div>
      )}

      {/* ── Hartă cu heatmap overlay ── */}
      <div
        className="map-container"
        style={{
          position:"relative",
          flex:1,
          borderRadius:"var(--radius-md)",
          overflow:"hidden",
          border:"1px solid var(--border-color)",
          cursor:"pointer",
          background:"#1a1a1a",
        }}
        onClick={() => setSelected(null)}
      >
        {/* Harta SVG completă pe fundal — luminoasă, cu box-urile zones */}
        <img
          src="/harta_completa.svg"
          alt="Hartă T4"
          style={{
            position:"absolute",
            inset:0,
            width:"100%",
            height:"100%",
            objectFit:"contain",
            display:"block",
            zIndex:1,
            opacity:1,
          }}
        />

        {/* Heatmap overlay SVG — DOAR blob-urile, transparent background */}
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ position:"absolute", inset:0, width:"100%", height:"100%", zIndex:3 }}
        >
          <defs>
            {/* Gradiente radiale pentru fiecare zonă */}
            {AIRPORT_ZONES.map(z => {
              const d = data.find(x => x.id === z.id)!;
              const color = zoneColor(d.density);
              return (
                <radialGradient key={z.id} id={`hg_${z.id}`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%"   stopColor={color} stopOpacity={0.7 + d.density * 0.25} />
                  <stop offset="50%"  stopColor={color} stopOpacity={0.35 + d.density * 0.15} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.05} />
                </radialGradient>
              );
            })}
          </defs>

          {/* Heat blobs — blob-uri mari cu gradient */}
          {AIRPORT_ZONES.map(z => {
            const d = data.find(x => x.id === z.id)!;
            const color = zoneColor(d.density);
            // Raza adaptiveă — mai mare cât mai aglomerat
            const r = z.radius * (0.6 + d.density * 0.6);
            const isSelected = selected === z.id;
            // Pentru "gate" (Sosire la Poartă), pune eticheta deasupra
            const labelY = z.id === "gate" ? z.svgY - r - 14 : z.svgY + r + 26;
            
            return (
              <g key={z.id} style={{ cursor:"pointer" }} onClick={(e) => { e.stopPropagation(); setSelected(selected === z.id ? null : z.id); }}>
                {/* Outer glow blob — mare, transparent, gradient */}
                <circle
                  cx={z.svgX}
                  cy={z.svgY}
                  r={r}
                  fill={`url(#hg_${z.id})`}
                  style={{ transition:"r 0.8s ease" }}
                />

                {/* Inner pulsing core — mic, solid, intens */}
                <circle
                  cx={z.svgX}
                  cy={z.svgY}
                  r={6 + d.density * 6}
                  fill={color}
                  opacity={0.85 + d.density * 0.15}
                  style={{ transition:"r 0.8s ease" }}
                />

                {/* Eticheta permanentă — deasupra pentru gate, sub pentru altele */}
                <text
                  x={z.svgX}
                  y={labelY}
                  textAnchor="middle"
                  fontSize="18"
                  fill={color}
                  fontWeight="700"
                  style={{ pointerEvents:"none" }}
                >
                  {z.label}
                </text>

                {/* Selection ring */}
                {isSelected && (
                  <circle cx={z.svgX} cy={z.svgY} r={r + 8} fill="none" stroke={color} strokeWidth="2.5" strokeDasharray="6,4" opacity="0.9" />
                )}
              </g>
            );
          })}

          {/* Orange API watermark */}
          <rect x="4" y="4" width="148" height="18" rx="3" fill="#0d1117bb" />
          <text x="10" y="16" fontSize="9" fill="#ff6600" fontWeight="700">Orange Population Density API</text>
          <text x="152" y="16" fontSize="8" fill="#aaaaaa"> · synthetic</text>
        </svg>
      </div>

      {/* ── Detail card la click pe zonă ── */}
      {selectedZone && selectedData && (
        <div className="fade-in" style={{ marginTop:10, padding:"12px 16px", borderRadius:"var(--radius-md)", background:"var(--bg-body)", border:`1px solid ${zoneColor(selectedData.density)}44`, flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <i className={`ti ${selectedZone.icon}`} style={{ fontSize:20, color:zoneColor(selectedData.density) }} />
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:14, color:zoneColor(selectedData.density) }}>{selectedZone.label}</div>
              <div style={{ fontSize:11, color:"var(--text-muted)" }}>Orange Population Density · celulă geohash simulată</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:22, fontWeight:800, color:zoneColor(selectedData.density) }}>{selectedData.pax}</div>
              <div style={{ fontSize:10, color:"var(--text-muted)" }}>persoane detectate</div>
            </div>
          </div>

          {/* Progress bar intensitate */}
          <div style={{ marginTop:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"var(--text-muted)", marginBottom:3 }}>
              <span>Densitate</span>
              <span style={{ fontWeight:600, color:zoneColor(selectedData.density) }}>{Math.round(selectedData.density * 100)}%</span>
            </div>
            <div style={{ height:6, background:"var(--bg-hover)", borderRadius:3, overflow:"hidden" }}>
              <div style={{ width:`${selectedData.density * 100}%`, height:"100%", background:zoneColor(selectedData.density), borderRadius:3, transition:"width 0.8s", boxShadow:`0 0 8px ${zoneColor(selectedData.density)}` }} />
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginTop:10 }}>
            {[
              ["Status", selectedData.density > 0.7 ? "⚠ Aglomerat" : selectedData.density > 0.4 ? "⚡ Moderat" : "✓ Liber"],
              ["ETA așteptare", selectedData.density > 0.7 ? `~${Math.round(selectedData.density * 25)} min` : "< 5 min"],
              ["Trend", tick % 3 === 0 ? "↗ Crește" : tick % 3 === 1 ? "→ Stabil" : "↘ Scade"],
            ].map(([l, v]) => (
              <div key={l} style={{ textAlign:"center", padding:"6px 8px", background:"var(--bg-hover)", borderRadius:6 }}>
                <div style={{ fontSize:9, color:"var(--text-muted)", marginBottom:2 }}>{l}</div>
                <div style={{ fontSize:12, fontWeight:600 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════ RIGHT PANEL ═══════════════════════════ */
function RightPanel({
  feature, onLog, weatherProvider, setWeatherProvider, myFlight, heatmapSelected,
}: {
  feature: Feature; onLog:(m:string,ok?:boolean)=>void;
  weatherProvider: WeatherProvider; setWeatherProvider: (p: WeatherProvider) => void;
  myFlight: MyFlightState;
  heatmapSelected: string | null;
}) {
  return (
    <div className="card sidebar-right">
      {feature === "weather" && <WeatherRight weatherProvider={weatherProvider} setWeatherProvider={setWeatherProvider} />}
      {feature === "route"   && <RouteRight onLog={onLog} />}
      {feature === "heatmap" && <HeatmapRight selected={heatmapSelected} />}
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
          <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>2 linii active</div>
          <div style={{ marginTop:6, height:4, background:"var(--bg-hover)", borderRadius:2 }}>
            <div style={{ width:`${Math.min(100,(securityDensity/250)*100)}%`, height:"100%", background:etaColor(securityETA), borderRadius:2, transition:"width 0.5s" }}/>
          </div>
        </div>
        <div style={{ padding:"12px 14px", background:"var(--bg-body)", border:"1px solid var(--border-color)", borderRadius:"var(--radius-md)" }}>
          <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:4, display:"flex", alignItems:"center", gap:6 }}>
            <i className="ti ti-door-enter" style={{ color:"var(--success)" }}/> Boarding Gate (Dozator)
          </div>
          <div style={{ fontSize:24, fontWeight:700, color:etaColor(boardingETA) }}>{boardingETA} min</div>
          <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>3 ghișee active</div>
          <div style={{ marginTop:6, height:4, background:"var(--bg-hover)", borderRadius:2 }}>
            <div style={{ width:`${Math.min(100,(boardingDensity/250)*100)}%`, height:"100%", background:etaColor(boardingETA), borderRadius:2, transition:"width 0.5s" }}/>
          </div>
        </div>
      </div>

    </>
  );
}

function HeatmapRight({ selected }: { selected: string | null }) {
  const [tick, setTick] = useState(0);
  const [trendingHistory, setTrendingHistory] = useState<{ [key: string]: number[] }>({});

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 2000);
    return () => clearInterval(id);
  }, []);

  // Track trending history pentru fiecare zonă
  useEffect(() => {
    const data = generateSyntheticDensity(tick);
    setTrendingHistory(prev => {
      const updated = { ...prev };
      data.forEach(d => {
        if (!updated[d.id]) updated[d.id] = [];
        updated[d.id] = [...updated[d.id].slice(-9), d.density * 100]; // Keep last 10 values
      });
      return updated;
    });
  }, [tick]);

  // Generează date sintetice pentru zonele din centru
  const data = generateSyntheticDensity(tick);
  const maxDensity = Math.max(...data.map(d => d.density * 250), 1); // convertează la "pax echivalent"
  const totalPax = data.reduce((s, d) => s + d.pax, 0);
  const avgDensity = data.reduce((s, d) => s + d.density, 0) / data.length;
  const alertZones = data.filter(d => d.density > 0.7);
  
  const selectedData = selected ? data.find(d => d.id === selected) : null;
  const selectedZone = selected ? AIRPORT_ZONES.find(z => z.id === selected) : null;
  const selectedHistory = selected ? (trendingHistory[selected] || []) : [];

  return (
    <>
      {/* Dacă este o zonă selectată, arată detalii expanded */}
      {selectedZone && selectedData ? (
        <>
          <div className="section-title" style={{ marginBottom:16 }}>
            <i className={`ti ${selectedZone.icon}`} style={{ marginRight:6, fontSize:16, color:zoneColor(selectedData.density) }} />
            {selectedZone.label}
          </div>

          {/* Info card expandat */}
          <div style={{ padding:"12px 16px", borderRadius:"var(--radius-md)", background:"var(--bg-body)", border:`1px solid ${zoneColor(selectedData.density)}44`, marginBottom:16 }}>
            {/* Ocupare */}
            <div style={{ marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:4, color:"var(--text-muted)" }}>
                <span>Ocupare</span>
                <span style={{ fontWeight:600, color:zoneColor(selectedData.density) }}>{Math.round(selectedData.density * 100)}%</span>
              </div>
              <div style={{ height:8, background:"var(--bg-hover)", borderRadius:4, overflow:"hidden" }}>
                <div style={{ width:`${selectedData.density * 100}%`, height:"100%", background:zoneColor(selectedData.density), transition:"width 0.8s", boxShadow:`0 0 8px ${zoneColor(selectedData.density)}` }} />
              </div>
            </div>

            {/* Persoane */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
              <div style={{ textAlign:"center", padding:"8px", background:"var(--bg-hover)", borderRadius:6 }}>
                <div style={{ fontSize:9, color:"var(--text-muted)", marginBottom:2 }}>Persoane</div>
                <div style={{ fontSize:16, fontWeight:800, color:zoneColor(selectedData.density) }}>{selectedData.pax}</div>
              </div>
              <div style={{ textAlign:"center", padding:"8px", background:"var(--bg-hover)", borderRadius:6 }}>
                <div style={{ fontSize:9, color:"var(--text-muted)", marginBottom:2 }}>Status</div>
                <div style={{ fontSize:12, fontWeight:600, color:selectedData.density > 0.7 ? "var(--danger)" : selectedData.density > 0.4 ? "var(--warning)" : "var(--success)" }}>
                  {selectedData.density > 0.7 ? "⚠ Aglomerat" : selectedData.density > 0.4 ? "⚡ Moderat" : "✓ Liber"}
                </div>
              </div>
            </div>

            {/* ETA și Trend */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <div style={{ textAlign:"center", padding:"8px", background:"var(--bg-hover)", borderRadius:6 }}>
                <div style={{ fontSize:9, color:"var(--text-muted)", marginBottom:2 }}>Aşteptare ETA</div>
                <div style={{ fontSize:12, fontWeight:600 }}>
                  {selectedData.density > 0.7 ? `~${Math.round(selectedData.density * 25)} min` : "< 5 min"}
                </div>
              </div>
              <div style={{ textAlign:"center", padding:"8px", background:"var(--bg-hover)", borderRadius:6 }}>
                <div style={{ fontSize:9, color:"var(--text-muted)", marginBottom:2 }}>Trend</div>
                <div style={{ fontSize:12, fontWeight:600 }}>
                  {tick % 3 === 0 ? "↗ Crește" : tick % 3 === 1 ? "→ Stabil" : "↘ Scade"}
                </div>
              </div>
            </div>
          </div>

          <div className="section-title">Informații Suplimentare</div>
          <div style={{ fontSize:12, color:"var(--text-muted)", lineHeight:1.6 }}>
            <p>Zona <strong>{selectedZone.label}</strong> este curativ la <strong>{Math.round(selectedData.density * 100)}%</strong> din capacitate cu <strong>{selectedData.pax}</strong> persoane detectate.</p>
            {selectedData.density > 0.7 && (
              <p style={{ color:"var(--danger)", marginTop:8 }}>⚠ <strong>Alertă:</strong> Aglomerare ridicată. Se recomandă evitarea zonei sau planificarea unei alte rute.</p>
            )}
          </div>

          <div className="section-title" style={{ marginTop:16 }}>Trending</div>
          {/* Grafic trending — mini chart cu linie */}
          <div style={{ position:"relative", height:60, background:"var(--bg-hover)", borderRadius:6, padding:8, marginBottom:12 }}>
            <svg viewBox="0 0 200 50" style={{ width:"100%", height:"100%" }} preserveAspectRatio="none">
              {selectedHistory.length > 1 && (
                <>
                  {/* Grilă background */}
                  <line x1="0" y1="25" x2="200" y2="25" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3,2" opacity="0.5" />
                  
                  {/* Linie trending */}
                  <polyline
                    points={selectedHistory.map((val, i) => `${(i / (selectedHistory.length - 1)) * 200},${50 - (val / 100) * 50}`).join(" ")}
                    fill="none"
                    stroke={zoneColor(selectedData.density)}
                    strokeWidth="2"
                  />
                  
                  {/* Punct curent */}
                  <circle
                    cx={200}
                    cy={50 - (selectedHistory[selectedHistory.length - 1] / 100) * 50}
                    r="2.5"
                    fill={zoneColor(selectedData.density)}
                  />
                </>
              )}
              <text x="2" y="12" fontSize="9" fill="var(--text-muted)">100%</text>
              <text x="2" y="48" fontSize="9" fill="var(--text-muted)">0%</text>
            </svg>
          </div>
          <div style={{ fontSize:10, color:"var(--text-muted)", textAlign:"center" }}>Evoluția ultimelor 10 perioade</div>

          {/* Capacitate vs Ocupare */}
          <div className="section-title" style={{ marginTop:16 }}>Capacitate vs Ocupare</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
            {/* Capacitate */}
            <div style={{ padding:10, background:"var(--bg-hover)", borderRadius:6 }}>
              <div style={{ fontSize:10, color:"var(--text-muted)", marginBottom:4 }}>Capacitate Maximă</div>
              <div style={{ fontSize:16, fontWeight:800, color:"var(--text-main)", marginBottom:6 }}>250</div>
              <div style={{ height:6, background:"rgba(255,255,255,0.1)", borderRadius:3, overflow:"hidden" }}>
                <div style={{ width:"100%", height:"100%", background:"var(--success)" }} />
              </div>
              <div style={{ fontSize:9, color:"var(--text-muted)", marginTop:4 }}>persoane</div>
            </div>

            {/* Ocupare Curentă */}
            <div style={{ padding:10, background:"var(--bg-hover)", borderRadius:6 }}>
              <div style={{ fontSize:10, color:"var(--text-muted)", marginBottom:4 }}>Ocupare Curentă</div>
              <div style={{ fontSize:16, fontWeight:800, color:zoneColor(selectedData.density), marginBottom:6 }}>{selectedData.pax}</div>
              <div style={{ height:6, background:"rgba(255,255,255,0.1)", borderRadius:3, overflow:"hidden" }}>
                <div style={{ width:`${selectedData.density * 100}%`, height:"100%", background:zoneColor(selectedData.density), transition:"width 0.8s" }} />
              </div>
              <div style={{ fontSize:9, color:"var(--text-muted)", marginTop:4 }}>{Math.round(selectedData.density * 100)}% ocupat</div>
            </div>
          </div>

          {/* Peak Hours Analysis */}
          <div className="section-title">Peak Hours & Statistici</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {[
              { label: "Pic de ocupare", value: `${Math.max(...selectedHistory.map(h => Math.round(h)))}%`, icon: "ti-arrow-up" },
              { label: "Min de ocupare", value: `${Math.min(...selectedHistory.map(h => Math.round(h)))}%`, icon: "ti-arrow-down" },
              { label: "Medie istoric", value: `${Math.round(selectedHistory.reduce((a, b) => a + b, 0) / selectedHistory.length)}%`, icon: "ti-chart-bar" },
              { label: "Variabilitate", value: selectedHistory.length > 1 ? `${Math.round(Math.max(...selectedHistory) - Math.min(...selectedHistory))}%` : "—", icon: "ti-wave" },
            ].map(stat => (
              <div key={stat.label} style={{ padding:8, background:"var(--bg-hover)", borderRadius:6, textAlign:"center" }}>
                <div style={{ fontSize:14, color:zoneColor(selectedData.density), marginBottom:2 }}>
                  <i className={`ti ${stat.icon}`} style={{ marginRight:4 }} />
                </div>
                <div style={{ fontSize:11, fontWeight:600, marginBottom:2 }}>{stat.value}</div>
                <div style={{ fontSize:9, color:"var(--text-muted)" }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Afişare generală dacă nu este selectată o zonă */}
          <div className="section-title">Densitate Populație</div>
          <div className="stats-list" style={{ marginBottom:12 }}>
            <div className="stat-item">
              <span className="stat-label">Total zone</span>
              <span className="stat-value">{AIRPORT_ZONES.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Total pax</span>
              <span className="stat-value">{totalPax}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Densitate medie</span>
              <span className="stat-value" style={{ color: avgDensity > 0.7 ? "var(--danger)" : avgDensity > 0.4 ? "var(--warning)" : "var(--text-main)" }}>
                {Math.round(avgDensity * 100)}%
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Zone alertă</span>
              <span className="stat-value" style={{ color: alertZones.length > 0 ? "var(--danger)" : "var(--success)" }}>
                {alertZones.length}
              </span>
            </div>
          </div>

          <div className="section-title">Zone Terminal T4</div>
          <div style={{ flex:1, overflowY:"auto" }}>
            {data.map(d => {
              const zone = AIRPORT_ZONES.find(z => z.id === d.id)!;
              const color = zoneColor(d.density);
              const pct = Math.min(Math.round(d.density * 100), 100);
              return (
                <div key={d.id} className="zone-row">
                  <div style={{ display:"flex", alignItems:"center", gap:6, flex:1, minWidth:0 }}>
                    <i className={`ti ${zone.icon}`} style={{ fontSize:14, color, flexShrink:0 }} />
                    <span style={{ fontSize:12, fontWeight:600, color, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {zone.label}
                    </span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                    <div className="zone-bar-wrap">
                      <div className="zone-bar" style={{ width:`${pct}%`, background:color }}/>
                    </div>
                    <span style={{ fontSize:12, fontWeight:600, color, width:40, textAlign:"right" }}>
                      {pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {alertZones.length > 0 && (
            <div className="alert-box" style={{ marginTop:12 }}>
              <div className="alert-title"><i className="ti ti-alert-triangle"/> {alertZones.length} zone aglomerate</div>
              <div className="alert-desc">
                {alertZones.map(z => {
                  const zone = AIRPORT_ZONES.find(z2 => z2.id === z.id)!;
                  return `${zone.label}: ${Math.round(z.density * 100)}%`;
                }).join(" · ")}
              </div>
            </div>
          )}
        </>
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
    try { return localStorage.getItem(MF_KEY) ?? "LH6381"; } catch { return "LH6381"; }
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
      const saved = localStorage.getItem(MF_KEY) ?? "LH6381";
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

/* ─── Airport weather hook ─── */
const WMO_EMOJI: Record<number, string> = {
  0:"☀️", 1:"🌤️", 2:"⛅", 3:"☁️", 45:"🌫️", 48:"🌫️",
  51:"🌦️", 53:"🌦️", 55:"🌧️", 61:"🌧️", 63:"🌧️", 65:"🌧️",
  71:"🌨️", 73:"🌨️", 75:"❄️", 80:"🌦️", 81:"🌧️", 82:"⛈️",
  95:"⛈️", 96:"⛈️", 99:"⛈️",
};
interface AirportWx { tempC: number; apparentC: number; windKt: number; humidity: number; precip: number; code: number; emoji: string }
function useAirportWeather(iata: string): AirportWx | null {
  const [wx, setWx] = useState<AirportWx | null>(null);
  useEffect(() => {
    const c = AIRPORT_COORDS[iata];
    if (!c) return;
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&current=temperature_2m,apparent_temperature,wind_speed_10m,weather_code,relative_humidity_2m,precipitation&wind_speed_unit=kn&timezone=auto`)
      .then(r => r.json())
      .then(d => {
        const cur = d.current;
        const code = cur.weather_code as number;
        setWx({ tempC: Math.round(cur.temperature_2m), apparentC: Math.round(cur.apparent_temperature), windKt: Math.round(cur.wind_speed_10m), humidity: cur.relative_humidity_2m, precip: cur.precipitation, code, emoji: WMO_EMOJI[code] ?? "🌡️" });
      })
      .catch(() => {});
  }, [iata]);
  return wx;
}

/* ─── MyFlightCenter ─── */
function MyFlightCenter({ onLog, myFlight }: { onLog:(m:string,ok?:boolean)=>void; myFlight: MyFlightState }) {
  const { input, setInput, loading, detail, error, search } = myFlight;
  const status = detail ? (STATUS_META[detail.status] ?? { label: detail.status, color: "var(--text-muted)", icon: "ti-question-mark" }) : null;
  const depWx = useAirportWeather(detail?.departure.iata ?? "");
  const arrWx = useAirportWeather(detail?.arrival.iata ?? "");

  useEffect(() => {
    if (detail) onLog(`My Flight: ${detail.flight} ${detail.departure.iata}→${detail.arrival.iata} · ${status?.label}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  const row = (icon: string, label: string, val: React.ReactNode, accent?: string) => (
    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0", borderBottom:"1px solid var(--border-color)" }}>
      <i className={`ti ${icon}`} style={{ fontSize:16, color: accent ?? "var(--text-muted)", width:20, textAlign:"center", flexShrink:0 }} />
      <span style={{ fontSize:12, color:"var(--text-muted)", width:130, flexShrink:0 }}>{label}</span>
      <span style={{ fontSize:13, fontWeight:600, color: accent ?? "var(--text-main)" }}>{val}</span>
    </div>
  );

  return (
    <div style={{ padding:20, height:"100%", display:"flex", flexDirection:"column", gap:0, overflowY:"auto" }}>
      {/* Search bar */}
      <form onSubmit={e => { e.preventDefault(); search(input); }} style={{ display:"flex", gap:8, marginBottom:16, flexShrink:0 }}>
        <input type="text" className="phone-input" placeholder="Cod zbor IATA — ex: LH6381" value={input}
          onChange={e => setInput(e.target.value)} style={{ flex:1, textTransform:"uppercase" }} />
        <button type="submit" disabled={loading || !input.trim()} className="btn-primary"
          style={{ padding:"9px 16px", display:"flex", alignItems:"center", gap:6 }}>
          <i className={`ti ti-${loading ? "loader-2 spin" : "search"}`} />
        </button>
      </form>

      {error && (
        <div style={{ padding:"10px 14px", borderRadius:"var(--radius-md)", background:"var(--danger-bg)", border:"1px solid var(--danger)", color:"var(--danger)", fontSize:13, marginBottom:12 }}>
          <i className="ti ti-alert-circle" /> {error}
        </div>
      )}

      {detail && status ? (
        <>
          {/* ── Hero: flight number + status ── */}
          <div style={{ background:"var(--bg-body)", border:`1px solid ${status.color}44`, borderRadius:14, padding:"18px 20px", marginBottom:12, display:"flex", alignItems:"center", gap:16 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:28, fontWeight:800, letterSpacing:1 }}>{detail.flight}</div>
              <div style={{ fontSize:13, color:"var(--text-muted)", marginTop:2 }}>{detail.airline}</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ background:`${status.color}22`, color:status.color, border:`1px solid ${status.color}55`, borderRadius:20, padding:"5px 14px", fontSize:13, fontWeight:700, display:"inline-flex", alignItems:"center", gap:6 }}>
                <i className={`ti ${status.icon}`} />{status.label}
              </div>
              {detail.duration && (
                <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:6 }}>
                  <i className="ti ti-clock" style={{ marginRight:4 }} />{Math.floor(detail.duration/60)}h {detail.duration%60}m
                </div>
              )}
            </div>
          </div>

          {/* ── Progress bar (zbor activ) ── */}
          {detail.status === "active" && detail.progressPct !== null && (
            <div style={{ background:"var(--bg-body)", border:"1px solid var(--border-color)", borderRadius:12, padding:"14px 16px", marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, fontWeight:700, marginBottom:8 }}>
                <span style={{ color:"var(--success)" }}><i className="ti ti-plane-departure" /> {detail.departure.iata}</span>
                <span style={{ color:"var(--brand)" }}>{detail.remainingMin} min rămași</span>
                <span style={{ color:"var(--info)" }}>{detail.arrival.iata} <i className="ti ti-plane-arrival" /></span>
              </div>
              <div style={{ height:10, background:"var(--bg-hover)", borderRadius:5, overflow:"hidden" }}>
                <div style={{ width:`${detail.progressPct}%`, height:"100%", background:"var(--brand)", borderRadius:5, boxShadow:`0 0 8px var(--brand)` }} />
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--text-muted)", marginTop:6 }}>
                <span>{detail.elapsedMin} min scurși</span>
                <span style={{ fontWeight:700 }}>{detail.progressPct}%</span>
                <span>{detail.duration} min total</span>
              </div>
            </div>
          )}

          {/* ── DEP / ARR cards ── */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            {/* Departure */}
            <div style={{ background:"var(--bg-body)", border:"1px solid var(--border-color)", borderRadius:12, padding:"14px" }}>
              <div style={{ fontSize:10, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Plecare</div>
              <div style={{ fontSize:30, fontWeight:900 }}>{detail.departure.iata}</div>
              <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:8 }}>{detail.departure.airport}</div>
              <div style={{ fontSize:18, fontWeight:700 }}>{detail.departure.actual !== "—" ? detail.departure.actual : detail.departure.scheduled}</div>
              {detail.departure.actual !== "—" && detail.departure.actual !== detail.departure.scheduled && (
                <div style={{ fontSize:11, color:"var(--text-muted)", textDecoration:"line-through" }}>{detail.departure.scheduled}</div>
              )}
              {detail.departure.terminal !== "—" && <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:4 }}>Terminal {detail.departure.terminal}</div>}
              {detail.departure.gate !== "—" && <div style={{ fontSize:12, color:"var(--brand)", fontWeight:700, marginTop:2 }}>Poartă {detail.departure.gate}</div>}
              {(detail.departure.delayed ?? 0) > 0 && (
                <div style={{ marginTop:6, fontSize:12, color:"var(--warning)", fontWeight:700 }}>
                  <i className="ti ti-clock-exclamation" /> +{detail.departure.delayed} min întârziere
                </div>
              )}
            </div>
            {/* Arrival */}
            <div style={{ background:"var(--bg-body)", border:"1px solid var(--border-color)", borderRadius:12, padding:"14px" }}>
              <div style={{ fontSize:10, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Sosire</div>
              <div style={{ fontSize:30, fontWeight:900 }}>{detail.arrival.iata}</div>
              <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:8 }}>{detail.arrival.airport}</div>
              <div style={{ fontSize:18, fontWeight:700 }}>{detail.arrival.estimated !== "—" ? detail.arrival.estimated : detail.arrival.scheduled}</div>
              {detail.arrival.estimated !== "—" && detail.arrival.estimated !== detail.arrival.scheduled && (
                <div style={{ fontSize:11, color:"var(--text-muted)", textDecoration:"line-through" }}>{detail.arrival.scheduled}</div>
              )}
              {detail.arrival.terminal !== "—" && <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:4 }}>Terminal {detail.arrival.terminal}</div>}
              {detail.arrival.gate !== "—" && <div style={{ fontSize:12, color:"var(--brand)", fontWeight:700, marginTop:2 }}>Poartă {detail.arrival.gate}</div>}
              {detail.arrival.baggage !== "—" && (
                <div style={{ fontSize:12, color:"var(--info)", fontWeight:600, marginTop:6 }}>
                  <i className="ti ti-luggage" /> Belt {detail.arrival.baggage}
                </div>
              )}
              {(detail.arrival.delayed ?? 0) > 0 && (
                <div style={{ marginTop:6, fontSize:12, color:"var(--warning)", fontWeight:700 }}>
                  <i className="ti ti-clock-exclamation" /> +{detail.arrival.delayed} min întârziere
                </div>
              )}
            </div>
          </div>

          {/* ── Details rows ── */}
          <div style={{ background:"var(--bg-body)", border:"1px solid var(--border-color)", borderRadius:12, padding:"4px 16px", marginBottom:10 }}>
            {row("ti-plane", "Zbor", detail.flight)}
            {row("ti-building-airport", "Companie", detail.airline)}
            {detail.duration && row("ti-clock", "Durată zbor", `${Math.floor(detail.duration/60)}h ${detail.duration%60}m`)}
            {detail.departure.terminal !== "—" && row("ti-door-enter", "Terminal plecare", detail.departure.terminal, "var(--brand)")}
            {detail.departure.gate !== "—" && row("ti-armchair", "Poartă plecare", detail.departure.gate, "var(--brand)")}
            {detail.arrival.terminal !== "—" && row("ti-door-exit", "Terminal sosire", detail.arrival.terminal, "var(--info)")}
            {detail.arrival.baggage !== "—" && row("ti-luggage", "Belt bagaje", detail.arrival.baggage, "var(--info)")}
          </div>

          {/* ── Weather DEP / ARR ── */}
          {(depWx || arrWx) && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
              {[{ iata: detail.departure.iata, wx: depWx, label: "Vreme la plecare" },
                { iata: detail.arrival.iata,   wx: arrWx, label: "Vreme la sosire"  }].map(({ iata, wx, label }) => (
                <div key={iata} style={{ background:"var(--bg-body)", border:"1px solid var(--border-color)", borderRadius:12, padding:"12px 14px" }}>
                  <div style={{ fontSize:10, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>{label}</div>
                  <div style={{ fontSize:10, color:"var(--text-muted)", marginBottom:4 }}>{iata}</div>
                  {wx ? (
                    <>
                      <div style={{ fontSize:28, marginBottom:2 }}>{wx.emoji}</div>
                      <div style={{ fontSize:22, fontWeight:800 }}>{wx.tempC}°C</div>
                      <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>Simte {wx.apparentC}°C</div>
                      <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:4 }}>
                        <i className="ti ti-wind" style={{ marginRight:4 }} />{wx.windKt} kt
                        <span style={{ marginLeft:8 }}>💧{wx.humidity}%</span>
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize:20, opacity:0.3 }}>…</div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize:10, color:"var(--text-muted)", textAlign:"center", marginTop:4 }}>
            Live AirLabs · {new Date(detail.fetchedAt).toLocaleTimeString("ro", { hour:"2-digit", minute:"2-digit", second:"2-digit" })}
          </div>
        </>
      ) : !error && !loading && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"var(--text-muted)", gap:10 }}>
          <i className="ti ti-plane-departure" style={{ fontSize:52, opacity:0.15 }} />
          <div style={{ fontSize:14 }}>Caută zborul tău</div>
          <div style={{ fontSize:12, opacity:0.6 }}>ex: LH6381, W43653, RO708</div>
        </div>
      )}
    </div>
  );
}

/* ─── PassengerWeatherCenter ─── */
function PassengerWeatherCenter({ myFlight }: { myFlight: MyFlightState }) {
  const { detail } = myFlight;
  const depWx = useAirportWeather(detail?.departure.iata ?? "");
  const arrWx = useAirportWeather(detail?.arrival.iata ?? "");

  if (!detail) {
    return (
      <div style={{ padding:20, height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"var(--text-muted)", gap:12 }}>
        <i className="ti ti-cloud-off" style={{ fontSize:52, opacity:0.15 }} />
        <div style={{ fontSize:14 }}>No flight loaded</div>
        <div style={{ fontSize:12, opacity:0.6 }}>Go to My Flight first and search your flight code</div>
      </div>
    );
  }

  const airports = [
    { iata: detail.departure.iata, airport: detail.departure.airport, wx: depWx, label: "Departure", icon: "ti-plane-departure", color: "var(--success)" },
    { iata: detail.arrival.iata,   airport: detail.arrival.airport,   wx: arrWx, label: "Arrival",   icon: "ti-plane-arrival",   color: "var(--info)"    },
  ];

  return (
    <div style={{ padding:20, overflowY:"auto" }}>
      <h2 style={{ marginBottom:20 }}><i className="ti ti-cloud-sun"/> Weather — {detail.departure.iata} → {detail.arrival.iata}</h2>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        {airports.map(({ iata, airport, wx, label, icon, color }) => (
          <div key={iata} style={{ background:"var(--bg-body)", border:"1px solid var(--border-color)", borderRadius:14, padding:"20px 18px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
              <i className={`ti ${icon}`} style={{ color, fontSize:18 }} />
              <div>
                <div style={{ fontSize:11, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:1 }}>{label}</div>
                <div style={{ fontSize:22, fontWeight:900, lineHeight:1 }}>{iata}</div>
                <div style={{ fontSize:11, color:"var(--text-muted)" }}>{airport}</div>
              </div>
            </div>
            {wx ? (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <div style={{ textAlign:"center", padding:"10px 0" }}>
                  <div style={{ fontSize:52 }}>{wx.emoji}</div>
                  <div style={{ fontSize:36, fontWeight:800 }}>{wx.tempC}°C</div>
                  <div style={{ fontSize:13, color:"var(--text-muted)" }}>Feels like {wx.apparentC}°C</div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {([
                    ["ti-wind",       "Wind",     `${wx.windKt} kt`  ],
                    ["ti-droplet",    "Humidity", `${wx.humidity}%`  ],
                    ["ti-cloud-rain", "Precip",   `${wx.precip} mm`  ],
                  ] as [string,string,string][]).map(([ico, lbl, val]) => (
                    <div key={lbl} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 10px", background:"rgba(255,255,255,0.03)", borderRadius:8 }}>
                      <span style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"var(--text-muted)" }}>
                        <i className={`ti ${ico}`} />{lbl}
                      </span>
                      <span style={{ fontWeight:700, fontSize:13 }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:120, color:"var(--text-muted)", fontSize:13 }}>
                <i className="ti ti-loader-2 spin" style={{ marginRight:8 }} /> Loading…
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ fontSize:10, color:"var(--text-muted)", textAlign:"center", marginTop:16 }}>
        Open-Meteo · updated every 15 min
      </div>
    </div>
  );
}

/* ─── MyFlightRight ─── */
function MyFlightRight({ onLog, myFlight }: { onLog:(m:string,ok?:boolean)=>void; myFlight: MyFlightState }) {
  const { input, setInput, loading, detail, error, search } = myFlight;
  const depWx = useAirportWeather(detail?.departure.iata ?? "");
  const arrWx = useAirportWeather(detail?.arrival.iata ?? "");

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

      {/* ── Weather section ── */}
      {detail && (depWx || arrWx) && (
        <>
          <div className="section-title" style={{ marginTop:4, marginBottom:8 }}>Condiții meteo</div>
          {([{ iata: detail.departure.iata, wx: depWx, label: "La plecare" },
             { iata: detail.arrival.iata,   wx: arrWx, label: "La sosire"  }] as const).map(({ iata, wx, label }) => (
            <div key={iata} style={{ background:"var(--bg-body)", border:"1px solid var(--border-color)", borderRadius:10, padding:"10px 12px", marginBottom:8 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                <span style={{ fontSize:11, color:"var(--text-muted)", fontWeight:600 }}>{label} · {iata}</span>
                <span style={{ fontSize:20 }}>{wx?.emoji ?? "…"}</span>
              </div>
              {wx ? (
                <div className="stats-list">
                  <div className="stat-item">
                    <span className="stat-label"><i className="ti ti-temperature" style={{ marginRight:3 }} />Temperatură</span>
                    <span className="stat-value" style={{ fontWeight:700 }}>{wx.tempC}°C</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Simte ca</span>
                    <span className="stat-value">{wx.apparentC}°C</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label"><i className="ti ti-wind" style={{ marginRight:3 }} />Vânt</span>
                    <span className="stat-value">{wx.windKt} kt</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">💧 Umiditate</span>
                    <span className="stat-value">{wx.humidity}%</span>
                  </div>
                  {wx.precip > 0 && (
                    <div className="stat-item">
                      <span className="stat-label">🌧️ Precipitații</span>
                      <span className="stat-value" style={{ color:"var(--info)" }}>{wx.precip} mm</span>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize:11, color:"var(--text-muted)" }}>Se încarcă…</div>
              )}
            </div>
          ))}
        </>
      )}

      <div style={{ borderTop:"1px solid var(--border-color)", margin:"16px 0" }} />
    </>
  );
}

/* ═══════════════════════════ LOGIN MODAL ═══════════════════════════ */
function LoginModal({ onLogin }: { onLogin: (a: AuthState) => void }) {
  const [tab, setTab] = useState<"admin" | "passenger">("passenger");
  const [adminUser, setAdminUser] = useState("admin");
  const [adminPass, setAdminPass] = useState("admin");
  const [phone, setPhone] = useState("+40721000001");
  const [iata, setIata] = useState("LH6381");
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
            <div className="brand-title">AirHack</div>
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
/* ═══════════════════════════ NOTIF PANEL ═══════════════════════════ */
function formatAnnouncementTime(time: string): string {
  try {
    const d = new Date(time);
    if (isNaN(d.getTime())) return time; // fallback for old HH:MM format
    return d.toLocaleString("ro", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return time; }
}

function NotifPanel({
  open, onClose, role, announcements,
}: {
  open: boolean;
  onClose: () => void;
  role: "admin" | "passenger";
  announcements: Announcement[];
}) {
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || sending) return;
    setSending(true);
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText.trim(), type: "warning" }),
      });
      setInputText("");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await fetch("/api/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          style={{ position:"fixed", inset:0, zIndex:300, background:"rgba(0,0,0,0.45)", backdropFilter:"blur(2px)" }}
        />
      )}
      <div style={{
        position:"fixed", top:0, right:0, bottom:0,
        width:"min(380px, 100vw)",
        zIndex:301,
        background:"var(--bg-card)",
        borderLeft:"1px solid var(--border-color)",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition:"transform 0.28s cubic-bezier(.4,0,.2,1)",
        display:"flex", flexDirection:"column",
        overflow:"hidden",
      }}>
        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"18px 20px", borderBottom:"1px solid var(--border-color)", flexShrink:0 }}>
          <div style={{ fontSize:15, fontWeight:700, display:"flex", alignItems:"center", gap:8 }}>
            <i className="ti ti-bell" style={{ color:"var(--brand)" }} />
            Notificări
            {announcements.length > 0 && (
              <span style={{ fontSize:11, background:"var(--danger)", color:"#fff", borderRadius:10, padding:"1px 7px", fontWeight:700 }}>
                {announcements.length}
              </span>
            )}
          </div>
          <button className="btn-theme-toggle" onClick={onClose} title="Închide">
            <i className="ti ti-x" />
          </button>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:16, display:"flex", flexDirection:"column", gap:12 }}>
          {/* Admin: compose form */}
          {role === "admin" && (
            <div style={{ padding:14, background:"var(--bg-body)", border:"1px solid var(--border-color)", borderRadius:"var(--radius-md)" }}>
              <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:10, fontWeight:600, textTransform:"uppercase", letterSpacing:1, display:"flex", alignItems:"center", gap:6 }}>
                <i className="ti ti-megaphone" style={{ color:"var(--brand)" }} />Emite anunț
              </div>
              <form onSubmit={handleSend} style={{ display:"flex", flexDirection:"column", gap:8 }}>
                <textarea
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder="Scrie un anunț pentru pasageri..."
                  style={{
                    width:"100%", height:72,
                    background:"var(--bg-hover)",
                    border:"1px solid var(--border-color)",
                    borderRadius:"var(--radius-md)",
                    color:"var(--text-main)",
                    padding:"8px 10px",
                    fontSize:13,
                    resize:"none",
                    boxSizing:"border-box",
                    fontFamily:"inherit",
                  }}
                />
                <button type="submit" disabled={sending} className="btn-primary" style={{ alignSelf:"flex-end", padding:"7px 16px", display:"flex", alignItems:"center", gap:6 }}>
                  <i className={`ti ti-${sending ? "loader-2 spin" : "send"}`} /> Trimite
                </button>
              </form>
            </div>
          )}

          {/* Announcement list */}
          <div style={{ fontSize:11, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:1 }}>
            {announcements.length === 0 ? "Nicio notificare" : `${announcements.length} anunț${announcements.length !== 1 ? "uri" : ""} activ${announcements.length !== 1 ? "e" : ""}`}
          </div>
          {announcements.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 0", color:"var(--text-muted)" }}>
              <i className="ti ti-bell-off" style={{ fontSize:42, opacity:0.15, display:"block", marginBottom:10 }} />
              <div style={{ fontSize:13 }}>Nicio notificare activă</div>
            </div>
          ) : (
            announcements.map(a => (
              <div key={a.id} style={{
                padding:"12px 14px",
                background:"var(--bg-body)",
                borderRadius:"var(--radius-md)",
                border:"1px solid var(--border-color)",
                borderLeft:`4px solid var(--${a.type})`,
                display:"flex", alignItems:"flex-start", gap:10,
              }}>
                <div style={{ flex:1 }}>
                  {a.sender && (
                    <div style={{ fontSize:10, color:"var(--brand)", fontWeight:700, textTransform:"uppercase", letterSpacing:0.5, marginBottom:4 }}>
                      <i className="ti ti-user-shield" style={{ marginRight:4 }} />{a.sender}
                    </div>
                  )}
                  <div style={{ fontSize:13, fontWeight:500 }}>{a.text}</div>
                  <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:5 }}>{formatAnnouncementTime(a.time)}</div>
                </div>
                {role === "admin" && (
                  <button
                    onClick={() => handleDelete(a.id)}
                    disabled={deletingId === a.id}
                    title="Șterge anunț"
                    style={{
                      flexShrink:0, width:26, height:26,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      background:"transparent",
                      border:"1px solid var(--border-color)",
                      borderRadius:6, cursor:"pointer",
                      color:"var(--text-muted)",
                      fontSize:12,
                      opacity: deletingId === a.id ? 0.4 : 1,
                    }}
                  >
                    <i className={`ti ti-${deletingId === a.id ? "loader-2 spin" : "trash"}`} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════ TOP BAR ═══════════════════════════ */
function TopBar({
  auth, drawerOpen, setDrawerOpen, notifOpen, setNotifOpen, unreadCount, onLogout,
}: {
  auth: AuthState;
  drawerOpen: boolean; setDrawerOpen: (v: boolean) => void;
  notifOpen: boolean; setNotifOpen: (v: boolean) => void;
  unreadCount: number;
  onLogout: () => void;
}) {
  return (
    <div className="top-bar">
      {/* Left: hamburger + wifi icon */}
      <button
        className="hamburger-float top-bar-hamburger"
        onClick={() => setDrawerOpen(!drawerOpen)}
        title="Meniu"
      >
        <i className="ti ti-menu-2" />
      </button>
      <div className="brand-icon" style={{ width:28, height:28, fontSize:14 }}>
        <i className="ti ti-wifi" />
      </div>

      <div style={{ flex:1 }} />

      {/* Right: role · name · bell · logout */}
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
        onClick={() => { setNotifOpen(!notifOpen); }}
        title="Notificări"
        style={{ position:"relative" }}
      >
        <i className="ti ti-bell" />
        {unreadCount > 0 && auth.role !== "admin" && (
          <span style={{
            position:"absolute", top:2, right:2,
            width:16, height:16, borderRadius:"50%",
            background:"var(--danger)", color:"#fff",
            fontSize:9, fontWeight:700,
            display:"flex", alignItems:"center", justifyContent:"center",
            lineHeight:1,
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      <button className="btn-theme-toggle" onClick={onLogout} title="Deconectare">
        <i className="ti ti-logout" />
      </button>
    </div>
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


function AdminCenter({ onLog }: { onLog:(m:string,ok?:boolean)=>void }) {
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || sending) return;
    setSending(true);
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText.trim(), type: "warning" }),
      });
      onLog(`[ADMIN] Anunț trimis: "${inputText.trim()}"`);
      setInputText("");
    } finally {
      setSending(false);
    }
  };
  return (
    <div style={{ padding:20 }}>
      <h2><i className="ti ti-settings-automation"/> Control Panel Admin</h2>
      <div style={{ padding:15, background:"rgba(255,255,255,0.02)", borderRadius:8, marginTop:20 }}>
        <h3>Emite Anunț Pasageri</h3>
        <form onSubmit={handleBroadcast} style={{ marginTop:10 }}>
          <textarea value={inputText} onChange={e => setInputText(e.target.value)} placeholder="Scrie un anunț..."
            style={{ width:"100%", height:70, background:"#111", border:"1px solid #333", borderRadius:4, color:"#fff", padding:8, boxSizing:"border-box" }}/>
          <button type="submit" disabled={sending} style={{ background:"var(--brand)", color:"#fff", border:"none", padding:"6px 14px", borderRadius:4, marginTop:10, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:6 }}>
            <i className={`ti ti-${sending ? "loader-2 spin" : "send"}`} /> Trimite pe Monitor
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
            {a.sender && (
              <div style={{ fontSize:10, color:"var(--brand)", fontWeight:700, textTransform:"uppercase", letterSpacing:0.5, marginBottom:6 }}>
                <i className="ti ti-user-shield" style={{ marginRight:4 }} />{a.sender}
              </div>
            )}
            <p style={{ margin:0, fontSize:14, fontWeight:500 }}>{a.text}</p>
            <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:5 }}>{formatAnnouncementTime(a.time)}</div>
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
  const apis = [
    { name:"Device Location",    endpoint:"camara/location-retrieval/v0.3",      status:"UP", latency:"142ms", calls:1240 },
    { name:"Population Density", endpoint:"camara/population-density-data/v0.2", status:"UP", latency:"89ms",  calls:432  },
    { name:"Number Verification",endpoint:"camara/number-verification/v1",        status:"UP", latency:"201ms", calls:87   },
  ];
  return (
    <div style={{ padding:20, overflowY:"auto" }}>
      <h2 style={{ marginBottom:20 }}><i className="ti ti-settings"/> Settings</h2>

      {/* About */}
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:11, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>About</div>
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {([
            ["Application",        "AirHack 2026"            ],
            ["Version",            "1.0.0"                   ],
            ["Data mode",          "Fixture (mock data active)"],
            ["Interface language", "Romanian"                ],
            ["Refresh interval",   "30 seconds"              ],
          ] as [string,string][]).map(([l,v]) => (
            <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"10px 14px", background:"var(--bg-body)", border:"1px solid var(--border-color)", borderRadius:"var(--radius-md)" }}>
              <span style={{ color:"var(--text-muted)", fontSize:13 }}>{l}</span>
              <span style={{ fontWeight:600, fontSize:13 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* API Status */}
      <div>
        <div style={{ fontSize:11, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>API Status · Orange CAMARA</div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
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
    </div>
  );
}


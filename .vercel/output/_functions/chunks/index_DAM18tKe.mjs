import { c as createComponent } from './astro-component_BB8qJi4W.mjs';
import 'piccolore';
import { k as renderTemplate, o as renderComponent, p as renderHead, q as defineScriptVars } from './entrypoint_CjQVvv5j.mjs';
import { jsxs, jsx, Fragment } from 'react/jsx-runtime';
import { useState, useEffect, useRef } from 'react';

const CTRL = [
  { x: 8173, y: 3867, lat: 47.174432, lng: 27.61933 },
  // Intrare T4
  { x: 8133, y: 2927, lat: 47.174512, lng: 27.619394 },
  // Check-in 1
  { x: 8858, y: 2927, lat: 47.174452, lng: 27.619414 },
  // Check-in 5
  { x: 9502, y: 2900, lat: 47.174341, lng: 27.619515 },
  // Check-in 10
  { x: 8911, y: 3947, lat: 47.174513, lng: 27.619255 }
  // Baza Scări
];
function solve3(pts, getZ) {
  let AtA = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  let Atb = [0, 0, 0];
  for (const p of pts) {
    const row = [p.x, p.y, 1];
    const z = getZ(p);
    for (let i = 0; i < 3; i++) {
      Atb[i] += row[i] * z;
      for (let j = 0; j < 3; j++) AtA[i][j] += row[i] * row[j];
    }
  }
  function det(m) {
    return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  }
  const D2 = det(AtA);
  return [0, 1, 2].map((i) => {
    const M = AtA.map((r) => [...r]);
    for (let r = 0; r < 3; r++) M[r][i] = Atb[r];
    return det(M) / D2;
  });
}
const [A, B, C] = solve3(CTRL, (p) => p.lat);
const [D, E, F] = solve3(CTRL, (p) => p.lng);
const [a, b, c] = solve3(
  CTRL.map((p) => ({ x: p.lat, y: p.lng, lat: p.x, lng: p.y })),
  (p) => p.lat
);
const [d, e, f] = solve3(
  CTRL.map((p) => ({ x: p.lat, y: p.lng, lat: p.x, lng: p.y })),
  (p) => p.lng
);

const MOCK_CLIENTS = [
  { phone: "+40721000001", flightIata: "RO321", personId: "misu", displayName: "Mihai Popescu" },
  { phone: "+40721000002", flightIata: "LH1407", personId: "ionica", displayName: "Ioana Constantin" },
  { phone: "+40721000003", flightIata: "FR8821", personId: "dorel", displayName: "Dorel Ionescu" },
  { phone: "+40721000004", flightIata: "W64102", personId: "misu", displayName: "Andrei Marin" },
  { phone: "+40721000005", flightIata: "AF1234", personId: "ionica", displayName: "Elena Dumitrescu" }
];
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin";
function normaliseIata(s) {
  return s.replace(/\s/g, "").toUpperCase();
}
function findClient(phone, flightIata) {
  const normIata = normaliseIata(flightIata);
  return MOCK_CLIENTS.find(
    (c) => c.phone === phone.trim() && normaliseIata(c.flightIata) === normIata
  ) ?? null;
}

const FLIGHTS = [
  { id: "1", gate: "4", flight: "RO 321", dest: "București OTP", departs: "23:15", color: "var(--success)" },
  { id: "2", gate: "2", flight: "W6 4102", dest: "Londra LTN", departs: "23:45", color: "var(--info)" },
  { id: "3", gate: "T3", flight: "LH 1407", dest: "Frankfurt FRA", departs: "00:10", color: "var(--warning)" },
  { id: "4", gate: "5", flight: "FR 8821", dest: "Milano BGY", departs: "00:30", color: "var(--brand)" },
  { id: "5", gate: "T3", flight: "AF 1234", dest: "Paris CDG", departs: "06:45", color: "var(--danger)" }
];
const GATE_LABELS = {
  "1": "Poarta 1",
  "2": "Poarta 2",
  "3": "Poarta 3",
  "4": "Poarta 4",
  "5": "Poarta 5",
  "6": "Poarta 6",
  "T3": "T3 Non-Schengen"
};
function Dashboard() {
  const [feature, setFeature] = useState("route");
  const [logs, setLogs] = useState([]);
  const [theme, setTheme] = useState("dark");
  const [weatherProvider, setWeatherProvider] = useState("open-meteo");
  const [activePerson, setActivePerson] = useState("you");
  const [announcements, setAnnouncements] = useState([
    { id: 1, type: "info", text: "Zborul RO 321 începe îmbarcarea la Poarta T4 (Dozator Apă).", time: "12:15" },
    { id: 2, type: "warning", text: "Aglomerare la Filtrul de Securitate (Masa Echipei). Timp estimat: 25 min.", time: "12:22" }
  ]);
  const [auth, setAuth] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  const addLog = (msg, ok = true) => setLogs((p) => [{ ts: (/* @__PURE__ */ new Date()).toLocaleTimeString("ro"), msg, ok }, ...p].slice(0, 30));
  const handleLogin = (a) => {
    setAuth(a);
    if (a.role === "passenger") {
      setActivePerson(a.personId);
      setFeature("route");
    } else {
      setActivePerson("you");
    }
  };
  return /* @__PURE__ */ jsxs("div", { id: "dashboard", className: auth ? "has-topbar" : "", children: [
    !auth && /* @__PURE__ */ jsx(LoginModal, { onLogin: handleLogin }),
    auth && /* @__PURE__ */ jsx(
      TopBar,
      {
        auth,
        theme,
        setTheme,
        drawerOpen,
        setDrawerOpen,
        onLogout: () => {
          setAuth(null);
          setDrawerOpen(false);
        }
      }
    ),
    /* @__PURE__ */ jsxs("div", { className: "dashboard-grid", children: [
      /* @__PURE__ */ jsx(
        LeftPanel,
        {
          feature,
          setFeature,
          theme,
          setTheme,
          logs,
          announcements,
          drawerOpen,
          setDrawerOpen,
          hasTopBar: !!auth,
          role: auth?.role ?? null
        }
      ),
      /* @__PURE__ */ jsx(CenterPanel, { feature, onLog: addLog, weatherProvider, activePerson, announcements, setAnnouncements, role: auth?.role ?? null }),
      /* @__PURE__ */ jsx(RightPanel, { feature, onLog: addLog, weatherProvider, setWeatherProvider })
    ] }),
    !auth && /* @__PURE__ */ jsx(BottomBar, { activePerson, setActivePerson })
  ] });
}
const NAV = [
  { id: "weather", icon: "ti-cloud-storm", label: "Vreme / METAR", sub: "LRIA · Open-Meteo · NOAA" },
  { id: "route", icon: "ti-route", label: "My Route", sub: "Device Location · Orange" },
  { id: "heatmap", icon: "ti-map-2", label: "Heatmap Terminal", sub: "Aglomerație zone" }
];
const USER_NAV = [
  { icon: "ti-user-circle", label: "Contul meu" },
  { icon: "ti-plane-departure", label: "Zborul meu" },
  { icon: "ti-bell", label: "Notificări" },
  { icon: "ti-settings", label: "Setări" },
  { icon: "ti-help-circle", label: "Ajutor" }
];
function LeftPanel({
  feature,
  setFeature,
  theme,
  setTheme,
  logs,
  announcements,
  drawerOpen,
  setDrawerOpen,
  hasTopBar,
  role
}) {
  const isPassenger = role === "passenger";
  const visibleNav = isPassenger ? NAV.filter((n) => n.id === "route") : NAV;
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    drawerOpen && /* @__PURE__ */ jsx(
      "div",
      {
        onClick: () => setDrawerOpen(false),
        style: {
          position: "fixed",
          inset: 0,
          zIndex: 200,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(2px)"
        }
      }
    ),
    !hasTopBar && /* @__PURE__ */ jsx(
      "button",
      {
        className: "hamburger-float",
        onClick: () => setDrawerOpen(true),
        title: "Meniu",
        children: /* @__PURE__ */ jsx("i", { className: "ti ti-menu-2" })
      }
    ),
    /* @__PURE__ */ jsxs("div", { className: `side-drawer${drawerOpen ? " open" : ""}`, children: [
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }, children: [
        /* @__PURE__ */ jsx("span", { style: { fontSize: 14, fontWeight: 600 }, children: "Meniu" }),
        /* @__PURE__ */ jsx("button", { className: "btn-theme-toggle", onClick: () => setDrawerOpen(false), title: "Închide", children: /* @__PURE__ */ jsx("i", { className: "ti ti-x" }) })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "section-title", children: "Navigare" }),
      /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }, children: visibleNav.map((n) => /* @__PURE__ */ jsxs(
        "button",
        {
          className: `btn-tab${feature === n.id ? " active" : ""}`,
          style: { justifyContent: "flex-start", flex: "unset", padding: "10px 12px" },
          onClick: () => {
            setFeature(n.id);
            setDrawerOpen(false);
          },
          children: [
            /* @__PURE__ */ jsx("i", { className: `ti ${n.icon}`, style: { fontSize: 17 } }),
            n.label
          ]
        },
        n.id
      )) }),
      /* @__PURE__ */ jsx("div", { className: "section-title", children: "Pasager" }),
      /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }, children: USER_NAV.map((n) => /* @__PURE__ */ jsxs(
        "button",
        {
          className: "btn-tab",
          style: { justifyContent: "flex-start", flex: "unset", padding: "10px 12px" },
          onClick: () => setDrawerOpen(false),
          children: [
            /* @__PURE__ */ jsx("i", { className: `ti ${n.icon}`, style: { fontSize: 17 } }),
            n.label
          ]
        },
        n.label
      )) }),
      logs.length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("div", { className: "section-title", children: "Activitate recentă" }),
        /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: 7 }, children: logs.slice(0, 8).map((l, i) => /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "flex-start", gap: 7, fontSize: 11, color: "var(--text-muted)" }, children: [
          /* @__PURE__ */ jsx("span", { style: { width: 6, height: 6, borderRadius: "50%", marginTop: 3, background: l.ok ? "var(--success)" : "var(--danger)", flexShrink: 0 } }),
          /* @__PURE__ */ jsx("span", { style: { flexShrink: 0 }, children: l.ts }),
          /* @__PURE__ */ jsx("span", { style: { color: l.ok ? "var(--text-main)" : "var(--danger)" }, children: l.msg })
        ] }, i)) })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "card sidebar-left", children: [
      /* @__PURE__ */ jsxs("div", { className: "brand-header", children: [
        /* @__PURE__ */ jsx("div", { className: "brand-icon", children: /* @__PURE__ */ jsx("i", { className: "ti ti-wifi" }) }),
        /* @__PURE__ */ jsxs("div", { style: { flex: 1 }, children: [
          /* @__PURE__ */ jsx("div", { className: "brand-title", children: "AirFlow Nexus" }),
          /* @__PURE__ */ jsx("div", { className: "brand-sub", children: "powered by Orange APIs" })
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            className: "btn-theme-toggle",
            onClick: () => setTheme(theme === "dark" ? "light" : "dark"),
            title: theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
            children: /* @__PURE__ */ jsx("i", { className: `ti ${theme === "dark" ? "ti-sun" : "ti-moon"}` })
          }
        )
      ] }),
      /* @__PURE__ */ jsx("div", { className: "section-title", children: "Funcționalități" }),
      /* @__PURE__ */ jsxs("div", { className: "api-list", children: [
        visibleNav.map((n) => /* @__PURE__ */ jsxs("div", { className: `api-card${feature === n.id ? " active" : ""}`, onClick: () => setFeature(n.id), children: [
          /* @__PURE__ */ jsxs("div", { className: "api-card-header", children: [
            /* @__PURE__ */ jsx("i", { className: `ti ${n.icon}` }),
            " ",
            n.label
          ] }),
          /* @__PURE__ */ jsx("div", { className: "api-val", children: n.sub }),
          /* @__PURE__ */ jsxs("div", { className: "api-status", children: [
            /* @__PURE__ */ jsx("span", { className: "dot green pulse-green" }),
            feature === n.id ? "Activ acum" : "Disponibil"
          ] })
        ] }, n.id)),
        !isPassenger && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("div", { style: { marginTop: 12 }, children: /* @__PURE__ */ jsx("div", { className: "section-title", children: "Status API Orange" }) }),
          [
            { icon: "ti-map-pin", label: "Device Location", val: "342 dispozitive", dot: "green", pulse: true },
            { icon: "ti-id-badge", label: "Number Verification", val: "12 verificări/oră", dot: "orange", pulse: false },
            { icon: "ti-bolt", label: "Quality on Demand", val: "2 sesiuni active", dot: "blue", pulse: false }
          ].map((a) => /* @__PURE__ */ jsxs("div", { className: "api-card", children: [
            /* @__PURE__ */ jsxs("div", { className: "api-card-header", children: [
              /* @__PURE__ */ jsx("i", { className: `ti ${a.icon}` }),
              " ",
              a.label
            ] }),
            /* @__PURE__ */ jsx("div", { className: "api-val", children: a.val }),
            /* @__PURE__ */ jsxs("div", { className: "api-status", children: [
              /* @__PURE__ */ jsx("span", { className: `dot ${a.dot}${a.pulse ? " pulse-green" : ""}` }),
              "Activ"
            ] })
          ] }, a.label)),
          /* @__PURE__ */ jsx("div", { style: { marginTop: 12 }, children: /* @__PURE__ */ jsx("div", { className: "section-title", children: "Operațiuni & Securitate" }) }),
          [
            { id: "flow-prediction", icon: "ti-clock-play", label: "Flow Prediction", sub: "Estimează ETA cozi" },
            { id: "boarding-verify", icon: "ti-shield-check", label: "Verificare Boarding", sub: "Prevenție fraudă SIM" },
            { id: "admin", icon: "ti-settings-automation", label: "Control Panel Admin", sub: "QoD & Gestiune crize" },
            { id: "announcements", icon: "ti-megaphone", label: "Anunțuri Pasageri", sub: `${announcements.length} alerte active` }
          ].map((n) => /* @__PURE__ */ jsxs("div", { className: `api-card${feature === n.id ? " active" : ""}`, onClick: () => setFeature(n.id), children: [
            /* @__PURE__ */ jsxs("div", { className: "api-card-header", children: [
              /* @__PURE__ */ jsx("i", { className: `ti ${n.icon}` }),
              " ",
              n.label
            ] }),
            /* @__PURE__ */ jsx("div", { className: "api-val", children: n.sub })
          ] }, n.id))
        ] })
      ] }),
      !isPassenger && /* @__PURE__ */ jsxs("div", { className: "alert-box", style: { marginTop: 12 }, children: [
        /* @__PURE__ */ jsxs("div", { className: "alert-title", children: [
          /* @__PURE__ */ jsx("i", { className: "ti ti-alert-triangle" }),
          " Alertă activă"
        ] }),
        /* @__PURE__ */ jsx("div", { className: "alert-desc", children: "Aglomerație poarta C3 — QoD alocat camere video." })
      ] })
    ] })
  ] });
}
function CenterPanel({
  feature,
  onLog,
  weatherProvider,
  activePerson,
  announcements,
  setAnnouncements,
  role
}) {
  const isPassenger = role === "passenger";
  return /* @__PURE__ */ jsxs("div", { className: "card main-center", children: [
    feature === "weather" && !isPassenger && /* @__PURE__ */ jsx(WeatherCenter, { onLog, provider: weatherProvider }),
    feature === "route" && /* @__PURE__ */ jsx(RouteCenter, { onLog, activePerson }),
    feature === "heatmap" && !isPassenger && /* @__PURE__ */ jsx(HeatmapCenter, { onLog }),
    feature === "flow-prediction" && /* @__PURE__ */ jsx(FlowPredictionCenter, { onLog }),
    feature === "boarding-verify" && /* @__PURE__ */ jsx(BoardingVerifyCenter, { activePerson, onLog }),
    feature === "admin" && activePerson === "you" && /* @__PURE__ */ jsx(AdminCenter, { onLog, setAnnouncements }),
    feature === "admin" && activePerson !== "you" && /* @__PURE__ */ jsx(AnnouncementsCenter, { announcements }),
    feature === "announcements" && /* @__PURE__ */ jsx(AnnouncementsCenter, { announcements }),
    feature === "status-api" && /* @__PURE__ */ jsx(StatusApiCenter, {}),
    feature === "account" && /* @__PURE__ */ jsx(AccountCenter, { activePerson }),
    feature === "settings" && /* @__PURE__ */ jsx(SettingsCenter, {})
  ] });
}
const RWY_HDG = { "08": 80, "26": 260 };
function calcWindComponents(windDir, windSpd, rwyHdg) {
  const angle = (windDir - rwyHdg) * Math.PI / 180;
  return {
    headwind: Math.round(windSpd * Math.cos(angle)),
    crosswind: Math.round(Math.abs(windSpd * Math.sin(angle)))
  };
}
function densityAltitude(qnh, elevFt, tempC) {
  const pressureAltFt = elevFt + (1013.25 - qnh) * 30;
  const isaTemp = 15 - 2 * (pressureAltFt / 1e3);
  return Math.round(pressureAltFt + 120 * (tempC - isaTemp));
}
function dewSpread(tempC, dewC) {
  const spread = tempC - dewC;
  if (spread <= 2) return { label: "Risc ceață ridicat", color: "var(--danger)" };
  if (spread <= 5) return { label: "Risc ceață moderat", color: "var(--warning)" };
  return { label: "Risc ceață scăzut", color: "var(--success)" };
}
const CAT_COL = {
  VFR: "var(--success)",
  MVFR: "var(--info)",
  IFR: "var(--warning)",
  LIFR: "var(--danger)"
};
const CAT_LABEL = {
  VFR: "Visual Flight Rules",
  MVFR: "Marginal VFR",
  IFR: "Instrument Rules",
  LIFR: "Low IFR"
};
const COVER_PCT = { SKC: 0, CLR: 0, FEW: 25, SCT: 50, BKN: 75, OVC: 100, VV: 100 };
const PHENOM_LABEL = {
  TS: "Furtună",
  TSRA: "Furtună cu ploaie",
  RA: "Ploaie",
  SN: "Ninsoare",
  FG: "Ceață",
  BR: "Burniță",
  DZ: "Burnă",
  GR: "Grindină",
  SHRA: "Aversă ploaie",
  SHSN: "Aversă ninsoare",
  "-RA": "Ploaie ușoară",
  "+RA": "Ploaie intensă",
  "-SN": "Ninsoare ușoară",
  "+TS": "Furtună severă"
};
function InfoCard({ label, value, sub, color, icon }) {
  return /* @__PURE__ */ jsxs("div", { style: { background: "var(--bg-body)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", padding: "12px" }, children: [
    /* @__PURE__ */ jsxs("div", { style: { fontSize: 11, color: "var(--text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }, children: [
      icon && /* @__PURE__ */ jsx("i", { className: `ti ${icon}`, style: { fontSize: 13 } }),
      " ",
      label
    ] }),
    /* @__PURE__ */ jsx("div", { style: { fontSize: 17, fontWeight: 700, color: color ?? "var(--text-main)", lineHeight: 1.2 }, children: value }),
    sub && /* @__PURE__ */ jsx("div", { style: { fontSize: 11, color: "var(--text-muted)", marginTop: 3 }, children: sub })
  ] });
}
function SectionTitle({ children }) {
  return /* @__PURE__ */ jsx("div", { className: "section-title", style: { marginTop: 16, marginBottom: 8 }, children });
}
const PROVIDER_LABELS = {
  "open-meteo": "Open-Meteo",
  "openweathermap": "OpenWeatherMap",
  "meteoblue": "Meteoblue",
  "accuweather": "AccuWeather"
};
function WeatherCenter({ onLog, provider }) {
  const [w, setW] = useState(null);
  const [m, setM] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rwy, setRwy] = useState("08");
  const wCache = useRef({});
  const mCache = useRef(null);
  const load = async () => {
    if (wCache.current[provider]) {
      setW(wCache.current[provider]);
      if (mCache.current) setM(mCache.current);
      return;
    }
    setLoading(true);
    try {
      const metarPromise = mCache.current ? Promise.resolve(mCache.current) : fetch("/api/metar?station=LRIA").then((r) => r.json());
      const [wd, md] = await Promise.all([
        fetch(`/api/weather-provider?provider=${provider}`).then((r) => r.json()),
        metarPromise
      ]);
      wCache.current[provider] = wd;
      mCache.current = md;
      setW(wd);
      setM(md);
      onLog(`${PROVIDER_LABELS[provider]} · ${md.flightCategory} · ${md.wind?.speedKt}kt ${md.wind?.directionDeg}°`);
    } catch {
      onLog("Eroare fetch meteo", false);
    } finally {
      setLoading(false);
    }
  };
  const handleRefresh = () => {
    if (w?.fromFixture) return;
    delete wCache.current[provider];
    mCache.current = null;
    load();
  };
  useEffect(() => {
    load();
  }, [provider]);
  const cat = m?.flightCategory ?? "VFR";
  const catColor = CAT_COL[cat] ?? "var(--success)";
  const wind = m?.wind;
  const temp = m?.temperature;
  const qnh = m?.altimeter?.qnhHpa ?? 1013;
  const wComponents = wind ? calcWindComponents(wind.directionDeg, wind.speedKt, RWY_HDG[rwy]) : null;
  const da = temp ? densityAltitude(qnh, 321, temp.tempC) : null;
  const spread = temp ? dewSpread(temp.tempC, temp.dewpointC) : null;
  const relHumidity = temp ? Math.round(100 - 5 * (temp.tempC - temp.dewpointC)) : null;
  const ceiling = m?.clouds?.find((c) => c.cover === "BKN" || c.cover === "OVC" || c.cover === "VV");
  const visM = m?.visibility?.meters ?? 9999;
  const visText = m?.visibility?.unlimited ? "> 10 km" : visM >= 1e3 ? `${(visM / 1e3).toFixed(1)} km` : `${visM} m`;
  return /* @__PURE__ */ jsxs("div", { style: { padding: 20, height: "100%", display: "flex", flexDirection: "column", overflowY: "auto", gap: 0 }, children: [
    /* @__PURE__ */ jsxs("div", { className: "map-header", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("div", { className: "map-title", children: "Briefing Meteorologic — LRIA Iași" }),
        /* @__PURE__ */ jsxs("div", { style: { fontSize: 11, color: "var(--text-muted)", marginTop: 2 }, children: [
          /* @__PURE__ */ jsx("span", { style: { color: "var(--brand)", fontWeight: 600 }, children: PROVIDER_LABELS[provider] }),
          " · ",
          m?.observedAt ? new Date(m.observedAt).toLocaleString("ro", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }) : "—",
          " UTC",
          (w?.fromFixture || m?.fromFixture) && /* @__PURE__ */ jsx("span", { style: { marginLeft: 8, color: "var(--warning)" }, children: "· fixture" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "badges", children: [
        /* @__PURE__ */ jsx("div", { className: "badge", style: { background: `${catColor}22`, color: catColor, border: `1px solid ${catColor}44`, fontSize: 13, fontWeight: 700, padding: "6px 14px" }, children: cat }),
        /* @__PURE__ */ jsx("button", { onClick: handleRefresh, disabled: w?.fromFixture, title: w?.fromFixture ? "Fixture — no re-fetch in test mode" : "Refresh", style: { background: "var(--bg-hover)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", color: w?.fromFixture ? "var(--border-color)" : "var(--text-muted)", padding: "6px 12px", cursor: w?.fromFixture ? "default" : "pointer", fontSize: 12 }, children: /* @__PURE__ */ jsx("i", { className: `ti ti-refresh${loading ? " spin" : ""}` }) })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { background: `${catColor}15`, border: `1px solid ${catColor}44`, borderRadius: "var(--radius-md)", padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }, children: [
      /* @__PURE__ */ jsx("span", { style: { fontWeight: 700, color: catColor, fontSize: 15 }, children: cat }),
      /* @__PURE__ */ jsx("span", { style: { color: catColor, fontSize: 13 }, children: CAT_LABEL[cat] }),
      /* @__PURE__ */ jsx("span", { style: { marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" }, children: m?.phenomena && m.phenomena.length > 0 ? m.phenomena.map((p) => PHENOM_LABEL[p] ?? p).join(", ") : "Fără fenomene semnificative" })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "metar-raw", style: { marginTop: 12 }, children: m?.raw ?? "Se încarcă METAR..." }),
    /* @__PURE__ */ jsx(SectionTitle, { children: "Vânt & Componente Pistă" }),
    /* @__PURE__ */ jsxs("div", { className: "info-grid", children: [
      /* @__PURE__ */ jsx(
        InfoCard,
        {
          icon: "ti-wind",
          label: "Direcție / Viteză",
          value: wind?.isVariable ? `VRB ${wind.speedKt}kt` : `${wind?.directionDeg}° / ${wind?.speedKt}kt`,
          sub: wind?.gustKt ? `Rafale G${wind.gustKt}kt` : "Fără rafale",
          color: wind?.gustKt && wind.gustKt > 25 ? "var(--danger)" : void 0
        }
      ),
      /* @__PURE__ */ jsx(
        InfoCard,
        {
          icon: "ti-arrow-up",
          label: "Headwind / Tailwind",
          value: wComponents ? `${wComponents.headwind >= 0 ? "HW" : "TW"} ${Math.abs(wComponents.headwind)}kt` : "—",
          sub: `Pistă ${rwy} (${RWY_HDG[rwy]}°)`,
          color: wComponents && Math.abs(wComponents.headwind) > 20 ? "var(--warning)" : void 0
        }
      ),
      /* @__PURE__ */ jsx(
        InfoCard,
        {
          icon: "ti-arrow-right",
          label: "Crosswind",
          value: wComponents ? `${wComponents.crosswind}kt` : "—",
          sub: wComponents && wComponents.crosswind > 15 ? "⚠ Depășit limită tipică" : "În limite normale",
          color: wComponents && wComponents.crosswind > 15 ? "var(--danger)" : wComponents && wComponents.crosswind > 10 ? "var(--warning)" : "var(--success)"
        }
      ),
      /* @__PURE__ */ jsxs("div", { style: { background: "var(--bg-body)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", padding: "12px", display: "flex", flexDirection: "column", gap: 6 }, children: [
        /* @__PURE__ */ jsx("div", { style: { fontSize: 11, color: "var(--text-muted)" }, children: "Pistă activă" }),
        ["08", "26"].map((r) => /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: () => setRwy(r),
            style: { padding: "5px 8px", borderRadius: 6, border: `1px solid ${rwy === r ? "var(--brand)" : "var(--border-color)"}`, background: rwy === r ? "rgba(255,102,0,0.15)" : "transparent", color: rwy === r ? "var(--brand)" : "var(--text-muted)", cursor: "pointer", fontSize: 12, fontWeight: 600, textAlign: "left" },
            children: [
              "RWY ",
              r,
              " — ",
              RWY_HDG[r],
              "°"
            ]
          },
          r
        ))
      ] })
    ] }),
    /* @__PURE__ */ jsx(SectionTitle, { children: "Vizibilitate & Plafon Noros" }),
    /* @__PURE__ */ jsxs("div", { className: "info-grid", children: [
      /* @__PURE__ */ jsx(
        InfoCard,
        {
          icon: "ti-eye",
          label: "Vizibilitate",
          value: visText,
          color: visM < 1e3 ? "var(--danger)" : visM < 3e3 ? "var(--warning)" : "var(--success)",
          sub: visM < 1500 ? "⚠ Sub minime IFR" : visM < 5e3 ? "Operare instrument" : "VFR OK"
        }
      ),
      /* @__PURE__ */ jsx(
        InfoCard,
        {
          icon: "ti-cloud",
          label: "Plafon (Ceiling)",
          value: ceiling ? `${ceiling.cover} ${ceiling.baseFt.toLocaleString()}'` : "SKC / No ceiling",
          sub: ceiling ? `${Math.round(ceiling.baseFt * 0.3048)} m AMSL${ceiling.type ? ` · ${ceiling.type}` : ""}` : "Cer senin",
          color: ceiling && ceiling.baseFt < 500 ? "var(--danger)" : ceiling && ceiling.baseFt < 1500 ? "var(--warning)" : "var(--success)"
        }
      ),
      m?.clouds?.map((c, i) => /* @__PURE__ */ jsxs("div", { style: { background: "var(--bg-body)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", padding: "12px" }, children: [
        /* @__PURE__ */ jsxs("div", { style: { fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }, children: [
          "Strat nor ",
          i + 1
        ] }),
        /* @__PURE__ */ jsxs("div", { style: { fontSize: 16, fontWeight: 700 }, children: [
          c.cover,
          " ",
          c.baseFt.toLocaleString(),
          "'"
        ] }),
        /* @__PURE__ */ jsx("div", { style: { marginTop: 6, height: 4, background: "var(--bg-hover)", borderRadius: 2, overflow: "hidden" }, children: /* @__PURE__ */ jsx("div", { style: { width: `${COVER_PCT[c.cover] ?? 0}%`, height: "100%", background: "var(--info)", borderRadius: 2 } }) }),
        /* @__PURE__ */ jsxs("div", { style: { fontSize: 11, color: "var(--text-muted)", marginTop: 3 }, children: [
          COVER_PCT[c.cover],
          "% acoperire",
          c.type ? ` · ${c.type}` : ""
        ] })
      ] }, i))
    ] }),
    /* @__PURE__ */ jsx(SectionTitle, { children: "Temperatură, Presiune & Performanță" }),
    /* @__PURE__ */ jsxs("div", { className: "info-grid", children: [
      /* @__PURE__ */ jsx(
        InfoCard,
        {
          icon: "ti-temperature",
          label: "Temperatură / Dew",
          value: temp ? `${temp.tempC > 0 ? "+" : ""}${temp.tempC}°C / ${temp.dewpointC}°C` : "—",
          sub: `Spread ${temp ? temp.tempC - temp.dewpointC : "—"}°C`
        }
      ),
      /* @__PURE__ */ jsx(
        InfoCard,
        {
          icon: "ti-droplet",
          label: "Umiditate relativă",
          value: `${relHumidity ?? "—"}%`,
          sub: spread?.label,
          color: spread?.color
        }
      ),
      /* @__PURE__ */ jsx(
        InfoCard,
        {
          icon: "ti-gauge",
          label: "QNH",
          value: `${qnh} hPa`,
          sub: `${(qnh * 0.02953).toFixed(2)} inHg · ${qnh > 1013 ? "↑ Anticiclon" : qnh < 1005 ? "↓ Depresiune" : "Presiune normală"}`,
          color: qnh < 995 ? "var(--danger)" : qnh < 1005 ? "var(--warning)" : void 0
        }
      ),
      /* @__PURE__ */ jsx(
        InfoCard,
        {
          icon: "ti-mountain",
          label: "Density Altitude",
          value: da !== null ? `${da.toLocaleString()} ft` : "—",
          sub: `Elev. LRIA: 321ft · ${da !== null && da > 5e3 ? "⚠ Performanță redusă" : "Normal"}`,
          color: da !== null && da > 5e3 ? "var(--warning)" : void 0
        }
      )
    ] }),
    m?.trend && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(SectionTitle, { children: "Tendință (Trend)" }),
      /* @__PURE__ */ jsxs("div", { style: { background: "var(--bg-body)", border: `1px solid ${m.trend.type === "NOSIG" ? "var(--success)" : "var(--warning)"}`, borderRadius: "var(--radius-md)", padding: "12px", flexShrink: 0 }, children: [
        /* @__PURE__ */ jsx("div", { style: { fontWeight: 700, color: m.trend.type === "NOSIG" ? "var(--success)" : "var(--warning)", marginBottom: 4 }, children: m.trend.type === "NOSIG" ? "NOSIG — Nicio schimbare semnificativă" : m.trend.type }),
        m.trend.type !== "NOSIG" && /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: "var(--text-muted)" }, children: m.trend.phenomena?.map((p) => PHENOM_LABEL[p] ?? p).join(", ") })
      ] })
    ] }),
    m?.warning && /* @__PURE__ */ jsxs("div", { style: { marginTop: 12, background: "var(--warning-bg)", border: "1px solid var(--warning)", borderRadius: "var(--radius-md)", padding: "10px 14px", fontSize: 12, color: "var(--warning)", flexShrink: 0 }, children: [
      /* @__PURE__ */ jsx("i", { className: "ti ti-alert-triangle", style: { marginRight: 6 } }),
      m.warning
    ] })
  ] });
}
const CAL_KEY = "svg_cal_v1";
function solveAffine(pts) {
  if (pts.length < 3) return null;
  function solve(getZ) {
    let s10 = 0, s01 = 0, s20 = 0, s11 = 0, s02 = 0, sz0 = 0, sz1 = 0, sz2 = 0;
    for (const p of pts) {
      s10 += p.svgX;
      s01 += p.svgY;
      s20 += p.svgX ** 2;
      s11 += p.svgX * p.svgY;
      s02 += p.svgY ** 2;
      const z = getZ(p);
      sz0 += z;
      sz1 += z * p.svgX;
      sz2 += z * p.svgY;
    }
    const n = pts.length;
    const M = [[s20, s11, s10], [s11, s02, s01], [s10, s01, n]];
    const b = [sz1, sz2, sz0];
    const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    const D2 = det(M);
    if (Math.abs(D2) < 1e-15) return [0, 0, 0];
    return [0, 1, 2].map((i) => {
      const N = M.map((r) => [...r]);
      for (let r = 0; r < 3; r++) N[r][i] = b[r];
      return det(N) / D2;
    });
  }
  const [A, B, C] = solve((p) => p.lat);
  const [D, E, F] = solve((p) => p.lng);
  return { A, B, C, D, E, F };
}
function svgFromGps(t, lat, lng) {
  const det = t.A * t.E - t.B * t.D;
  if (Math.abs(det) < 1e-20) return { x: 0, y: 0 };
  return {
    x: (t.E * (lat - t.C) - t.B * (lng - t.F)) / det,
    y: (t.A * (lng - t.F) - t.D * (lat - t.C)) / det
  };
}
const defaultPoints = [
  { svgX: 852, svgY: 349, lat: 47.17439229, lng: 27.61903507 },
  // control check / masa echipei
  { svgX: 2244, svgY: 256, lat: 47.1740641, lng: 27.619701 },
  // destinație pasageri / dozator
  { svgX: 100, svgY: 500, lat: 47.1746, lng: 27.6185 }
  // colț stânga-jos (estimat)
];
function loadCalibration() {
  try {
    const raw = localStorage.getItem(CAL_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.points?.length >= 3) return saved;
    }
  } catch {
  }
  if (defaultPoints.length >= 3) return { points: defaultPoints, transform: solveAffine(defaultPoints) };
  return { points: [], transform: null };
}
function saveCalibration(points, transform) {
  localStorage.setItem(CAL_KEY, JSON.stringify({ points, transform }));
}
const SVG_SECURITY = { x: 852, y: 349 };
const SVG_GATE = { x: 2244, y: 256 };
const SVG_STARTS = {
  you: { x: 150, y: 500 },
  misu: { x: 400, y: 480 },
  ionica: { x: 150, y: 150 },
  dorel: { x: 400, y: 150 }
};
const GATE_SVG = {
  "1": SVG_GATE,
  "2": SVG_GATE,
  "3": SVG_GATE,
  "4": SVG_GATE,
  "5": SVG_GATE,
  "6": SVG_GATE,
  "T3": SVG_GATE
};
function makeRoute(personId) {
  const s = SVG_STARTS[personId] ?? { x: 150, y: 500 };
  return [s, SVG_SECURITY, { x: 1600, y: 300 }, SVG_GATE];
}
const ROUTE_SVG = {
  "1": makeRoute("you"),
  "2": makeRoute("misu"),
  "3": makeRoute("ionica"),
  "4": makeRoute("dorel"),
  "5": makeRoute("you"),
  "6": makeRoute("you"),
  "T3": makeRoute("you")
};
const PEOPLE = [
  { id: "you", name: "You", flightId: "1", color: "#38BDF8" },
  { id: "misu", name: "Misu", flightId: "2", color: "#F97316" },
  { id: "ionica", name: "Ionica", flightId: "3", color: "#A78BFA" },
  { id: "dorel", name: "Dorel", flightId: "4", color: "#34D399" }
];
const PHONE_PERSONS = {
  "+40721000001": "misu",
  "+40721000002": "ionica",
  "+40721000003": "dorel"
};
const GATE_ETA_MIN = {
  "1": 5,
  "2": 6,
  "3": 7,
  "4": 8,
  "5": 10,
  "6": 12,
  "T3": 15
};
function RouteCenter({ onLog, activePerson }) {
  const [positions, setPositions] = useState({
    you: SVG_STARTS.you,
    misu: SVG_STARTS.misu,
    ionica: SVG_STARTS.ionica,
    dorel: SVG_STARTS.dorel
  });
  const [locLoading, setLocLoading] = useState(false);
  const [pixelLog, setPixelLog] = useState(false);
  const [hoverPos, setHoverPos] = useState(null);
  const [pixelEntries, setPixelEntries] = useState([]);
  const [pixelLabel, setPixelLabel] = useState("");
  const [calMode, setCalMode] = useState(false);
  const [calPoints, setCalPoints] = useState([]);
  const [calTransform, setCalTransform] = useState(null);
  const [pendingPin, setPendingPin] = useState(null);
  const [gpsInput, setGpsInput] = useState("");
  const svgRef = useRef(null);
  const [mapZoom, setMapZoom] = useState(1);
  const [mapPan, setMapPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null);
  const mapWrapRef = useRef(null);
  useEffect(() => {
    const saved = loadCalibration();
    setCalPoints(saved.points);
    setCalTransform(saved.transform);
  }, []);
  useEffect(() => {
    const el = mapWrapRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (calMode || pixelLog) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      setMapZoom((z) => Math.min(Math.max(z * factor, 0.5), 6));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [calMode, pixelLog]);
  const startDrag = (clientX, clientY) => {
    if (calMode || pixelLog) return;
    dragRef.current = { startX: clientX, startY: clientY, panX: mapPan.x, panY: mapPan.y };
    setIsDragging(true);
  };
  const moveDrag = (clientX, clientY) => {
    if (!dragRef.current) return;
    const { startX, startY, panX, panY } = dragRef.current;
    setMapPan({ x: panX + clientX - startX, y: panY + clientY - startY });
  };
  const endDrag = () => {
    dragRef.current = null;
    setIsDragging(false);
  };
  const zoomBtnStyle = {
    width: 28,
    height: 28,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg-card)",
    border: "1px solid var(--border-color)",
    borderRadius: "var(--radius-md)",
    color: "var(--text-main)",
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 700,
    lineHeight: 1,
    boxShadow: "0 1px 4px rgba(0,0,0,0.3)"
  };
  const person = PEOPLE.find((p) => p.id === activePerson);
  const flight = FLIGHTS.find((f) => f.id === person.flightId) ?? null;
  const pts = flight ? ROUTE_SVG[flight.gate] : null;
  const gatePos = flight ? GATE_SVG[flight.gate] : null;
  const polyline = pts ? pts.map((p) => `${p.x},${p.y}`).join(" ") : "";
  const placeOnMap = (lat, lng, personId) => {
    if (calTransform) {
      setPositions((prev) => ({ ...prev, [personId]: svgFromGps(calTransform, lat, lng) }));
    }
  };
  const getLocation = async () => {
    setLocLoading(true);
    try {
      const r = await fetch("/api/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person: activePerson })
      });
      const d = await r.json();
      const lat = d.location?.latitude, lng = d.location?.longitude;
      if (lat && lng) {
        placeOnMap(lat, lng, activePerson);
        onLog(`${person.name} · ${lat.toFixed(4)}, ${lng.toFixed(4)}${d.fromFixture ? " (mock)" : ""}`);
      } else {
        onLog(`${person.name}: ${d.error ?? "fără locație"}`, false);
      }
    } catch {
      onLog("Eroare locație", false);
    } finally {
      setLocLoading(false);
    }
  };
  const handleSvgClick = (e) => {
    if (!calMode || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = (e.clientX - rect.left) / rect.width * 2262;
    const svgY = (e.clientY - rect.top) / rect.height * 587;
    setPendingPin({ svgX, svgY });
    setGpsInput("");
  };
  const confirmCalPoint = () => {
    if (!pendingPin) return;
    const parts = gpsInput.split(",").map((s) => parseFloat(s.trim()));
    if (parts.length !== 2 || parts.some(isNaN)) return;
    const [lat, lng] = parts;
    const newPoints = [...calPoints, { svgX: pendingPin.svgX, svgY: pendingPin.svgY, lat, lng }];
    const newTransform = solveAffine(newPoints);
    setCalPoints(newPoints);
    setCalTransform(newTransform);
    saveCalibration(newPoints, newTransform);
    setPendingPin(null);
    setGpsInput("");
    onLog(`Cal point ${newPoints.length}: (${pendingPin.svgX.toFixed(0)}, ${pendingPin.svgY.toFixed(0)}) → ${lat}, ${lng}`);
  };
  const clearCalibration = () => {
    setCalPoints([]);
    setCalTransform(null);
    setPendingPin(null);
    saveCalibration([], null);
  };
  positions[activePerson];
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 6, marginBottom: 8 }, children: [
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 6 }, children: [
        /* @__PURE__ */ jsx("span", { style: { width: 8, height: 8, borderRadius: "50%", background: person.color, display: "inline-block" } }),
        /* @__PURE__ */ jsx("span", { style: { fontSize: 13, fontWeight: 600, color: person.color }, children: person.name }),
        flight && /* @__PURE__ */ jsxs("span", { style: { fontSize: 12, color: "var(--text-muted)" }, children: [
          "· ",
          flight.flight,
          " → ",
          flight.dest
        ] })
      ] }),
      /* @__PURE__ */ jsxs("button", { onClick: getLocation, disabled: locLoading, style: {
        marginLeft: "auto",
        padding: "6px 12px",
        borderRadius: "var(--radius-md)",
        cursor: "pointer",
        fontSize: 12,
        border: "1px solid var(--border-color)",
        background: "var(--bg-hover)",
        color: "var(--text-muted)",
        display: "flex",
        alignItems: "center",
        gap: 6
      }, children: [
        /* @__PURE__ */ jsx("i", { className: `ti ti-map-pin${locLoading ? " spin" : ""}` }),
        " Localizează"
      ] }),
      /* @__PURE__ */ jsx("button", { onClick: () => {
        setCalMode((m) => !m);
        setPendingPin(null);
      }, style: {
        padding: "6px 10px",
        borderRadius: "var(--radius-md)",
        cursor: "pointer",
        fontSize: 12,
        border: `1px solid ${calMode ? "var(--brand)" : "var(--border-color)"}`,
        background: calMode ? "rgba(255,102,0,0.2)" : "var(--bg-hover)",
        color: calMode ? "var(--brand)" : "var(--text-muted)"
      }, children: /* @__PURE__ */ jsx("i", { className: "ti ti-ruler-measure" }) }),
      /* @__PURE__ */ jsx("button", { onClick: () => {
        setPixelLog((m) => !m);
      }, style: {
        padding: "6px 10px",
        borderRadius: "var(--radius-md)",
        cursor: "pointer",
        fontSize: 12,
        border: `1px solid ${pixelLog ? "#F59E0B" : "var(--border-color)"}`,
        background: pixelLog ? "rgba(245,158,11,0.15)" : "var(--bg-hover)",
        color: pixelLog ? "#F59E0B" : "var(--text-muted)"
      }, title: "Pixel Logger", children: /* @__PURE__ */ jsx("i", { className: "ti ti-crosshair" }) })
    ] }),
    calMode && /* @__PURE__ */ jsxs("div", { style: { margin: "0 0 6px", padding: "8px 12px", background: "rgba(255,102,0,0.1)", border: "1px solid var(--brand)", borderRadius: "var(--radius-md)", fontSize: 12, color: "var(--brand)", display: "flex", alignItems: "center", gap: 10 }, children: [
      /* @__PURE__ */ jsx("i", { className: "ti ti-info-circle", style: { fontSize: 16 } }),
      /* @__PURE__ */ jsx("span", { children: "Click pe hartă → introdu GPS. Minim 3 puncte." }),
      calPoints.length >= 3 && /* @__PURE__ */ jsx("button", { onClick: async () => {
        const r = await fetch("/api/save-calibration", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ points: calPoints }) });
        const d = await r.json();
        onLog(d.ok ? `✓ ${calPoints.length} puncte salvate în cod` : `Eroare: ${d.error}`, d.ok);
      }, style: { background: "var(--brand)", border: "none", borderRadius: 4, color: "#fff", padding: "2px 10px", cursor: "pointer", fontSize: 11 }, children: "Salvează în cod" }),
      /* @__PURE__ */ jsx("button", { onClick: clearCalibration, style: { marginLeft: "auto", background: "transparent", border: "1px solid var(--border-color)", borderRadius: 4, color: "var(--text-muted)", padding: "2px 8px", cursor: "pointer", fontSize: 11 }, children: "Resetează" })
    ] }),
    /* @__PURE__ */ jsxs(
      "div",
      {
        ref: mapWrapRef,
        className: "map-container",
        style: {
          position: "relative",
          flex: 1,
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
          border: `1px solid ${calMode ? "var(--brand)" : pixelLog ? "#F59E0B" : "var(--border-color)"}`,
          cursor: calMode || pixelLog ? "crosshair" : isDragging ? "grabbing" : "grab",
          userSelect: "none"
        },
        onMouseDown: (e) => startDrag(e.clientX, e.clientY),
        onMouseMove: (e) => moveDrag(e.clientX, e.clientY),
        onMouseUp: endDrag,
        onMouseLeave: endDrag,
        onTouchStart: (e) => e.touches.length === 1 && startDrag(e.touches[0].clientX, e.touches[0].clientY),
        onTouchMove: (e) => {
          e.preventDefault();
          e.touches.length === 1 && moveDrag(e.touches[0].clientX, e.touches[0].clientY);
        },
        onTouchEnd: endDrag,
        children: [
          !calMode && !pixelLog && /* @__PURE__ */ jsxs("div", { style: { position: "absolute", top: 8, right: 8, zIndex: 10, display: "flex", flexDirection: "column", gap: 4 }, children: [
            /* @__PURE__ */ jsx("button", { style: zoomBtnStyle, onClick: () => setMapZoom((z) => Math.min(z * 1.25, 6)), title: "Zoom in", children: "+" }),
            /* @__PURE__ */ jsx("button", { style: zoomBtnStyle, onClick: () => setMapZoom((z) => Math.max(z * 0.8, 0.5)), title: "Zoom out", children: "−" }),
            /* @__PURE__ */ jsx("button", { style: { ...zoomBtnStyle, fontSize: 12 }, onClick: () => {
              setMapZoom(1);
              setMapPan({ x: 0, y: 0 });
            }, title: "Reset", children: /* @__PURE__ */ jsx("i", { className: "ti ti-home-2" }) })
          ] }),
          calMode && pendingPin && /* @__PURE__ */ jsxs("div", { style: { margin: "0 0 6px", padding: "8px 12px", background: "var(--bg-card)", border: "1px solid var(--brand)", borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", gap: 8 }, children: [
            /* @__PURE__ */ jsxs("span", { style: { fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }, children: [
              "SVG (",
              pendingPin.svgX.toFixed(0),
              ", ",
              pendingPin.svgY.toFixed(0),
              ")"
            ] }),
            /* @__PURE__ */ jsx(
              "input",
              {
                autoFocus: true,
                placeholder: "lat, lng",
                value: gpsInput,
                onChange: (e) => setGpsInput(e.target.value),
                onKeyDown: (e) => e.key === "Enter" && confirmCalPoint(),
                style: { flex: 1, background: "var(--bg-body)", border: "1px solid var(--border-color)", borderRadius: 4, color: "var(--text-main)", padding: "4px 8px", fontSize: 12, outline: "none" }
              }
            ),
            /* @__PURE__ */ jsx("button", { onClick: confirmCalPoint, style: { background: "var(--brand)", border: "none", borderRadius: 4, color: "#fff", padding: "4px 10px", cursor: "pointer", fontSize: 12 }, children: "OK" }),
            /* @__PURE__ */ jsx("button", { onClick: () => setPendingPin(null), style: { background: "transparent", border: "1px solid var(--border-color)", borderRadius: 4, color: "var(--text-muted)", padding: "4px 8px", cursor: "pointer", fontSize: 12 }, children: "✕" })
          ] }),
          pixelLog && hoverPos && /* @__PURE__ */ jsxs("div", { style: { position: "absolute", top: 8, left: 8, zIndex: 10, background: "rgba(11,17,32,0.92)", border: "1px solid #F59E0B", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#F59E0B", pointerEvents: "none" }, children: [
            "x: ",
            /* @__PURE__ */ jsx("b", { children: hoverPos.x.toFixed(0) }),
            " · y: ",
            /* @__PURE__ */ jsx("b", { children: hoverPos.y.toFixed(0) })
          ] }),
          /* @__PURE__ */ jsxs("div", { style: {
            position: "absolute",
            inset: 0,
            transform: `translate(${mapPan.x}px, ${mapPan.y}px) scale(${mapZoom})`,
            transformOrigin: "center center"
          }, children: [
            /* @__PURE__ */ jsx(
              "img",
              {
                src: "/harta_completa.svg",
                alt: "Hartă T4 LRIA",
                draggable: false,
                style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", display: "block", zIndex: 1 }
              }
            ),
            /* @__PURE__ */ jsxs(
              "svg",
              {
                ref: svgRef,
                viewBox: "0 0 2262 587",
                preserveAspectRatio: "xMidYMid meet",
                onClick: (e) => {
                  if (pixelLog && svgRef.current) {
                    const rect = svgRef.current.getBoundingClientRect();
                    const x = (e.clientX - rect.left) / rect.width * 2262;
                    const y = (e.clientY - rect.top) / rect.height * 587;
                    const label = window.prompt(`SVG (${x.toFixed(0)}, ${y.toFixed(0)}) — ce este acest punct?`) ?? "";
                    if (label) setPixelEntries((prev) => [...prev, { x, y, label }]);
                  } else {
                    handleSvgClick(e);
                  }
                },
                onMouseMove: (e) => {
                  if (!pixelLog || !svgRef.current) {
                    setHoverPos(null);
                    return;
                  }
                  const rect = svgRef.current.getBoundingClientRect();
                  setHoverPos({ x: (e.clientX - rect.left) / rect.width * 2262, y: (e.clientY - rect.top) / rect.height * 587 });
                },
                onMouseLeave: () => setHoverPos(null),
                style: { position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: calMode || pixelLog ? "all" : "none", zIndex: 2 },
                children: [
                  /* @__PURE__ */ jsx("defs", { children: /* @__PURE__ */ jsxs("filter", { id: "glow2", children: [
                    /* @__PURE__ */ jsx("feGaussianBlur", { stdDeviation: "3", result: "b" }),
                    /* @__PURE__ */ jsxs("feMerge", { children: [
                      /* @__PURE__ */ jsx("feMergeNode", { in: "b" }),
                      /* @__PURE__ */ jsx("feMergeNode", { in: "SourceGraphic" })
                    ] })
                  ] }) }),
                  !calMode && pts && /* @__PURE__ */ jsx(
                    "polyline",
                    {
                      points: polyline,
                      fill: "none",
                      stroke: person.color,
                      strokeWidth: "4",
                      strokeDasharray: "12 8",
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      style: { animation: "moveDash 1.5s linear infinite", filter: `drop-shadow(0 0 6px ${person.color}88)` }
                    }
                  ),
                  !calMode && gatePos && /* @__PURE__ */ jsxs("g", { filter: "url(#glow2)", children: [
                    /* @__PURE__ */ jsx("circle", { cx: gatePos.x, cy: gatePos.y, r: "14", fill: "none", stroke: "#10B981", strokeWidth: "2", opacity: "0.6", style: { animation: "pulse 2s infinite" } }),
                    /* @__PURE__ */ jsx("circle", { cx: gatePos.x, cy: gatePos.y, r: "7", fill: "#10B981" }),
                    /* @__PURE__ */ jsx("text", { x: gatePos.x, y: gatePos.y - 18, textAnchor: "middle", fill: "#10B981", fontSize: "12", fontWeight: "700", children: GATE_LABELS[flight?.gate ?? ""] })
                  ] }),
                  !calMode && PEOPLE.map((p) => {
                    const pos = positions[p.id];
                    return /* @__PURE__ */ jsxs("g", { filter: "url(#glow2)", opacity: p.id === activePerson ? 1 : 0.5, children: [
                      /* @__PURE__ */ jsx("circle", { cx: pos.x, cy: pos.y, r: p.id === activePerson ? 14 : 10, fill: "none", stroke: p.color, strokeWidth: "2", opacity: "0.5", style: p.id === activePerson ? { animation: "pulse 2s infinite" } : {} }),
                      /* @__PURE__ */ jsx("circle", { cx: pos.x, cy: pos.y, r: p.id === activePerson ? 7 : 5, fill: p.color }),
                      /* @__PURE__ */ jsx("circle", { cx: pos.x, cy: pos.y, r: "2", fill: "#fff" }),
                      /* @__PURE__ */ jsx("text", { x: pos.x, y: pos.y + 20, textAnchor: "middle", fill: p.color, fontSize: "10", fontWeight: "600", children: p.name })
                    ] }, p.id);
                  }),
                  calMode && calPoints.map((p, i) => /* @__PURE__ */ jsxs("g", { children: [
                    /* @__PURE__ */ jsx("circle", { cx: p.svgX, cy: p.svgY, r: "7", fill: "#ff6600", stroke: "#fff", strokeWidth: "1.5" }),
                    /* @__PURE__ */ jsx("text", { x: p.svgX + 10, y: p.svgY + 4, fill: "#ff6600", fontSize: "10", children: i + 1 })
                  ] }, i)),
                  calMode && pendingPin && /* @__PURE__ */ jsxs("g", { children: [
                    /* @__PURE__ */ jsx("line", { x1: pendingPin.svgX, y1: pendingPin.svgY - 14, x2: pendingPin.svgX, y2: pendingPin.svgY + 14, stroke: "#ff6600", strokeWidth: "2" }),
                    /* @__PURE__ */ jsx("line", { x1: pendingPin.svgX - 14, y1: pendingPin.svgY, x2: pendingPin.svgX + 14, y2: pendingPin.svgY, stroke: "#ff6600", strokeWidth: "2" }),
                    /* @__PURE__ */ jsx("circle", { cx: pendingPin.svgX, cy: pendingPin.svgY, r: "5", fill: "none", stroke: "#ff6600", strokeWidth: "2" })
                  ] })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsx("style", { children: `
          @keyframes moveDash { to { stroke-dashoffset: -200; } }
          @keyframes pulse { 0%,100%{transform:scale(0.9);opacity:1} 50%{transform:scale(1.3);opacity:0.7} }
        ` })
        ]
      }
    ),
    pixelLog && pixelEntries.length > 0 && /* @__PURE__ */ jsxs("div", { style: { marginTop: 8, padding: "8px 12px", background: "rgba(245,158,11,0.08)", border: "1px solid #F59E0B44", borderRadius: "var(--radius-md)", fontSize: 11, flexShrink: 0 }, children: [
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: 4 }, children: [
        /* @__PURE__ */ jsx("span", { style: { color: "#F59E0B", fontWeight: 600 }, children: "Pixel Log" }),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => {
              navigator.clipboard.writeText(pixelEntries.map((e) => `{ svgX: ${e.x.toFixed(0)}, svgY: ${e.y.toFixed(0)} } // ${e.label}`).join("\n"));
            },
            style: { background: "transparent", border: "none", color: "#F59E0B", cursor: "pointer", fontSize: 11 },
            children: "📋 Copy"
          }
        ),
        /* @__PURE__ */ jsx("button", { onClick: () => setPixelEntries([]), style: { background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 11 }, children: "✕ Clear" })
      ] }),
      pixelEntries.map((e, i) => /* @__PURE__ */ jsxs("div", { style: { fontFamily: "monospace", color: "var(--text-muted)", lineHeight: 1.6 }, children: [
        /* @__PURE__ */ jsxs("span", { style: { color: "#F59E0B" }, children: [
          "(",
          e.x.toFixed(0),
          ", ",
          e.y.toFixed(0),
          ")"
        ] }),
        " — ",
        e.label
      ] }, i))
    ] }),
    flight && /* @__PURE__ */ jsxs("div", { className: "route-eta-card fade-in", children: [
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10, flex: 1 }, children: [
        /* @__PURE__ */ jsx("i", { className: "ti ti-walk", style: { fontSize: 22, color: "var(--brand)", flexShrink: 0 } }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("div", { style: { fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }, children: "Timp estimat până la poartă" }),
          /* @__PURE__ */ jsxs("div", { style: { fontSize: 22, fontWeight: 700, color: "var(--text-main)", lineHeight: 1 }, children: [
            GATE_ETA_MIN[flight.gate] ?? 8,
            /* @__PURE__ */ jsx("span", { style: { fontSize: 13, fontWeight: 400, color: "var(--text-muted)", marginLeft: 4 }, children: "min mers" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }, children: [
        /* @__PURE__ */ jsx("div", { style: { fontSize: 11, color: "var(--text-muted)" }, children: "Decolare" }),
        /* @__PURE__ */ jsx("div", { style: { fontSize: 15, fontWeight: 600, color: person.color }, children: flight.departs }),
        /* @__PURE__ */ jsx("div", { style: { fontSize: 11, color: "var(--text-muted)" }, children: GATE_LABELS[flight.gate] })
      ] })
    ] }),
    flight && /* @__PURE__ */ jsxs("div", { style: { marginTop: 8, padding: "10px 14px", borderRadius: "var(--radius-md)", border: `1px solid ${person.color}44`, background: `${person.color}11`, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }, children: [
      /* @__PURE__ */ jsx("i", { className: "ti ti-plane", style: { color: person.color, fontSize: 20 } }),
      /* @__PURE__ */ jsxs("div", { style: { flex: 1 }, children: [
        /* @__PURE__ */ jsxs("div", { style: { fontWeight: 600, fontSize: 14, color: person.color }, children: [
          flight.flight,
          " → ",
          flight.dest
        ] }),
        /* @__PURE__ */ jsxs("div", { style: { fontSize: 12, color: "var(--text-muted)" }, children: [
          GATE_LABELS[flight.gate],
          " · Decolare ",
          flight.departs
        ] })
      ] })
    ] })
  ] });
}
function decodeGeohash(hash) {
  const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
  let lat = [-90, 90], lng = [-180, 180];
  let isLng = true;
  for (const c of hash) {
    const v = BASE32.indexOf(c);
    for (let i = 4; i >= 0; i--) {
      const bit = v >> i & 1;
      if (isLng) {
        const mid = (lng[0] + lng[1]) / 2;
        lng[bit ? 0 : 1] = mid;
      } else {
        const mid = (lat[0] + lat[1]) / 2;
        lat[bit ? 0 : 1] = mid;
      }
      isLng = !isLng;
    }
  }
  return { lat: (lat[0] + lat[1]) / 2, lng: (lng[0] + lng[1]) / 2 };
}
function heatColor(density) {
  if (density > 150) return "var(--danger)";
  if (density > 60) return "var(--warning)";
  return "var(--success)";
}
function HeatmapCenter({ onLog }) {
  const [densityData, setDensityData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fromFixture, setFromFixture] = useState(false);
  const fetchDensity = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/population-density", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const d = await r.json();
      const cells = d.timedPopulationDensityData?.[0]?.cellPopulationDensityData ?? [];
      setDensityData(cells);
      setFromFixture(!!d.fromFixture);
      onLog(`Population Density · ${cells.length} celule${d.fromFixture ? " (fixture)" : ""}`);
    } catch {
      onLog("Eroare Population Density API", false);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchDensity();
    const t = setInterval(fetchDensity, 3e4);
    return () => clearInterval(t);
  }, []);
  const GPS_ANCHOR = [
    { lat: 47.17439, lng: 27.61903, svgX: 852, svgY: 349 },
    { lat: 47.17406, lng: 27.6197, svgX: 2244, svgY: 256 }
  ];
  const dLng = GPS_ANCHOR[1].lng - GPS_ANCHOR[0].lng;
  const dLat = GPS_ANCHOR[1].lat - GPS_ANCHOR[0].lat;
  const dX = GPS_ANCHOR[1].svgX - GPS_ANCHOR[0].svgX;
  const dY = GPS_ANCHOR[1].svgY - GPS_ANCHOR[0].svgY;
  function gpsToSvg(lat, lng) {
    const tLng = (lng - GPS_ANCHOR[0].lng) / dLng;
    const tLat = (lat - GPS_ANCHOR[0].lat) / dLat;
    return {
      x: GPS_ANCHOR[0].svgX + tLng * dX + (tLat - tLng) * 200,
      y: GPS_ANCHOR[0].svgY + tLng * dY + (tLat - tLng) * -120
    };
  }
  const maxDensity = Math.max(...densityData.map((c) => c.pplDensity ?? 0), 1);
  const circles = densityData.filter((c) => c.pplDensity).map((c) => {
    const { lat, lng } = decodeGeohash(c.geohash);
    const pos = gpsToSvg(lat, lng);
    const intensity = (c.pplDensity ?? 0) / maxDensity;
    const r = 20 + intensity * 65;
    const color = intensity > 0.7 ? "#EF5350" : intensity > 0.35 ? "#FFA726" : "#66BB6A";
    return { ...pos, r, color, intensity, density: c.pplDensity ?? 0 };
  });
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("div", { className: "map-header", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("div", { className: "map-title", children: "Heatmap Terminal T4 — LRIA" }),
        /* @__PURE__ */ jsxs("div", { style: { fontSize: 11, color: "var(--text-muted)", marginTop: 2 }, children: [
          "Orange Population Density API",
          fromFixture && /* @__PURE__ */ jsx("span", { style: { color: "var(--warning)", marginLeft: 6 }, children: "· fixture" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "badges", children: [
        /* @__PURE__ */ jsxs("div", { className: "badge badge-live", children: [
          /* @__PURE__ */ jsx("span", { className: "dot red pulse-red" }),
          "Live"
        ] }),
        /* @__PURE__ */ jsx("button", { onClick: fetchDensity, style: { background: "var(--bg-hover)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", color: "var(--text-muted)", padding: "4px 10px", cursor: "pointer", fontSize: 12 }, children: /* @__PURE__ */ jsx("i", { className: `ti ti-refresh${loading ? " spin" : ""}` }) })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "map-container", style: { position: "relative", flex: 1, borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--border-color)" }, children: [
      /* @__PURE__ */ jsx("img", { src: "/harta_completa.svg", alt: "Hartă T4", style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", display: "block", zIndex: 1 } }),
      /* @__PURE__ */ jsxs(
        "svg",
        {
          viewBox: "0 0 2262 587",
          preserveAspectRatio: "xMidYMid meet",
          style: { position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 2 },
          children: [
            /* @__PURE__ */ jsx("defs", { children: circles.map((c, i) => /* @__PURE__ */ jsxs("radialGradient", { id: `hg${i}`, cx: "50%", cy: "50%", r: "50%", children: [
              /* @__PURE__ */ jsx("stop", { offset: "0%", stopColor: c.color, stopOpacity: 0.6 + c.intensity * 0.3 }),
              /* @__PURE__ */ jsx("stop", { offset: "100%", stopColor: c.color, stopOpacity: "0" })
            ] }, i)) }),
            circles.map((c, i) => /* @__PURE__ */ jsxs("g", { children: [
              /* @__PURE__ */ jsx("circle", { cx: c.x, cy: c.y, r: c.r, fill: `url(#hg${i})` }),
              c.intensity > 0.85 && /* @__PURE__ */ jsx("circle", { cx: c.x, cy: c.y, r: 8, fill: c.color, opacity: "0.95" })
            ] }, i)),
            /* @__PURE__ */ jsx("text", { x: 852, y: 320, textAnchor: "middle", fill: "#EF5350", fontSize: "13", fontWeight: "700", children: "⚠ Coadă Security" }),
            /* @__PURE__ */ jsx("text", { x: 2244, y: 228, textAnchor: "middle", fill: "#EF5350", fontSize: "13", fontWeight: "700", children: "⚠ Coadă Boarding" })
          ]
        }
      )
    ] })
  ] });
}
function RightPanel({
  feature,
  onLog,
  weatherProvider,
  setWeatherProvider
}) {
  return /* @__PURE__ */ jsxs("div", { className: "card sidebar-right", children: [
    feature === "weather" && /* @__PURE__ */ jsx(WeatherRight, { weatherProvider, setWeatherProvider }),
    feature === "route" && /* @__PURE__ */ jsx(RouteRight, { onLog }),
    feature === "heatmap" && /* @__PURE__ */ jsx(HeatmapRight, {})
  ] });
}
const WEATHER_PROVIDERS = [
  { id: "open-meteo", label: "Open-Meteo", icon: "ti-cloud", sub: "Gratuit · fără autentificare" },
  { id: "openweathermap", label: "OpenWeatherMap", icon: "ti-cloud-storm", sub: "API Key · 60 req/min" },
  { id: "accuweather", label: "AccuWeather", icon: "ti-sun", sub: "API Key · 50 req/zi" }
];
function WeatherRight({
  weatherProvider,
  setWeatherProvider
}) {
  const [m, setM] = useState(null);
  useEffect(() => {
    fetch("/api/metar?station=LRIA").then((r) => r.json()).then(setM).catch(() => {
    });
  }, []);
  const qnh = m?.altimeter?.qnhHpa ?? 1013;
  const temp = m?.temperature;
  const wind = m?.wind;
  const cat = m?.flightCategory ?? "VFR";
  const elevFt = 321;
  const isaStd = 15 - 2 * (elevFt / 1e3);
  const isaDev = temp ? Math.round((temp.tempC - isaStd) * 10) / 10 : null;
  const transAlt = 7e3;
  const transFL = Math.ceil((transAlt + (1013 - qnh) * 27) / 500) * 5;
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("div", { className: "section-title", children: "Furnizor Meteo" }),
    /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 16, flexShrink: 0 }, children: WEATHER_PROVIDERS.map((p) => /* @__PURE__ */ jsxs(
      "button",
      {
        className: `provider-card${weatherProvider === p.id ? " active" : ""}`,
        onClick: () => setWeatherProvider(p.id),
        children: [
          /* @__PURE__ */ jsx("i", { className: `ti ${p.icon}`, style: { fontSize: 18, flexShrink: 0 } }),
          /* @__PURE__ */ jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [
            /* @__PURE__ */ jsx("div", { style: { fontSize: 13, fontWeight: 600 }, children: p.label }),
            /* @__PURE__ */ jsx("div", { style: { fontSize: 11, opacity: 0.8 }, children: p.sub })
          ] }),
          weatherProvider === p.id && /* @__PURE__ */ jsx("i", { className: "ti ti-check", style: { fontSize: 14, flexShrink: 0 } })
        ]
      },
      p.id
    )) }),
    /* @__PURE__ */ jsx("div", { className: "section-title", children: "Stația LRIA" }),
    /* @__PURE__ */ jsx("div", { className: "stats-list", style: { marginBottom: 12 }, children: [
      ["ICAO", "LRIA"],
      ["Elevație", "321 ft / 98 m"],
      ["Pistă", "08/26 · 2400m"],
      ["Tip", "ILS Cat I"],
      ["ATC freq.", "TWR 118.7 MHz"]
    ].map(([l, v]) => /* @__PURE__ */ jsxs("div", { className: "stat-item", children: [
      /* @__PURE__ */ jsx("span", { className: "stat-label", children: l }),
      /* @__PURE__ */ jsx("span", { className: "stat-value", style: { fontSize: 13 }, children: v })
    ] }, l)) }),
    /* @__PURE__ */ jsx("div", { className: "section-title", children: "Calculat din METAR" }),
    /* @__PURE__ */ jsxs("div", { className: "stats-list", style: { marginBottom: 12 }, children: [
      /* @__PURE__ */ jsxs("div", { className: "stat-item", children: [
        /* @__PURE__ */ jsx("span", { className: "stat-label", children: "ISA Deviation" }),
        /* @__PURE__ */ jsx("span", { className: "stat-value", style: { fontSize: 13, color: isaDev && Math.abs(isaDev) > 10 ? "var(--warning)" : void 0 }, children: isaDev !== null ? `ISA${isaDev >= 0 ? "+" : ""}${isaDev}°C` : "—" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "stat-item", children: [
        /* @__PURE__ */ jsx("span", { className: "stat-label", children: "Transition Level" }),
        /* @__PURE__ */ jsxs("span", { className: "stat-value", style: { fontSize: 13 }, children: [
          "FL",
          String(transFL).padStart(3, "0")
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "stat-item", children: [
        /* @__PURE__ */ jsx("span", { className: "stat-label", children: "QNH → QFE" }),
        /* @__PURE__ */ jsxs("span", { className: "stat-value", style: { fontSize: 13 }, children: [
          Math.round(qnh - elevFt * 0.04),
          " hPa"
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "stat-item", children: [
        /* @__PURE__ */ jsx("span", { className: "stat-label", children: "Vânt magnetik" }),
        /* @__PURE__ */ jsx("span", { className: "stat-value", style: { fontSize: 13 }, children: wind ? `${wind.isVariable ? "VRB" : String(wind.directionDeg).padStart(3, "0")}/${String(wind.speedKt).padStart(2, "0")}${wind.gustKt ? `G${wind.gustKt}` : ""}KT` : "—" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "stat-item", children: [
        /* @__PURE__ */ jsx("span", { className: "stat-label", children: "Dew spread" }),
        /* @__PURE__ */ jsx("span", { className: "stat-value", style: { fontSize: 13 }, children: temp ? `${temp.tempC - temp.dewpointC}°C` : "—" })
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "section-title", children: "Limite Operaționale" }),
    /* @__PURE__ */ jsx("div", { className: "stats-list", children: [
      ["Cat I ILS", "DH 200ft · RVR 550m", "var(--success)"],
      ["Cat II ILS", "DH 100ft · RVR 300m", "var(--info)"],
      ["VFR circuit", "Plafon > 1000ft · Viz > 5km", "var(--text-muted)"],
      ["LVTO", "RVR ≥ 150m", "var(--warning)"]
    ].map(([l, v, c]) => /* @__PURE__ */ jsxs("div", { className: "stat-item", children: [
      /* @__PURE__ */ jsx("span", { className: "stat-label", children: l }),
      /* @__PURE__ */ jsx("span", { style: { fontSize: 11, color: c, textAlign: "right", maxWidth: 130 }, children: v })
    ] }, l)) }),
    /* @__PURE__ */ jsxs("div", { style: { marginTop: 12, padding: "10px 14px", borderRadius: "var(--radius-md)", border: `1px solid ${CAT_COL[cat]}44`, background: `${CAT_COL[cat]}15`, textAlign: "center" }, children: [
      /* @__PURE__ */ jsx("div", { style: { fontWeight: 700, fontSize: 20, color: CAT_COL[cat] }, children: cat }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: 11, color: CAT_COL[cat], opacity: 0.85 }, children: CAT_LABEL[cat] })
    ] })
  ] });
}
function RouteRight({ onLog }) {
  const [densityData, setDensityData] = useState([]);
  const [sel, setSel] = useState(null);
  const [verifyRes, setVerifyRes] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    fetch("/api/population-density", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then((r) => r.json()).then((d) => setDensityData(d.timedPopulationDensityData?.[0]?.cellPopulationDensityData ?? [])).catch(() => {
    });
  }, []);
  const securityDensity = densityData[0]?.pplDensity ?? 185;
  const boardingDensity = densityData[1]?.pplDensity ?? 95;
  const securityETA = Math.ceil(securityDensity * 45 / (2 * 60));
  const boardingETA = Math.ceil(boardingDensity * 30 / (3 * 60));
  const verify = async (scenario) => {
    setLoading(true);
    try {
      const r = await fetch("/api/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scenario }) });
      const d = await r.json();
      setVerifyRes(d);
      onLog(`Verificare ${scenario} → ${d.decision}`, d.decision === "ALLOW");
    } catch {
      onLog("Eroare verificare", false);
    } finally {
      setLoading(false);
    }
  };
  const etaColor = (eta) => eta > 20 ? "var(--danger)" : eta > 10 ? "var(--warning)" : "var(--success)";
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("div", { className: "section-title", children: "Timp estimat așteptare" }),
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }, children: [
      /* @__PURE__ */ jsxs("div", { style: { padding: "12px 14px", background: "var(--bg-body)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)" }, children: [
        /* @__PURE__ */ jsxs("div", { style: { fontSize: 11, color: "var(--text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }, children: [
          /* @__PURE__ */ jsx("i", { className: "ti ti-shield-check", style: { color: "var(--brand)" } }),
          " Security Check (Masa Echipei)"
        ] }),
        /* @__PURE__ */ jsxs("div", { style: { fontSize: 24, fontWeight: 700, color: etaColor(securityETA) }, children: [
          securityETA,
          " min"
        ] }),
        /* @__PURE__ */ jsxs("div", { style: { fontSize: 11, color: "var(--text-muted)", marginTop: 2 }, children: [
          securityDensity,
          " pax detectați · 2 linii active"
        ] }),
        /* @__PURE__ */ jsx("div", { style: { marginTop: 6, height: 4, background: "var(--bg-hover)", borderRadius: 2 }, children: /* @__PURE__ */ jsx("div", { style: { width: `${Math.min(100, securityDensity / 250 * 100)}%`, height: "100%", background: etaColor(securityETA), borderRadius: 2, transition: "width 0.5s" } }) })
      ] }),
      /* @__PURE__ */ jsxs("div", { style: { padding: "12px 14px", background: "var(--bg-body)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)" }, children: [
        /* @__PURE__ */ jsxs("div", { style: { fontSize: 11, color: "var(--text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }, children: [
          /* @__PURE__ */ jsx("i", { className: "ti ti-door-enter", style: { color: "var(--success)" } }),
          " Boarding Gate (Dozator)"
        ] }),
        /* @__PURE__ */ jsxs("div", { style: { fontSize: 24, fontWeight: 700, color: etaColor(boardingETA) }, children: [
          boardingETA,
          " min"
        ] }),
        /* @__PURE__ */ jsxs("div", { style: { fontSize: 11, color: "var(--text-muted)", marginTop: 2 }, children: [
          boardingDensity,
          " pax detectați · 3 ghișee active"
        ] }),
        /* @__PURE__ */ jsx("div", { style: { marginTop: 6, height: 4, background: "var(--bg-hover)", borderRadius: 2 }, children: /* @__PURE__ */ jsx("div", { style: { width: `${Math.min(100, boardingDensity / 250 * 100)}%`, height: "100%", background: etaColor(boardingETA), borderRadius: 2, transition: "width 0.5s" } }) })
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "section-title", children: "Zboruri" }),
    /* @__PURE__ */ jsx("div", { className: "flight-list", children: FLIGHTS.map((f) => /* @__PURE__ */ jsxs("div", { className: `flight-item${sel === f.id ? " active" : ""}`, onClick: () => setSel(sel === f.id ? null : f.id), children: [
      /* @__PURE__ */ jsx("i", { className: "ti ti-plane", style: { color: f.color, fontSize: 18 } }),
      /* @__PURE__ */ jsxs("div", { style: { flex: 1 }, children: [
        /* @__PURE__ */ jsx("div", { className: "flight-nr", children: f.flight }),
        /* @__PURE__ */ jsx("div", { className: "flight-dest", children: f.dest })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flight-gate", style: { color: f.color }, children: [
        "G",
        f.gate,
        " · ",
        f.departs
      ] })
    ] }, f.id)) }),
    /* @__PURE__ */ jsx("div", { className: "section-title", style: { marginTop: 12 }, children: "Verificare identitate" }),
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: [
      /* @__PURE__ */ jsxs("button", { onClick: () => verify("legit"), disabled: loading, style: { padding: "9px", background: "var(--success-bg)", border: "1px solid var(--success)", borderRadius: "var(--radius-md)", color: "var(--success)", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }, children: [
        /* @__PURE__ */ jsx("i", { className: `ti ti-${loading ? "loader-2 spin" : "user-check"}` }),
        " Pasager legitim"
      ] }),
      /* @__PURE__ */ jsxs("button", { onClick: () => verify("fraud"), disabled: loading, style: { padding: "9px", background: "var(--danger-bg)", border: "1px solid var(--danger)", borderRadius: "var(--radius-md)", color: "var(--danger)", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }, children: [
        /* @__PURE__ */ jsx("i", { className: "ti ti-user-x" }),
        " Simulează SIM Swap"
      ] })
    ] }),
    verifyRes && /* @__PURE__ */ jsx("div", { className: "fade-in", style: { marginTop: 10, padding: 10, borderRadius: "var(--radius-md)", border: `1px solid ${verifyRes.decision === "ALLOW" ? "var(--success)" : "var(--danger)"}`, background: `${verifyRes.decision === "ALLOW" ? "var(--success-bg)" : "var(--danger-bg)"}` }, children: /* @__PURE__ */ jsxs("div", { style: { fontWeight: 600, fontSize: 13, color: verifyRes.decision === "ALLOW" ? "var(--success)" : "var(--danger)", display: "flex", alignItems: "center", gap: 8 }, children: [
      /* @__PURE__ */ jsx("i", { className: `ti ti-${verifyRes.decision === "ALLOW" ? "circle-check" : "shield-x"}` }),
      verifyRes.decision === "ALLOW" ? "ALLOW — Verificat" : "BLOCK — SIM Swap detectat"
    ] }) })
  ] });
}
function HeatmapRight() {
  const [cells, setCells] = useState([]);
  const [updatedAt, setUpdatedAt] = useState("");
  useEffect(() => {
    const load = () => fetch("/api/population-density", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then((r) => r.json()).then((d) => {
      setCells(d.timedPopulationDensityData?.[0]?.cellPopulationDensityData ?? []);
      setUpdatedAt((/* @__PURE__ */ new Date()).toLocaleTimeString("ro"));
    }).catch(() => {
    });
    load();
    const t = setInterval(load, 3e4);
    return () => clearInterval(t);
  }, []);
  const estimation = cells.filter((c) => c.dataType === "DENSITY_ESTIMATION");
  const maxDensity = Math.max(...estimation.map((c) => c.pplDensity ?? 0), 1);
  Math.round(estimation.reduce((s, c) => s + (c.pplDensity ?? 0), 0));
  const alertCells = estimation.filter((c) => (c.pplDensity ?? 0) > 150);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("div", { className: "section-title", children: "Densitate Populație" }),
    /* @__PURE__ */ jsxs("div", { className: "stats-list", style: { marginBottom: 12 }, children: [
      /* @__PURE__ */ jsxs("div", { className: "stat-item", children: [
        /* @__PURE__ */ jsx("span", { className: "stat-label", children: "Total celule" }),
        /* @__PURE__ */ jsx("span", { className: "stat-value", children: cells.length })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "stat-item", children: [
        /* @__PURE__ */ jsx("span", { className: "stat-label", children: "Cu estimare" }),
        /* @__PURE__ */ jsx("span", { className: "stat-value", children: estimation.length })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "stat-item", children: [
        /* @__PURE__ */ jsx("span", { className: "stat-label", children: "Densitate max" }),
        /* @__PURE__ */ jsx("span", { className: "stat-value", style: { color: maxDensity > 150 ? "var(--danger)" : "var(--text-main)" }, children: maxDensity > 1 ? `${Math.round(maxDensity)} /km²` : "—" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "stat-item", children: [
        /* @__PURE__ */ jsx("span", { className: "stat-label", children: "Zone alertă" }),
        /* @__PURE__ */ jsx("span", { className: "stat-value", style: { color: alertCells.length > 0 ? "var(--danger)" : "var(--success)" }, children: alertCells.length })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "stat-item", children: [
        /* @__PURE__ */ jsx("span", { className: "stat-label", children: "Actualizat" }),
        /* @__PURE__ */ jsx("span", { className: "stat-value", style: { fontSize: 12, color: "var(--text-muted)" }, children: updatedAt || "—" })
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "section-title", children: "Celule Geohash" }),
    /* @__PURE__ */ jsxs("div", { style: { flex: 1, overflowY: "auto" }, children: [
      estimation.map((c) => {
        const color = heatColor(c.pplDensity ?? 0);
        const pct2 = Math.min(Math.round((c.pplDensity ?? 0) / maxDensity * 100), 100);
        return /* @__PURE__ */ jsxs("div", { className: "zone-row", children: [
          /* @__PURE__ */ jsx("span", { style: { fontFamily: "monospace", fontSize: 12, color: "var(--text-muted)" }, children: c.geohash }),
          /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
            /* @__PURE__ */ jsx("div", { className: "zone-bar-wrap", children: /* @__PURE__ */ jsx("div", { className: "zone-bar", style: { width: `${pct2}%`, background: color } }) }),
            /* @__PURE__ */ jsxs("span", { style: { fontSize: 12, fontWeight: 600, color, width: 50, textAlign: "right" }, children: [
              Math.round(c.pplDensity ?? 0),
              "/km²"
            ] })
          ] })
        ] }, c.geohash);
      }),
      cells.filter((c) => c.dataType !== "DENSITY_ESTIMATION").map((c) => /* @__PURE__ */ jsxs("div", { className: "zone-row", children: [
        /* @__PURE__ */ jsx("span", { style: { fontFamily: "monospace", fontSize: 12, color: "var(--text-muted)" }, children: c.geohash }),
        /* @__PURE__ */ jsx("span", { style: { fontSize: 11, color: "var(--text-muted)" }, children: "LOW_DENSITY" })
      ] }, c.geohash))
    ] }),
    alertCells.length > 0 && /* @__PURE__ */ jsxs("div", { className: "alert-box", style: { marginTop: 12 }, children: [
      /* @__PURE__ */ jsxs("div", { className: "alert-title", children: [
        /* @__PURE__ */ jsx("i", { className: "ti ti-alert-triangle" }),
        " ",
        alertCells.length,
        " zone aglomerate"
      ] }),
      /* @__PURE__ */ jsx("div", { className: "alert-desc", children: alertCells.map((c) => `${c.geohash}: ${Math.round(c.pplDensity ?? 0)}/km²`).join(" · ") })
    ] })
  ] });
}
function LoginModal({ onLogin }) {
  const [tab, setTab] = useState("passenger");
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [phone, setPhone] = useState("");
  const [iata, setIata] = useState("");
  const [error, setError] = useState("");
  const submitAdmin = (e) => {
    e.preventDefault();
    if (adminUser === ADMIN_USERNAME && adminPass === ADMIN_PASSWORD) {
      onLogin({ role: "admin", personId: "you", displayName: "Admin" });
    } else {
      setError("Utilizator sau parolă incorectă.");
    }
  };
  const submitPassenger = (e) => {
    e.preventDefault();
    const client = findClient(phone, iata);
    if (client) {
      onLogin({ role: "passenger", personId: client.personId, displayName: client.displayName });
    } else {
      setError("Număr de telefon sau zbor IATA incorect.");
    }
  };
  return /* @__PURE__ */ jsx("div", { className: "login-overlay", children: /* @__PURE__ */ jsxs("div", { className: "login-modal fade-in", children: [
    /* @__PURE__ */ jsxs("div", { className: "login-brand", children: [
      /* @__PURE__ */ jsx("div", { className: "brand-icon", children: /* @__PURE__ */ jsx("i", { className: "ti ti-wifi" }) }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("div", { className: "brand-title", children: "AirFlow Nexus" }),
        /* @__PURE__ */ jsx("div", { className: "brand-sub", children: "powered by Orange APIs" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "login-tabs", children: [
      /* @__PURE__ */ jsxs(
        "button",
        {
          className: `login-tab${tab === "passenger" ? " active" : ""}`,
          onClick: () => {
            setTab("passenger");
            setError("");
          },
          children: [
            /* @__PURE__ */ jsx("i", { className: "ti ti-user" }),
            " Pasager"
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        "button",
        {
          className: `login-tab${tab === "admin" ? " active" : ""}`,
          onClick: () => {
            setTab("admin");
            setError("");
          },
          children: [
            /* @__PURE__ */ jsx("i", { className: "ti ti-shield-half" }),
            " Personal"
          ]
        }
      )
    ] }),
    tab === "passenger" && /* @__PURE__ */ jsxs("form", { onSubmit: submitPassenger, className: "login-form", children: [
      /* @__PURE__ */ jsxs("div", { className: "login-field", children: [
        /* @__PURE__ */ jsx("label", { children: "Număr de telefon" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "tel",
            className: "phone-input",
            placeholder: "+40721000001",
            value: phone,
            onChange: (e) => {
              setPhone(e.target.value);
              setError("");
            },
            autoFocus: true
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "login-field", children: [
        /* @__PURE__ */ jsx("label", { children: "Cod zbor (IATA)" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "text",
            className: "phone-input",
            placeholder: "RO321",
            value: iata,
            onChange: (e) => {
              setIata(e.target.value);
              setError("");
            }
          }
        )
      ] }),
      error && /* @__PURE__ */ jsx("div", { className: "login-error", children: error }),
      /* @__PURE__ */ jsxs("button", { type: "submit", className: "btn-primary login-submit", children: [
        /* @__PURE__ */ jsx("i", { className: "ti ti-login" }),
        " Intră"
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "login-hint", children: [
        /* @__PURE__ */ jsx("i", { className: "ti ti-info-circle" }),
        "Demo: +40721000001 / RO321"
      ] })
    ] }),
    tab === "admin" && /* @__PURE__ */ jsxs("form", { onSubmit: submitAdmin, className: "login-form", children: [
      /* @__PURE__ */ jsxs("div", { className: "login-field", children: [
        /* @__PURE__ */ jsx("label", { children: "Utilizator" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "text",
            className: "phone-input",
            placeholder: "admin",
            value: adminUser,
            onChange: (e) => {
              setAdminUser(e.target.value);
              setError("");
            },
            autoFocus: true,
            autoComplete: "username"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "login-field", children: [
        /* @__PURE__ */ jsx("label", { children: "Parolă" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "password",
            className: "phone-input",
            placeholder: "••••••",
            value: adminPass,
            onChange: (e) => {
              setAdminPass(e.target.value);
              setError("");
            },
            autoComplete: "current-password"
          }
        )
      ] }),
      error && /* @__PURE__ */ jsx("div", { className: "login-error", children: error }),
      /* @__PURE__ */ jsxs("button", { type: "submit", className: "btn-primary login-submit", children: [
        /* @__PURE__ */ jsx("i", { className: "ti ti-login" }),
        " Autentificare"
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "login-hint", children: [
        /* @__PURE__ */ jsx("i", { className: "ti ti-info-circle" }),
        "Demo: admin / admin"
      ] })
    ] })
  ] }) });
}
function TopBar({
  auth,
  theme,
  setTheme,
  drawerOpen,
  setDrawerOpen,
  onLogout
}) {
  return /* @__PURE__ */ jsxs("div", { className: "top-bar", children: [
    /* @__PURE__ */ jsx(
      "button",
      {
        className: "hamburger-float top-bar-hamburger",
        onClick: () => setDrawerOpen(!drawerOpen),
        title: "Meniu",
        children: /* @__PURE__ */ jsx("i", { className: "ti ti-menu-2" })
      }
    ),
    /* @__PURE__ */ jsxs("div", { className: "top-bar-brand", children: [
      /* @__PURE__ */ jsx("div", { className: "brand-icon", style: { width: 28, height: 28, fontSize: 14 }, children: /* @__PURE__ */ jsx("i", { className: "ti ti-wifi" }) }),
      /* @__PURE__ */ jsx("span", { className: "brand-title", style: { fontSize: 14 }, children: "AirFlow Nexus" })
    ] }),
    /* @__PURE__ */ jsx("div", { style: { flex: 1 } }),
    /* @__PURE__ */ jsx("span", { className: `role-badge ${auth.role}`, children: auth.role === "admin" ? /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("i", { className: "ti ti-shield-half" }),
      " Admin"
    ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("i", { className: "ti ti-user" }),
      " Pasager"
    ] }) }),
    /* @__PURE__ */ jsx("span", { style: { fontSize: 12, color: "var(--text-muted)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: auth.displayName }),
    /* @__PURE__ */ jsx(
      "button",
      {
        className: "btn-theme-toggle",
        onClick: () => setTheme(theme === "dark" ? "light" : "dark"),
        title: "Schimbă tema",
        children: /* @__PURE__ */ jsx("i", { className: `ti ${theme === "dark" ? "ti-sun" : "ti-moon"}` })
      }
    ),
    /* @__PURE__ */ jsx("button", { className: "btn-theme-toggle", onClick: onLogout, title: "Deconectare", children: /* @__PURE__ */ jsx("i", { className: "ti ti-logout" }) })
  ] });
}
const PHONE_HISTORY_KEY = "airhack_phone_history";
function loadPhoneHistory() {
  try {
    return JSON.parse(localStorage.getItem(PHONE_HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function savePhoneHistory(num) {
  const prev = loadPhoneHistory().filter((n) => n !== num);
  localStorage.setItem(PHONE_HISTORY_KEY, JSON.stringify([num, ...prev].slice(0, 10)));
}
function BottomBar({ activePerson, setActivePerson }) {
  const [phone, setPhone] = useState("");
  const [history, setHistory] = useState([]);
  useEffect(() => {
    setHistory(loadPhoneHistory());
  }, []);
  const handlePhone = (val) => {
    setPhone(val);
    const match = PHONE_PERSONS[val.trim()];
    if (match) {
      setActivePerson(match);
      savePhoneHistory(val.trim());
      setHistory(loadPhoneHistory());
    }
  };
  const person = PEOPLE.find((p) => p.id === activePerson && p.id !== "you");
  const flight = person ? FLIGHTS.find((f) => f.id === person.flightId) : null;
  const isAdmin = activePerson === "you";
  return /* @__PURE__ */ jsxs("div", { className: "bottom-bar", children: [
    /* @__PURE__ */ jsxs(
      "button",
      {
        className: `btn-tab${isAdmin ? " active" : ""}`,
        onClick: () => {
          setActivePerson("you");
          setPhone("");
        },
        style: { flex: "0 0 auto", gap: 6, color: isAdmin ? "var(--brand)" : void 0, borderColor: isAdmin ? "var(--brand)" : void 0 },
        children: [
          /* @__PURE__ */ jsx("i", { className: "ti ti-shield-half", style: { fontSize: 17 } }),
          /* @__PURE__ */ jsx("span", { children: "Admin" })
        ]
      }
    ),
    /* @__PURE__ */ jsxs("div", { style: { flex: 1, display: "flex", alignItems: "center", gap: 10, minWidth: 0 }, children: [
      /* @__PURE__ */ jsxs("div", { style: { flex: 1, position: "relative", minWidth: 0 }, children: [
        /* @__PURE__ */ jsx("datalist", { id: "phone-history", children: history.map((n) => /* @__PURE__ */ jsx("option", { value: n }, n)) }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "tel",
            list: "phone-history",
            className: "phone-input",
            placeholder: "Introdu numărul de telefon",
            value: phone,
            onChange: (e) => handlePhone(e.target.value)
          }
        )
      ] }),
      person && flight && /* @__PURE__ */ jsxs("div", { className: "fade-in", style: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }, children: [
        /* @__PURE__ */ jsx("span", { style: { width: 8, height: 8, borderRadius: "50%", background: person.color, flexShrink: 0 } }),
        /* @__PURE__ */ jsxs("span", { style: { fontSize: 12, fontWeight: 600, color: person.color, whiteSpace: "nowrap" }, children: [
          flight.flight,
          " · ",
          GATE_LABELS[flight.gate]
        ] }),
        /* @__PURE__ */ jsx("span", { style: { fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }, children: flight.departs })
      ] }),
      !person && !isAdmin && phone.length > 4 && /* @__PURE__ */ jsx("span", { style: { fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }, children: "Număr nerecunoscut" })
    ] })
  ] });
}
function FlowPredictionCenter({ onLog }) {
  const [securityLanes, setSecurityLanes] = useState(2);
  const securityETA = Math.ceil(185 * 45 / securityLanes / 60);
  return /* @__PURE__ */ jsxs("div", { style: { padding: 20 }, children: [
    /* @__PURE__ */ jsxs("h2", { children: [
      /* @__PURE__ */ jsx("i", { className: "ti ti-trending-up" }),
      " Predictor Fluxuri T4"
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { padding: 15, background: "rgba(255,255,255,0.03)", borderRadius: 8, marginTop: 20 }, children: [
      /* @__PURE__ */ jsx("h3", { children: "Filtru Securitate (Masa Echipei)" }),
      /* @__PURE__ */ jsxs("div", { style: { fontSize: 28, fontWeight: "bold", margin: "10px 0", color: securityETA > 15 ? "var(--warning)" : "var(--success)" }, children: [
        securityETA,
        " min ",
        /* @__PURE__ */ jsx("span", { style: { fontSize: 14, fontWeight: "normal", color: "var(--text-muted)" }, children: "așteptare estimată" })
      ] }),
      /* @__PURE__ */ jsxs("p", { children: [
        "Pasageri detectați de Orange API: ",
        /* @__PURE__ */ jsx("strong", { children: "185" })
      ] }),
      /* @__PURE__ */ jsx("label", { style: { fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 5 }, children: "Linii de filtrare deschise:" }),
      /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: 8 }, children: [1, 2, 3, 4].map((n) => /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => {
            setSecurityLanes(n);
            onLog(`Filtre securitate: ${n} linii active`);
          },
          style: { padding: "6px 12px", background: securityLanes === n ? "var(--brand)" : "rgba(255,255,255,0.1)", border: "none", borderRadius: 4, cursor: "pointer", color: "#fff" },
          children: n
        },
        n
      )) })
    ] })
  ] });
}
function BoardingVerifyCenter({ activePerson, onLog }) {
  const [status, setStatus] = useState("idle");
  const run = () => {
    setStatus("idle");
    onLog("Inițiere protocol securitate...");
    setTimeout(() => {
      if (activePerson === "dorel") {
        setStatus("flagged");
        onLog("ALERTĂ: SIM Swap detectat pentru Dorel!", false);
      } else {
        setStatus("verified");
        onLog("Identitate validată. Număr confirmat.");
      }
    }, 1e3);
  };
  return /* @__PURE__ */ jsxs("div", { style: { padding: 20 }, children: [
    /* @__PURE__ */ jsxs("h2", { children: [
      /* @__PURE__ */ jsx("i", { className: "ti ti-shield-lock" }),
      " Verificare Boarding"
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { padding: 20, background: "rgba(255,255,255,0.02)", borderRadius: 8, marginTop: 20 }, children: [
      /* @__PURE__ */ jsxs("button", { onClick: run, style: { padding: "10px 20px", background: "var(--brand)", border: "none", borderRadius: 4, fontWeight: "bold", cursor: "pointer", color: "#fff" }, children: [
        "Verifică Pasagerul Curent (",
        activePerson,
        ")"
      ] }),
      status === "verified" && /* @__PURE__ */ jsxs("div", { style: { background: "rgba(40,167,69,0.1)", border: "1px solid var(--success)", padding: 15, borderRadius: 6, marginTop: 20 }, children: [
        /* @__PURE__ */ jsxs("div", { style: { color: "var(--success)", fontWeight: "bold" }, children: [
          /* @__PURE__ */ jsx("i", { className: "ti ti-circle-check" }),
          " VALIDAT DIGITAL"
        ] }),
        /* @__PURE__ */ jsx("p", { style: { fontSize: 13 }, children: "Nu s-au detectat modificări recente ale cartelei SIM." })
      ] }),
      status === "flagged" && /* @__PURE__ */ jsxs("div", { style: { background: "rgba(220,53,69,0.1)", border: "1px solid var(--danger)", padding: 15, borderRadius: 6, marginTop: 20 }, children: [
        /* @__PURE__ */ jsxs("div", { style: { color: "var(--danger)", fontWeight: "bold" }, children: [
          /* @__PURE__ */ jsx("i", { className: "ti ti-alert-triangle" }),
          " ACCES BLOCAT"
        ] }),
        /* @__PURE__ */ jsx("p", { style: { fontSize: 13 }, children: "SIM_SWAP suspect detectat. Interdicție îmbarcare." })
      ] })
    ] })
  ] });
}
function AdminCenter({ onLog, setAnnouncements }) {
  const [inputText, setInputText] = useState("");
  const handleBroadcast = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    setAnnouncements((prev) => [{ id: Date.now(), type: "warning", text: inputText, time: (/* @__PURE__ */ new Date()).toLocaleTimeString() }, ...prev]);
    onLog(`[ADMIN] Anunț trimis: "${inputText}"`);
    setInputText("");
  };
  return /* @__PURE__ */ jsxs("div", { style: { padding: 20 }, children: [
    /* @__PURE__ */ jsxs("h2", { children: [
      /* @__PURE__ */ jsx("i", { className: "ti ti-settings-automation" }),
      " Control Panel Admin"
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { padding: 15, background: "rgba(255,255,255,0.02)", borderRadius: 8, marginTop: 20 }, children: [
      /* @__PURE__ */ jsx("h3", { children: "Emite Anunț Pasageri" }),
      /* @__PURE__ */ jsxs("form", { onSubmit: handleBroadcast, style: { marginTop: 10 }, children: [
        /* @__PURE__ */ jsx(
          "textarea",
          {
            value: inputText,
            onChange: (e) => setInputText(e.target.value),
            placeholder: "Scrie un anunț...",
            style: { width: "100%", height: 70, background: "#111", border: "1px solid #333", borderRadius: 4, color: "#fff", padding: 8, boxSizing: "border-box" }
          }
        ),
        /* @__PURE__ */ jsx("button", { type: "submit", style: { background: "var(--brand)", color: "#fff", border: "none", padding: "6px 14px", borderRadius: 4, marginTop: 10, cursor: "pointer" }, children: "Trimite pe Monitor" })
      ] })
    ] })
  ] });
}
function AnnouncementsCenter({ announcements }) {
  return /* @__PURE__ */ jsxs("div", { style: { padding: 20 }, children: [
    /* @__PURE__ */ jsxs("h2", { children: [
      /* @__PURE__ */ jsx("i", { className: "ti ti-presentation" }),
      " Anunțuri Aeroport"
    ] }),
    announcements.length === 0 && /* @__PURE__ */ jsx("p", { style: { color: "var(--text-muted)", marginTop: 20 }, children: "Niciun anunț activ." }),
    /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }, children: announcements.map((a) => /* @__PURE__ */ jsxs("div", { style: { padding: 15, background: "rgba(255,255,255,0.02)", borderLeft: `5px solid var(--${a.type})`, borderRadius: "0 6px 6px 0" }, children: [
      /* @__PURE__ */ jsx("p", { style: { margin: 0, fontSize: 14, fontWeight: 500 }, children: a.text }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: "var(--text-muted)", marginTop: 5 }, children: a.time })
    ] }, a.id)) })
  ] });
}
function StatusApiCenter() {
  const apis = [
    { name: "Device Location", endpoint: "camara/location-retrieval/v0.3", status: "UP", latency: "142ms", calls: 1240 },
    { name: "Population Density", endpoint: "camara/population-density-data/v0.2", status: "UP", latency: "89ms", calls: 432 },
    { name: "Number Verification", endpoint: "camara/number-verification/v1", status: "UP", latency: "201ms", calls: 87 },
    { name: "SIM Swap", endpoint: "camara/sim-swap/v1", status: "UP", latency: "178ms", calls: 23 }
  ];
  return /* @__PURE__ */ jsxs("div", { style: { padding: 20 }, children: [
    /* @__PURE__ */ jsxs("h2", { children: [
      /* @__PURE__ */ jsx("i", { className: "ti ti-server" }),
      " Status API Orange"
    ] }),
    /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }, children: apis.map((a) => /* @__PURE__ */ jsxs("div", { style: { padding: "12px 16px", background: "var(--bg-body)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", gap: 12 }, children: [
      /* @__PURE__ */ jsx("span", { style: { width: 8, height: 8, borderRadius: "50%", background: "var(--success)", flexShrink: 0 } }),
      /* @__PURE__ */ jsxs("div", { style: { flex: 1 }, children: [
        /* @__PURE__ */ jsx("div", { style: { fontWeight: 600, fontSize: 13 }, children: a.name }),
        /* @__PURE__ */ jsx("div", { style: { fontSize: 11, color: "var(--text-muted)" }, children: a.endpoint })
      ] }),
      /* @__PURE__ */ jsxs("div", { style: { textAlign: "right", fontSize: 12 }, children: [
        /* @__PURE__ */ jsx("div", { style: { color: "var(--success)", fontWeight: 600 }, children: a.status }),
        /* @__PURE__ */ jsxs("div", { style: { color: "var(--text-muted)" }, children: [
          a.latency,
          " · ",
          a.calls.toLocaleString(),
          " req"
        ] })
      ] })
    ] }, a.name)) })
  ] });
}
const PERSON_PROFILES = {
  you: { role: "Admin Aeroport", flight: "—", gate: "—", boarding: "—" },
  misu: { role: "Pasager", flight: "W6 4102", gate: "G2", boarding: "23:45" },
  ionica: { role: "Pasager", flight: "LH 1407", gate: "T3", boarding: "00:10" },
  dorel: { role: "Pasager", flight: "FR 8821", gate: "G5", boarding: "00:30" }
};
function AccountCenter({ activePerson }) {
  const person = PEOPLE.find((p) => p.id === activePerson);
  const profile = PERSON_PROFILES[activePerson];
  return /* @__PURE__ */ jsxs("div", { style: { padding: 20 }, children: [
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }, children: [
      /* @__PURE__ */ jsx("div", { style: { width: 56, height: 56, borderRadius: "50%", background: `${person.color}22`, border: `2px solid ${person.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: person.color }, children: /* @__PURE__ */ jsx("i", { className: "ti ti-user" }) }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("div", { style: { fontSize: 20, fontWeight: 700 }, children: person.name }),
        /* @__PURE__ */ jsx("div", { style: { fontSize: 13, color: "var(--text-muted)" }, children: profile.role })
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: [
      ["Zbor", profile.flight],
      ["Poartă", profile.gate],
      ["Îmbarcare", profile.boarding],
      ["Status", activePerson === "you" ? "🟢 Admin activ" : "🟢 Check-in finalizat"]
    ].map(([l, v]) => /* @__PURE__ */ jsxs("div", { style: { display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "var(--bg-body)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)" }, children: [
      /* @__PURE__ */ jsx("span", { style: { color: "var(--text-muted)", fontSize: 13 }, children: l }),
      /* @__PURE__ */ jsx("span", { style: { fontWeight: 600, fontSize: 13 }, children: v })
    ] }, l)) })
  ] });
}
function SettingsCenter() {
  return /* @__PURE__ */ jsxs("div", { style: { padding: 20 }, children: [
    /* @__PURE__ */ jsxs("h2", { children: [
      /* @__PURE__ */ jsx("i", { className: "ti ti-settings" }),
      " Setări"
    ] }),
    /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: 8, marginTop: 20 }, children: [
      ["Interval refresh date", "30 secunde"],
      ["Mod fixture (mock data)", "Activ"],
      ["Limbă interfață", "Română"],
      ["Versiune aplicație", "1.0.0 · AirHack 2026"]
    ].map(([l, v]) => /* @__PURE__ */ jsxs("div", { style: { display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "var(--bg-body)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)" }, children: [
      /* @__PURE__ */ jsx("span", { style: { color: "var(--text-muted)", fontSize: 13 }, children: l }),
      /* @__PURE__ */ jsx("span", { style: { fontWeight: 600, fontSize: 13 }, children: v })
    ] }, l)) })
  ] });
}

var __freeze = Object.freeze;
var __defProp = Object.defineProperty;
var __template = (cooked, raw) => __freeze(__defProp(cooked, "raw", { value: __freeze(cooked.slice()) }));
var _a;
const $$Index = createComponent(($$result, $$props, $$slots) => {
  const googleMapsKey = "AIzaSyAUPRnG_9PeZJ0BPks33wwmmNUm2FR2Ilw";
  return renderTemplate(_a || (_a = __template(['<html lang="ro"> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css"><title>AirFlow Nexus — Iași Airport</title><script>(function(){', "\n      window.__GOOGLE_MAPS_KEY__ = googleMapsKey;\n    })();</script>", "</head> <body> ", " </body></html>"])), defineScriptVars({ googleMapsKey }), renderHead(), renderComponent($$result, "Dashboard", Dashboard, { "client:load": true, "client:component-hydration": "load", "client:component-path": "E:/Web_Apps/AirHack/AirHack/src/components/Dashboard", "client:component-export": "default" }));
}, "E:/Web_Apps/AirHack/AirHack/src/pages/index.astro", void 0);
const $$file = "E:/Web_Apps/AirHack/AirHack/src/pages/index.astro";
const $$url = "";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };

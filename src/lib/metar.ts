// Pure METAR utilities — formatting, parsing, type definitions.
// No React imports. Safe on both server and client.

// ── Interfaces (canonical source of truth) ──────────────────────────────────

export interface MetarWind {
  directionDeg: number;
  speedKt: number;
  gustKt: number | null;
  variableFrom: number | null;
  variableTo: number | null;
  isVariable: boolean; // VRB
}

export interface MetarCloud {
  cover: string;
  baseFt: number;
  type: string | null;
}

export interface MetarTrend {
  type: "TEMPO" | "BECMG" | "NOSIG";
  wind: MetarWind | null;
  visibility: { meters: number; unlimited: boolean } | null;
  phenomena: string[];
  clouds: MetarCloud[];
}

export interface MetarResponse {
  raw: string;
  station: string;
  observedAt: string;
  wind: MetarWind;
  visibility: { meters: number; unlimited: boolean };
  clouds: MetarCloud[];
  temperature: { tempC: number; dewpointC: number };
  altimeter: { qnhHpa: number };
  phenomena: string[];
  trend: MetarTrend | null;
  flightCategory: "VFR" | "MVFR" | "IFR" | "LIFR";
  fromFixture: boolean;
  provider?: string;
  warning?: string;
}

export type MetarProvider = "noaa" | "checkwx" | "fixture";

// ── NOAA Aviation Weather API response shape ─────────────────────────────────

export interface NoaaMetarItem {
  rawOb: string | null;
  icaoId: string;
  obsTime: number; // unix timestamp (seconds)
  temp: number | null;
  dewp: number | null;
  wdir: number | string | null; // degrees or "VRB"
  wspd: number | null;
  wgst: number | null;
  visib: string | number | null; // SM or "6+" for unlimited
  altim: number | null;
  skyCondition: Array<{ skyCover: string; cloudBase?: number; cloudType?: string }> | null;
  wxString: string | null;
  fltcat: string | null;
}

// ── NOAA → MetarResponse parser ──────────────────────────────────────────────

export function parseNoaaMetar(item: NoaaMetarItem): MetarResponse {
  const raw = item.rawOb ?? "";

  // Wind
  const isVrb = item.wdir === "VRB" || item.wdir === 0;
  const dirDeg = typeof item.wdir === "number" ? item.wdir : 0;

  // Variable wind range from raw string: e.g. "27008KT 280V350"
  const varMatch = raw.match(/(\d{3})V(\d{3})/);
  const variableFrom = varMatch ? parseInt(varMatch[1], 10) : null;
  const variableTo = varMatch ? parseInt(varMatch[2], 10) : null;

  const wind: MetarWind = {
    directionDeg: dirDeg,
    speedKt: item.wspd ?? 0,
    gustKt: item.wgst ?? null,
    variableFrom,
    variableTo,
    isVariable: !!isVrb,
  };

  // Visibility — NOAA gives statute miles as string or number
  const vis = parseVisibilitySM(item.visib);

  // Clouds
  const clouds: MetarCloud[] = (item.skyCondition ?? []).map((sc) => ({
    cover: sc.skyCover,
    baseFt: sc.cloudBase ?? 0,
    type: sc.cloudType ?? extractCloudTypeFromRaw(raw, sc.skyCover, sc.cloudBase ?? 0),
  }));

  // Weather phenomena from wxString
  const phenomena: string[] = item.wxString
    ? item.wxString.split(" ").filter(Boolean)
    : [];

  // Temperature
  const temperature = {
    tempC: item.temp ?? 0,
    dewpointC: item.dewp ?? 0,
  };

  // Altimeter
  const altimeter = { qnhHpa: item.altim ?? 1013 };

  // Flight category
  const flightCategory = normalizeFltCat(item.fltcat);

  // Trend from raw string
  const trend = parseTrendFromRaw(raw);

  return {
    raw: raw.startsWith("METAR") ? raw : `METAR ${raw}`,
    station: item.icaoId,
    observedAt: new Date(item.obsTime * 1000).toISOString(),
    wind,
    visibility: vis,
    clouds,
    temperature,
    altimeter,
    phenomena,
    trend,
    flightCategory,
    fromFixture: false,
    provider: "noaa",
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseVisibilitySM(
  visib: string | number | null
): { meters: number; unlimited: boolean } {
  if (visib === null) return { meters: 9999, unlimited: true };
  const s = String(visib).trim();
  if (s === "6+" || s === "10+" || parseFloat(s) >= 6) {
    return { meters: 9999, unlimited: true };
  }
  const sm = parseFloat(s);
  if (!isNaN(sm)) return { meters: Math.round(sm * 1609.34), unlimited: sm >= 6 };
  return { meters: 9999, unlimited: true };
}

function normalizeFltCat(
  cat: string | null
): "VFR" | "MVFR" | "IFR" | "LIFR" {
  switch ((cat ?? "").toUpperCase()) {
    case "VFR":  return "VFR";
    case "MVFR": return "MVFR";
    case "IFR":  return "IFR";
    case "LIFR": return "LIFR";
    default:     return "VFR";
  }
}

function extractCloudTypeFromRaw(
  raw: string,
  cover: string,
  baseFt: number
): string | null {
  // Look for patterns like FEW025CB or BKN040TCU in the raw string
  const baseCode = String(Math.round(baseFt / 100)).padStart(3, "0");
  const match = raw.match(new RegExp(`${cover}${baseCode}(CB|TCU)`));
  return match ? match[1] : null;
}

function parseTrendFromRaw(raw: string): MetarTrend | null {
  if (raw.includes("NOSIG")) {
    return { type: "NOSIG", wind: null, visibility: null, phenomena: [], clouds: [] };
  }

  const tempoIdx = raw.indexOf(" TEMPO ");
  const becmgIdx = raw.indexOf(" BECMG ");
  const trendIdx = tempoIdx !== -1 ? tempoIdx : becmgIdx !== -1 ? becmgIdx : -1;
  if (trendIdx === -1) return null;

  const trendType: "TEMPO" | "BECMG" = tempoIdx !== -1 ? "TEMPO" : "BECMG";
  // Everything after the keyword
  const trendStr = raw.slice(trendIdx + 7).replace(/=$/, "").trim();

  // Wind in trend: 31020G32KT or VRB05KT
  const windMatch = trendStr.match(/(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT/);
  let trendWind: MetarWind | null = null;
  if (windMatch) {
    trendWind = {
      directionDeg: windMatch[1] === "VRB" ? 0 : parseInt(windMatch[1], 10),
      speedKt: parseInt(windMatch[2], 10),
      gustKt: windMatch[3] ? parseInt(windMatch[3], 10) : null,
      variableFrom: null,
      variableTo: null,
      isVariable: windMatch[1] === "VRB",
    };
  }

  // Visibility in trend: 4-digit meters like 3000
  const visMatch = trendStr.match(/\b([0-9]{4})\b/);
  const trendVis = visMatch
    ? { meters: parseInt(visMatch[1], 10), unlimited: parseInt(visMatch[1], 10) >= 9000 }
    : null;

  // Phenomena
  const wxTokens = ["TSRA", "TS", "RA", "SN", "FG", "BR", "DZ", "GR", "SHRA", "SHSN", "RASN"];
  const phenomena = wxTokens.filter((wx) => trendStr.includes(wx));

  // Clouds
  const cloudMatches = [...trendStr.matchAll(/(FEW|SCT|BKN|OVC|VV)(\d{3})(CB|TCU)?/g)];
  const clouds: MetarCloud[] = cloudMatches.map((m) => ({
    cover: m[1],
    baseFt: parseInt(m[2], 10) * 100,
    type: m[3] ?? null,
  }));

  return { type: trendType, wind: trendWind, visibility: trendVis, phenomena, clouds };
}

// ── Display formatters ────────────────────────────────────────────────────────

export function flightCategoryColor(
  cat: "VFR" | "MVFR" | "IFR" | "LIFR"
): { bg: string; text: string; border: string } {
  switch (cat) {
    case "VFR":  return { bg: "bg-green-500/20",   text: "text-green-400",   border: "border-green-500/50" };
    case "MVFR": return { bg: "bg-blue-500/20",    text: "text-blue-400",    border: "border-blue-500/50" };
    case "IFR":  return { bg: "bg-red-500/20",     text: "text-red-400",     border: "border-red-500/50" };
    case "LIFR": return { bg: "bg-fuchsia-500/20", text: "text-fuchsia-400", border: "border-fuchsia-500/50" };
  }
}

const COMPASS_POINTS = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];

export function windDirectionLabel(deg: number): string {
  const index = Math.round(((deg % 360) + 360) / 22.5) % 16;
  return COMPASS_POINTS[index];
}

const COVER_LABELS: Record<string, string> = {
  SKC: "Sky Clear", CLR: "Clear", FEW: "Few", SCT: "Scattered",
  BKN: "Broken", OVC: "Overcast", VV: "Vertical Vis.",
};

export function cloudCoverLabel(cover: string): string {
  return COVER_LABELS[cover] ?? cover;
}

export function cloudCoverPercent(cover: string): number {
  switch (cover) {
    case "SKC": case "CLR": return 0;
    case "FEW": return 25;
    case "SCT": return 50;
    case "BKN": return 75;
    case "OVC": case "VV": return 100;
    default: return 0;
  }
}

export function formatQnh(hpa: number): string {
  return `${hpa} hPa / ${(hpa * 0.02953).toFixed(2)} inHg`;
}

export function formatVisibility(meters: number, unlimited: boolean): string {
  if (unlimited || meters >= 9999) return "> 10 km";
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${meters} m`;
}

export function formatTemp(c: number): string {
  return `${c >= 0 ? "+" : ""}${c}°C`;
}

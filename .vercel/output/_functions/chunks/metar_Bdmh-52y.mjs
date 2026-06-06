import path from 'path';
import fs from 'fs';

function parseNoaaMetar(item) {
  const raw = item.rawOb ?? "";
  const isVrb = item.wdir === "VRB" || item.wdir === 0;
  const dirDeg = typeof item.wdir === "number" ? item.wdir : 0;
  const varMatch = raw.match(/(\d{3})V(\d{3})/);
  const variableFrom = varMatch ? parseInt(varMatch[1], 10) : null;
  const variableTo = varMatch ? parseInt(varMatch[2], 10) : null;
  const wind = {
    directionDeg: dirDeg,
    speedKt: item.wspd ?? 0,
    gustKt: item.wgst ?? null,
    variableFrom,
    variableTo,
    isVariable: !!isVrb
  };
  const vis = parseVisibilitySM(item.visib);
  const clouds = (item.skyCondition ?? []).map((sc) => ({
    cover: sc.skyCover,
    baseFt: sc.cloudBase ?? 0,
    type: sc.cloudType ?? extractCloudTypeFromRaw(raw, sc.skyCover, sc.cloudBase ?? 0)
  }));
  const phenomena = item.wxString ? item.wxString.split(" ").filter(Boolean) : [];
  const temperature = {
    tempC: item.temp ?? 0,
    dewpointC: item.dewp ?? 0
  };
  const altimeter = { qnhHpa: item.altim ?? 1013 };
  const flightCategory = normalizeFltCat(item.fltcat);
  const trend = parseTrendFromRaw(raw);
  return {
    raw: raw.startsWith("METAR") ? raw : `METAR ${raw}`,
    station: item.icaoId,
    observedAt: new Date(item.obsTime * 1e3).toISOString(),
    wind,
    visibility: vis,
    clouds,
    temperature,
    altimeter,
    phenomena,
    trend,
    flightCategory,
    fromFixture: false,
    provider: "noaa"
  };
}
function parseVisibilitySM(visib) {
  if (visib === null) return { meters: 9999, unlimited: true };
  const s = String(visib).trim();
  if (s === "6+" || s === "10+" || parseFloat(s) >= 6) {
    return { meters: 9999, unlimited: true };
  }
  const sm = parseFloat(s);
  if (!isNaN(sm)) return { meters: Math.round(sm * 1609.34), unlimited: sm >= 6 };
  return { meters: 9999, unlimited: true };
}
function normalizeFltCat(cat) {
  switch ((cat ?? "").toUpperCase()) {
    case "VFR":
      return "VFR";
    case "MVFR":
      return "MVFR";
    case "IFR":
      return "IFR";
    case "LIFR":
      return "LIFR";
    default:
      return "VFR";
  }
}
function extractCloudTypeFromRaw(raw, cover, baseFt) {
  const baseCode = String(Math.round(baseFt / 100)).padStart(3, "0");
  const match = raw.match(new RegExp(`${cover}${baseCode}(CB|TCU)`));
  return match ? match[1] : null;
}
function parseTrendFromRaw(raw) {
  if (raw.includes("NOSIG")) {
    return { type: "NOSIG", wind: null, visibility: null, phenomena: [], clouds: [] };
  }
  const tempoIdx = raw.indexOf(" TEMPO ");
  const becmgIdx = raw.indexOf(" BECMG ");
  const trendIdx = tempoIdx !== -1 ? tempoIdx : becmgIdx !== -1 ? becmgIdx : -1;
  if (trendIdx === -1) return null;
  const trendType = tempoIdx !== -1 ? "TEMPO" : "BECMG";
  const trendStr = raw.slice(trendIdx + 7).replace(/=$/, "").trim();
  const windMatch = trendStr.match(/(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT/);
  let trendWind = null;
  if (windMatch) {
    trendWind = {
      directionDeg: windMatch[1] === "VRB" ? 0 : parseInt(windMatch[1], 10),
      speedKt: parseInt(windMatch[2], 10),
      gustKt: windMatch[3] ? parseInt(windMatch[3], 10) : null,
      variableFrom: null,
      variableTo: null,
      isVariable: windMatch[1] === "VRB"
    };
  }
  const visMatch = trendStr.match(/\b([0-9]{4})\b/);
  const trendVis = visMatch ? { meters: parseInt(visMatch[1], 10), unlimited: parseInt(visMatch[1], 10) >= 9e3 } : null;
  const wxTokens = ["TSRA", "TS", "RA", "SN", "FG", "BR", "DZ", "GR", "SHRA", "SHSN", "RASN"];
  const phenomena = wxTokens.filter((wx) => trendStr.includes(wx));
  const cloudMatches = [...trendStr.matchAll(/(FEW|SCT|BKN|OVC|VV)(\d{3})(CB|TCU)?/g)];
  const clouds = cloudMatches.map((m) => ({
    cover: m[1],
    baseFt: parseInt(m[2], 10) * 100,
    type: m[3] ?? null
  }));
  return { type: trendType, wind: trendWind, visibility: trendVis, phenomena, clouds };
}

const NOAA_BASE = "https://aviationweather.gov/api/data/metar";
const GET = async ({ url }) => {
  const station = url.searchParams.get("station") ?? "LRIA";
  const provider = url.searchParams.get("provider") ?? "noaa";
  if (provider === "fixture") return fixtureResponse(station);
  try {
    const res = await fetch(`${NOAA_BASE}?ids=${station}&format=json&hours=2`, {
      headers: { Accept: "application/json" }
    });
    if (!res.ok) return fixtureResponse(station);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return fixtureResponse(station);
    const parsed = parseNoaaMetar(data[0]);
    return new Response(JSON.stringify(parsed), { headers: { "Content-Type": "application/json" } });
  } catch {
    return fixtureResponse(station);
  }
};
function fixtureResponse(station) {
  const name = station.toUpperCase() === "LRIA" ? "metar-lria.json" : "metar-lfpg.json";
  const filePath = path.join(process.cwd(), "fixtures", name);
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
}

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };

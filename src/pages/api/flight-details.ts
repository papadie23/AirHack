import type { APIRoute } from "astro";

export const prerender = false;

// Map IATA airport code → human-readable city + country
const AIRPORT_NAMES: Record<string, string> = {
  OTP: "București Henri Coandă", BCN: "Barcelona El Prat",
  DUB: "Dublin International", VIE: "Viena Schwechat",
  LTN: "Londra Luton", MXP: "Milano Malpensa",
  BGY: "Milano Orio al Serio", CDG: "Paris Charles de Gaulle",
  FRA: "Frankfurt am Main", MUC: "München Franz Josef Strauss",
  AMS: "Amsterdam Schiphol", MAD: "Madrid Barajas",
  FCO: "Roma Fiumicino", ATH: "Atena Eleftherios Venizelos",
  SKG: "Salonic Macedonia", RHO: "Rodos Diagoras",
  LCA: "Larnaca International", FMM: "Memmingen Allgäu",
  IST: "Istanbul", TLV: "Tel Aviv Ben Gurion",
  WAW: "Varșovia Chopin", BUD: "Budapesta Ferenc Liszt",
  PRG: "Praga Václav Havel", ZRH: "Zürich International",
  BRU: "Bruxelles Zaventem", LIS: "Lisabona Humberto Delgado",
  GVA: "Geneva Cointrin", IAS: "Iași International",
  CLJ: "Cluj-Napoca Avram Iancu", TSR: "Timișoara Traian Vuia",
  SBZ: "Sibiu International", CRA: "Craiova International",
};

const AIRLINE_NAMES: Record<string, string> = {
  RO: "TAROM", W4: "Wizz Air", W6: "Wizz Air",
  LH: "Lufthansa", OS: "Austrian Airlines",
  FR: "Ryanair", U2: "easyJet",
  AF: "Air France", KL: "KLM",
  TK: "Turkish Airlines", LY: "El Al",
  BA: "British Airways", IB: "Iberia",
  A2: "Aegean Airlines", H4: "Hi Sky",
  JU: "Air Serbia",
};

function airportLabel(iata: string): string {
  return AIRPORT_NAMES[iata] ?? iata;
}
function airlineLabel(iata: string): string {
  return AIRLINE_NAMES[iata] ?? iata;
}

// Format "YYYY-MM-DD HH:mm" → "HH:mm"
function timeOnly(dt: string | null | undefined): string {
  if (!dt) return "—";
  return dt.split(" ")[1] ?? "—";
}

// Minutes diff between two "YYYY-MM-DD HH:mm" strings
function minutesDiff(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  const toMs = (s: string) => new Date(s.replace(" ", "T")).getTime();
  return Math.round((toMs(b) - toMs(a)) / 60000);
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const flightIata = url.searchParams.get("flight")?.trim().toUpperCase();

  if (!flightIata) {
    return new Response(JSON.stringify({ error: "Parametrul 'flight' lipsește" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.AIRLABS_API_KEY ?? import.meta.env.AIRLABS_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "AIRLABS_API_KEY not set" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Try schedules first (today's flights)
    const res = await fetch(
      `https://airlabs.co/api/v9/schedules?flight_iata=${flightIata}&api_key=${apiKey}`
    );
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `AirLabs error ${res.status}` }), {
        status: res.status, headers: { "Content-Type": "application/json" },
      });
    }
    const data = await res.json();
    const flights = data.response ?? [];

    if (flights.length === 0) {
      return new Response(JSON.stringify({ error: `Zborul ${flightIata} nu a fost găsit pentru azi.` }), {
        status: 404, headers: { "Content-Type": "application/json" },
      });
    }

    const f = flights[0];

    // Compute delay info
    const depDelay = f.dep_delayed ?? null;
    const arrDelay = f.arr_delayed ?? null;

    // Compute elapsed / remaining if active
    const now = new Date();
    const depActualMs = f.dep_actual_ts ? f.dep_actual_ts * 1000 : null;
    const arrEstMs    = f.arr_estimated_ts ? f.arr_estimated_ts * 1000 : null;
    const totalDurMin = f.duration ?? null;

    let elapsedMin: number | null = null;
    let remainingMin: number | null = null;
    let progressPct: number | null = null;

    if (f.status === "active" && depActualMs && arrEstMs) {
      elapsedMin   = Math.max(0, Math.round((now.getTime() - depActualMs) / 60000));
      remainingMin = Math.max(0, Math.round((arrEstMs - now.getTime()) / 60000));
      if (totalDurMin) progressPct = Math.min(100, Math.round((elapsedMin / totalDurMin) * 100));
    }

    const result = {
      flight:        f.flight_iata,
      flightNumber:  f.flight_number,
      airline:       airlineLabel(f.airline_iata),
      airlineIata:   f.airline_iata,
      status:        f.status,

      departure: {
        iata:        f.dep_iata,
        airport:     airportLabel(f.dep_iata),
        terminal:    f.dep_terminal ?? "—",
        gate:        f.dep_gate ?? "—",
        scheduled:   timeOnly(f.dep_time),
        estimated:   timeOnly(f.dep_estimated),
        actual:      timeOnly(f.dep_actual),
        delayed:     depDelay,
      },

      arrival: {
        iata:        f.arr_iata,
        airport:     airportLabel(f.arr_iata),
        terminal:    f.arr_terminal ?? "—",
        gate:        f.arr_gate ?? "—",
        baggage:     f.arr_baggage ?? "—",
        scheduled:   timeOnly(f.arr_time),
        estimated:   timeOnly(f.arr_estimated),
        delayed:     arrDelay,
      },

      duration:      totalDurMin,
      elapsedMin,
      remainingMin,
      progressPct,
      fetchedAt:     new Date().toISOString(),
    };

    return new Response(JSON.stringify(result), {
      status: 200, headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};

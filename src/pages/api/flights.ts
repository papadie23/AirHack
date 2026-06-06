import type { APIRoute } from "astro";

export const prerender = false;

export interface AirLabsFlight {
  flight_iata: string;
  flight_number: string;
  airline_iata: string;
  dep_iata: string;
  dep_terminal: string | null;
  dep_gate: string | null;
  dep_time: string;
  dep_estimated: string | null;
  dep_actual: string | null;
  arr_iata: string;
  arr_time: string;
  status: "scheduled" | "active" | "landed" | "cancelled" | "incident" | "diverted" | string;
  delayed: number | null;
  dep_delayed: number | null;
  duration: number | null;
}

// Map IATA airport code → human-readable city name
const AIRPORT_NAMES: Record<string, string> = {
  OTP: "București OTP", BCN: "Barcelona BCN", DUB: "Dublin DUB",
  VIE: "Viena VIE", LTN: "Londra LTN", MXP: "Milano MXP",
  BGY: "Milano BGY", CDG: "Paris CDG", FRA: "Frankfurt FRA",
  MUC: "München MUC", AMS: "Amsterdam AMS", MAD: "Madrid MAD",
  FCO: "Roma FCO", ATH: "Atena ATH", SKG: "Salonic SKG",
  RHO: "Rodos RHO", LCA: "Larnaca LCA", FMM: "Memmingen FMM",
  IST: "Istanbul IST", TLV: "Tel Aviv TLV", WAW: "Varșovia WAW",
  BUD: "Budapesta BUD", PRG: "Praga PRG", ZRH: "Zürich ZRH",
  BRU: "Bruxelles BRU", LIS: "Lisabona LIS", GVA: "Geneva GVA",
};

function airportLabel(iata: string): string {
  return AIRPORT_NAMES[iata] ?? iata;
}

// Parse "YYYY-MM-DD HH:mm" (local Romania time) → minutes since midnight
function toMinutes(timeStr: string | null | undefined): number | null {
  if (!timeStr) return null;
  const parts = timeStr.split(" ");
  if (parts.length < 2) return null;
  const [hh, mm] = parts[1].split(":").map(Number);
  return hh * 60 + mm;
}

export const GET: APIRoute = async () => {
  const apiKey = process.env.AIRLABS_API_KEY ?? import.meta.env.AIRLABS_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "AIRLABS_API_KEY not set" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const res = await fetch(
      `https://airlabs.co/api/v9/schedules?dep_iata=IAS&api_key=${apiKey}`
    );
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `AirLabs error ${res.status}` }), {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const flights: AirLabsFlight[] = data.response ?? [];

    // Get current Romania time (UTC+3 in summer)
    const now = new Date();
    const roOffset = 3; // EET summer (EEST) = UTC+3
    const roNow = new Date(now.getTime() + roOffset * 60 * 60 * 1000);
    const currentMinutes = roNow.getUTCHours() * 60 + roNow.getUTCMinutes();

    // Window: show flights departing within [-90 min, +180 min] of now
    // Also always show "active" flights regardless of window
    const WINDOW_PAST = 90;
    const WINDOW_FUTURE = 180;

    const filtered = flights
      .filter((f) => {
        if (f.status === "active") return true;
        const depMin = toMinutes(f.dep_actual ?? f.dep_estimated ?? f.dep_time);
        if (depMin === null) return false;
        const diff = depMin - currentMinutes;
        return diff >= -WINDOW_PAST && diff <= WINDOW_FUTURE;
      })
      // Remove codeshare duplicates: keep unique flight_iata
      .filter((f, idx, arr) => arr.findIndex(x => x.flight_iata === f.flight_iata) === idx)
      .sort((a, b) => {
        const aMin = toMinutes(a.dep_actual ?? a.dep_estimated ?? a.dep_time) ?? 9999;
        const bMin = toMinutes(b.dep_actual ?? b.dep_estimated ?? b.dep_time) ?? 9999;
        return aMin - bMin;
      })
      .map((f, i) => {
        const depTime = f.dep_actual ?? f.dep_estimated ?? f.dep_time;
        const timeOnly = depTime?.split(" ")[1] ?? "—";
        const gate = f.dep_gate ?? f.dep_terminal ?? "—";

        return {
          id: String(i + 1),
          flight: f.flight_iata,
          dest: airportLabel(f.arr_iata),
          departs: timeOnly,
          gate: gate,
          status: f.status,
          delayed: f.dep_delayed ?? null,
          arr_iata: f.arr_iata,
          airline_iata: f.airline_iata,
        };
      });

    return new Response(
      JSON.stringify({
        flights: filtered,
        fetchedAt: new Date().toISOString(),
        total: flights.length,
        currentTimeRO: `${String(roNow.getUTCHours()).padStart(2, "0")}:${String(roNow.getUTCMinutes()).padStart(2, "0")}`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

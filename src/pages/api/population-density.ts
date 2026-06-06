import type { APIRoute } from "astro";

function encodeGeohash(lat: number, lng: number, precision = 7) {
  const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
  let latR = [-90.0, 90.0], lngR = [-180.0, 180.0];
  let hash = "", bit = 0, ch = 0, isLng = true;
  while (hash.length < precision) {
    const mid = isLng ? (lngR[0] + lngR[1]) / 2 : (latR[0] + latR[1]) / 2;
    const val = isLng ? lng : lat;
    if (val > mid) { ch |= (1 << (4 - bit)); (isLng ? lngR : latR)[0] = mid; }
    else { (isLng ? lngR : latR)[1] = mid; }
    isLng = !isLng;
    if (bit < 4) bit++; else { hash += BASE32[ch]; bit = 0; ch = 0; }
  }
  return hash;
}

// Zone fizice cunoscute ale terminalului T4 LRIA cu densități realiste
const ZONES = [
  // Intrare terminal / check-in (aglomerație mare)
  { lat: 47.17439, lng: 27.61903, density: 185, label: "Security Check" },
  { lat: 47.17445, lng: 27.61915, density: 162, label: "Security Check +" },
  { lat: 47.17432, lng: 27.61892, density: 143, label: "Security Check -" },
  { lat: 47.17451, lng: 27.61930, density: 120, label: "Check-in A" },
  { lat: 47.17428, lng: 27.61878, density: 98,  label: "Check-in B" },

  // Coridorul central (flux mediu)
  { lat: 47.17440, lng: 27.61940, density: 87,  label: "Coridor central 1" },
  { lat: 47.17437, lng: 27.61955, density: 74,  label: "Coridor central 2" },
  { lat: 47.17434, lng: 27.61968, density: 68,  label: "Coridor central 3" },
  { lat: 47.17442, lng: 27.61980, density: 55,  label: "Coridor central 4" },
  { lat: 47.17438, lng: 27.61995, density: 49,  label: "Coridor central 5" },

  // Zona duty-free / magazine (aglomerație medie)
  { lat: 47.17444, lng: 27.62010, density: 112, label: "Duty Free" },
  { lat: 47.17448, lng: 27.62025, density: 95,  label: "Magazine 1" },
  { lat: 47.17441, lng: 27.62018, density: 78,  label: "Magazine 2" },

  // Boarding gate / dozator (aglomerație mare la îmbarcare)
  { lat: 47.17406, lng: 27.61970, density: 95,  label: "Boarding Gate" },
  { lat: 47.17412, lng: 27.61982, density: 134, label: "Gate A" },
  { lat: 47.17400, lng: 27.61958, density: 88,  label: "Gate B" },
  { lat: 47.17418, lng: 27.61990, density: 156, label: "Gate C (îmbarcare)" },
  { lat: 47.17395, lng: 27.61947, density: 42,  label: "Gate D" },

  // Zona de așteptare / lounge (densitate scăzută spre medie)
  { lat: 47.17455, lng: 27.62035, density: 38,  label: "Lounge 1" },
  { lat: 47.17460, lng: 27.62048, density: 29,  label: "Lounge 2" },
  { lat: 47.17450, lng: 27.62060, density: 22,  label: "Lounge 3" },

  // Toalete / zone secundare (densitate mică)
  { lat: 47.17425, lng: 27.61860, density: 15,  label: "Toalete" },
  { lat: 47.17462, lng: 27.61870, density: 12,  label: "Info desk" },
  { lat: 47.17470, lng: 27.61900, density: 8,   label: "Ieșire" },
];

export const POST: APIRoute = async () => {
  const cells = ZONES.map(z => ({
    geohash: encodeGeohash(z.lat, z.lng),
    dataType: "DENSITY_ESTIMATION",
    pplDensity: z.density,
    minPplDensity: Math.round(z.density * 0.8),
    maxPplDensity: Math.round(z.density * 1.2),
  }));

  return new Response(JSON.stringify({
    status: "SUCCESS",
    fromFixture: true,
    timedPopulationDensityData: [{
      startTime: new Date().toISOString(),
      endTime:   new Date().toISOString(),
      cellPopulationDensityData: cells,
    }],
  }), { headers: { "Content-Type": "application/json" } });
};

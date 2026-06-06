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

export const POST: APIRoute = async () => {
  const hashMasa    = encodeGeohash(47.17439229, 27.61903507);
  const hashDozator = encodeGeohash(47.17406410, 27.61970100);

  return new Response(JSON.stringify({
    status: "SUCCESS",
    fromFixture: true,
    timedPopulationDensityData: [{
      startTime: new Date().toISOString(),
      endTime:   new Date().toISOString(),
      cellPopulationDensityData: [
        { geohash: hashMasa,    dataType: "DENSITY_ESTIMATION", pplDensity: 185 },
        { geohash: hashDozator, dataType: "DENSITY_ESTIMATION", pplDensity: 95  },
      ],
    }],
  }), { headers: { "Content-Type": "application/json" } });
};

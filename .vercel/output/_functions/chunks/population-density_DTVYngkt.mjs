function encodeGeohash(lat, lng, precision = 7) {
  const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
  let latR = [-90, 90], lngR = [-180, 180];
  let hash = "", bit = 0, ch = 0, isLng = true;
  while (hash.length < precision) {
    const mid = isLng ? (lngR[0] + lngR[1]) / 2 : (latR[0] + latR[1]) / 2;
    const val = isLng ? lng : lat;
    if (val > mid) {
      ch |= 1 << 4 - bit;
      (isLng ? lngR : latR)[0] = mid;
    } else {
      (isLng ? lngR : latR)[1] = mid;
    }
    isLng = !isLng;
    if (bit < 4) bit++;
    else {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}
const SECURITY_QUEUE = [
  { lat: 47.17439, lng: 27.61903, d: 210 },
  // nucleu
  { lat: 47.1744, lng: 27.61895, d: 190 },
  { lat: 47.17438, lng: 27.6191, d: 175 },
  { lat: 47.17441, lng: 27.61885, d: 155 },
  { lat: 47.17437, lng: 27.6192, d: 135 },
  { lat: 47.17442, lng: 27.61875, d: 110 },
  { lat: 47.17436, lng: 27.6193, d: 90 },
  { lat: 47.17443, lng: 27.61865, d: 68 },
  { lat: 47.17435, lng: 27.6194, d: 45 },
  { lat: 47.17444, lng: 27.61855, d: 28 }
];
const BOARDING_QUEUE = [
  { lat: 47.17406, lng: 27.6197, d: 195 },
  // nucleu
  { lat: 47.17408, lng: 27.61962, d: 178 },
  { lat: 47.17404, lng: 27.61978, d: 160 },
  { lat: 47.1741, lng: 27.61955, d: 140 },
  { lat: 47.17402, lng: 27.61985, d: 118 },
  { lat: 47.17412, lng: 27.61948, d: 95 },
  { lat: 47.174, lng: 27.61992, d: 72 },
  { lat: 47.17414, lng: 27.6194, d: 50 },
  { lat: 47.17398, lng: 27.61998, d: 32 },
  { lat: 47.17416, lng: 27.61933, d: 18 }
];
const POST = async () => {
  const allZones = [...SECURITY_QUEUE, ...BOARDING_QUEUE];
  const cells = allZones.map((z) => ({
    geohash: encodeGeohash(z.lat, z.lng),
    dataType: "DENSITY_ESTIMATION",
    pplDensity: z.d,
    minPplDensity: Math.round(z.d * 0.8),
    maxPplDensity: Math.round(z.d * 1.2)
  }));
  return new Response(JSON.stringify({
    status: "SUCCESS",
    fromFixture: true,
    timedPopulationDensityData: [{
      startTime: (/* @__PURE__ */ new Date()).toISOString(),
      endTime: (/* @__PURE__ */ new Date()).toISOString(),
      cellPopulationDensityData: cells
    }]
  }), { headers: { "Content-Type": "application/json" } });
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };

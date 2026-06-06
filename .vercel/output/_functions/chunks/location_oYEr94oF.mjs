const HACKATHON_SPOTS = {
  masaEchipei: { lat: 47.17439229, lng: 27.61903507 },
  dozatorApa: { lat: 47.1740641, lng: 27.619701 }
};
const PERSON_LOCATIONS = {
  you: HACKATHON_SPOTS.masaEchipei,
  misu: HACKATHON_SPOTS.masaEchipei,
  ionica: HACKATHON_SPOTS.dozatorApa,
  dorel: HACKATHON_SPOTS.dozatorApa
};
const POST = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const person = (body.person ?? "you").toLowerCase();
  const coords = PERSON_LOCATIONS[person] ?? HACKATHON_SPOTS.masaEchipei;
  return new Response(JSON.stringify({
    person,
    location: { latitude: coords.lat, longitude: coords.lng, radius: 10 },
    fromFixture: true
  }), { headers: { "Content-Type": "application/json" } });
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };

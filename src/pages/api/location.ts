import type { APIRoute } from "astro";

const HACKATHON_SPOTS = {
  masaEchipei: { lat: 47.17439229, lng: 27.61903507 },
  dozatorApa:  { lat: 47.17406410, lng: 27.61970100 },
};

const PERSON_LOCATIONS: Record<string, typeof HACKATHON_SPOTS.masaEchipei> = {
  you:    HACKATHON_SPOTS.masaEchipei,
  misu:   HACKATHON_SPOTS.masaEchipei,
  ionica: HACKATHON_SPOTS.dozatorApa,
  dorel:  HACKATHON_SPOTS.dozatorApa,
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const person: string = (body.person ?? "you").toLowerCase();
  const coords = PERSON_LOCATIONS[person] ?? HACKATHON_SPOTS.masaEchipei;

  return new Response(JSON.stringify({
    person,
    location: { latitude: coords.lat, longitude: coords.lng, radius: 10 },
    fromFixture: true,
  }), { headers: { "Content-Type": "application/json" } });
};

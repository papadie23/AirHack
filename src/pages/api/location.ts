import type { APIRoute } from "astro";
import { orangePost } from "../../lib/orange/client";
import { ORANGE_ENDPOINTS } from "../../lib/orange/endpoints";

const PERSON_FIXTURE: Record<string, string> = {
  misu:   "location-misu.json",
  ionica: "location-ionica.json",
  dorel:  "location-dorel.json",
};

const PERSON_PHONE: Record<string, string> = {
  misu:   "+99012345678",
  ionica: "+99087654321",
  dorel:  "+99011111111",
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const person: string = (body.person ?? "you").toLowerCase();

  if (person === "you") {
    // Browser geolocation is handled client-side; this path shouldn't be called for "you"
    return new Response(JSON.stringify({ error: "Use browser geolocation for 'you'" }), { status: 400 });
  }

  const fixture = PERSON_FIXTURE[person];
  const phoneNumber = PERSON_PHONE[person] ?? "+99012345678";

  const result = await orangePost<{
    lastLocationTime?: string;
    area?: { areaType: string; center: { latitude: number; longitude: number }; radius: number };
  }>(fixture ?? "location-result.json", ORANGE_ENDPOINTS.LOCATION_RETR, {
    device: { phoneNumber },
    maxAge: 3600,
  });

  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.error }), { status: 502 });
  }

  return new Response(JSON.stringify({
    person,
    location: {
      latitude:  result.data?.area?.center?.latitude  ?? null,
      longitude: result.data?.area?.center?.longitude ?? null,
      radius:    result.data?.area?.radius ?? null,
    },
    fromFixture: result.fromFixture,
  }), { headers: { "Content-Type": "application/json" } });
};

import type { APIRoute } from "astro";
import { orangePost } from "../../lib/orange/client";
import { ORANGE_ENDPOINTS, TEST_NUMBERS } from "../../lib/orange/endpoints";

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const phoneNumber: string = body.phoneNumber ?? TEST_NUMBERS.DEFAULT;

  const result = await orangePost<{
    lastLocationTime?: string;
    area?: { areaType: string; center: { latitude: number; longitude: number }; radius: number };
  }>("location-result.json", ORANGE_ENDPOINTS.LOCATION_RETR, {
    device: { phoneNumber },
    maxAge: 3600,
  });

  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.error }), { status: 502 });
  }

  return new Response(
    JSON.stringify({
      phoneNumber,
      timestamp: new Date().toISOString(),
      location: {
        latitude: result.data?.area?.center?.latitude ?? null,
        longitude: result.data?.area?.center?.longitude ?? null,
        radius: result.data?.area?.radius ?? null,
        lastSeen: result.data?.lastLocationTime ?? null,
      },
      raw: result.data,
      fromFixture: result.fromFixture,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
};

import type { APIRoute } from "astro";
import { orangePost } from "../../lib/orange/client";

// LRIA airport bounding polygon (lat/lon)
const LRIA_POLYGON = [
  { latitude: 47.1710, longitude: 27.6195 },
  { latitude: 47.1710, longitude: 27.6285 },
  { latitude: 47.1748, longitude: 27.6285 },
  { latitude: 47.1748, longitude: 27.6195 },
];

const ENDPOINT = "https://api.orange.com/camara/playground/api/population-density-data/v0.2/retrieve";

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const now = new Date();
  const startTime = body.startTime ?? new Date(now.getTime() - 30 * 60000).toISOString();
  const endTime = body.endTime ?? now.toISOString();

  const result = await orangePost(
    "population-density.json",
    ENDPOINT,
    {
      area: { areaType: "POLYGON", boundary: LRIA_POLYGON },
      startTime,
      endTime,
      precision: 7,
    }
  );

  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.error }), { status: 502 });
  }

  return new Response(JSON.stringify({ ...(result.data as object), fromFixture: result.fromFixture }), {
    headers: { "Content-Type": "application/json" },
  });
};

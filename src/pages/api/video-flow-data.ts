import type { APIRoute } from "astro";
import { loadSnapshot } from "../../lib/video-flow";

export const prerender = false;

export const GET: APIRoute = async () => {
  const snapshot = await loadSnapshot();
  return new Response(JSON.stringify(snapshot), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

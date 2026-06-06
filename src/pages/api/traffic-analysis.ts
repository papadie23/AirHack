import type { APIRoute } from "astro";
import { loadSnapshot } from "../../lib/video-flow";
import { analyzeTraffic } from "../../lib/llm-dispatcher";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const flightContext = url.searchParams.get("flights") ?? undefined;
  const snapshot = await loadSnapshot();
  const report = await analyzeTraffic(snapshot, flightContext);

  return new Response(JSON.stringify(report), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

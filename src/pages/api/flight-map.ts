import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const dep = url.searchParams.get("dep")?.trim().toUpperCase();
  const arr = url.searchParams.get("arr")?.trim().toUpperCase();
  const depLat = url.searchParams.get("depLat");
  const depLon = url.searchParams.get("depLon");
  const arrLat = url.searchParams.get("arrLat");
  const arrLon = url.searchParams.get("arrLon");

  if (!dep || !arr || !depLat || !depLon || !arrLat || !arrLon) {
    return new Response(JSON.stringify({ error: "Missing parameters" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY ?? import.meta.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "GOOGLE_MAPS_API_KEY not set" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  const staticUrl = [
    "https://maps.googleapis.com/maps/api/staticmap",
    `?size=640x300&scale=2&maptype=terrain`,
    `&markers=color:green|size:mid|${depLat},${depLon}`,
    `&markers=color:blue|size:mid|${arrLat},${arrLon}`,
    `&path=geodesic:true|color:0xFF6600CC|weight:4|${depLat},${depLon}|${arrLat},${arrLon}`,
    `&key=${apiKey}`,
  ].join("");

  const res = await fetch(staticUrl);
  if (!res.ok) {
    return new Response(`Google Maps error ${res.status}`, { status: res.status });
  }

  const img = await res.arrayBuffer();
  return new Response(img, {
    status: 200,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
};

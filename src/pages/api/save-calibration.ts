import type { APIRoute } from "astro";
import fs from "fs";
import path from "path";

export const POST: APIRoute = async ({ request }) => {
  const { points } = await request.json();
  if (!Array.isArray(points) || points.length < 3) {
    return new Response(JSON.stringify({ error: "Minim 3 puncte" }), { status: 400 });
  }

  const filePath = path.join(process.cwd(), "src/components/Dashboard.tsx");
  let src = fs.readFileSync(filePath, "utf-8");

  const newBlock = `  const defaultPoints = [\n${points
    .map((p: { svgX: number; svgY: number; lat: number; lng: number }) =>
      `    { svgX: ${p.svgX.toFixed(2)}, svgY: ${p.svgY.toFixed(2)}, lat: ${p.lat}, lng: ${p.lng} }`
    )
    .join(",\n")}\n  ];`;

  // Replace the defaultPoints block inside loadCalibration
  src = src.replace(
    /const defaultPoints = \[[\s\S]*?\];/,
    newBlock
  );

  fs.writeFileSync(filePath, src, "utf-8");
  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
};

import fs from 'fs';
import path from 'path';

const POST = async ({ request }) => {
  const { points } = await request.json();
  if (!Array.isArray(points) || points.length < 3) {
    return new Response(JSON.stringify({ error: "Minim 3 puncte" }), { status: 400 });
  }
  const filePath = path.join(process.cwd(), "src/components/Dashboard.tsx");
  let src = fs.readFileSync(filePath, "utf-8");
  const newBlock = `  const defaultPoints = [
${points.map(
    (p) => `    { svgX: ${p.svgX.toFixed(2)}, svgY: ${p.svgY.toFixed(2)}, lat: ${p.lat}, lng: ${p.lng} }`
  ).join(",\n")}
  ];`;
  src = src.replace(
    /const defaultPoints = \[[\s\S]*?\];/,
    newBlock
  );
  fs.writeFileSync(filePath, src, "utf-8");
  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };

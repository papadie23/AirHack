import path from 'path';
import fs from 'fs';

const GET = async ({ url }) => {
  const provider = url.searchParams.get("provider") ?? "open-meteo";
  return fixtureResponse(provider);
};
function fixtureResponse(provider) {
  const filePath = path.join(process.cwd(), "fixtures", "weather-iasi.json");
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return json({ ...data, provider, fromFixture: true });
}
function json(data) {
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
}

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };

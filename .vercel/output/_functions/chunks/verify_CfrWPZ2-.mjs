import path from 'path';
import fs from 'fs';

const TEST_NUMBERS = {
  LEGIT: "+99012345678",
  FRAUD: "+99098765432"
};

async function orangePost(fixtureFile, endpoint, body) {
  return loadFixture(fixtureFile);
}
function loadFixture(filename) {
  try {
    const filePath = path.join(process.cwd(), "fixtures", filename);
    const raw = fs.readFileSync(filePath, "utf-8");
    return { ok: true, data: JSON.parse(raw), fromFixture: true };
  } catch (err) {
    return { ok: false, data: null, error: `Fixture load failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

const POST = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const scenario = body.scenario ?? "legit";
  const phoneNumber = body.phoneNumber ?? (scenario === "fraud" ? TEST_NUMBERS.FRAUD : TEST_NUMBERS.LEGIT);
  const numVerif = await orangePost(
    "number-verification-success.json");
  if (!numVerif.ok) {
    return new Response(JSON.stringify({ error: numVerif.error }), { status: 502 });
  }
  const simSwap = await orangePost(
    scenario === "fraud" ? "sim-swap-fraud.json" : "sim-swap-legit.json");
  if (!simSwap.ok) {
    return new Response(JSON.stringify({ error: simSwap.error }), { status: 502 });
  }
  const simSwapped = simSwap.data?.swapped ?? false;
  return new Response(
    JSON.stringify({
      verified: numVerif.data?.devicePhoneNumberVerified ?? false,
      simSwapped,
      decision: simSwapped ? "BLOCK" : "ALLOW",
      phoneNumber,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      raw: { numberVerification: numVerif.data, simSwap: simSwap.data },
      fromFixture: numVerif.fromFixture || simSwap.fromFixture
    }),
    { headers: { "Content-Type": "application/json" } }
  );
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };

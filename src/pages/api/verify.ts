import type { APIRoute } from "astro";
import { orangePost } from "../../lib/orange/client";
import { ORANGE_ENDPOINTS, TEST_NUMBERS } from "../../lib/orange/endpoints";

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const scenario: string = body.scenario ?? "legit";
  const phoneNumber: string =
    body.phoneNumber ?? (scenario === "fraud" ? TEST_NUMBERS.FRAUD : TEST_NUMBERS.LEGIT);

  const numVerif = await orangePost<{ devicePhoneNumberVerified: boolean }>(
    "number-verification-success.json",
    ORANGE_ENDPOINTS.NUMBER_VERIF,
    { phoneNumber }
  );
  if (!numVerif.ok) {
    return new Response(JSON.stringify({ error: numVerif.error }), { status: 502 });
  }

  const simSwap = await orangePost<{ swapped: boolean; latestSimChange?: string }>(
    scenario === "fraud" ? "sim-swap-fraud.json" : "sim-swap-legit.json",
    ORANGE_ENDPOINTS.SIM_SWAP,
    { phoneNumber, maxAge: 240 }
  );
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
      timestamp: new Date().toISOString(),
      raw: { numberVerification: numVerif.data, simSwap: simSwap.data },
      fromFixture: numVerif.fromFixture || simSwap.fromFixture,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
};

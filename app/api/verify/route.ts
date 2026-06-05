import { NextRequest, NextResponse } from "next/server";
import { orangePost } from "@/lib/orange/client";
import { ORANGE_ENDPOINTS, TEST_NUMBERS } from "@/lib/orange/endpoints";

interface SimSwapResult {
  swapped: boolean;
  latestSimChange?: string;
}

interface NumberVerifResult {
  devicePhoneNumberVerified: boolean;
}

export type VerifyDecision = "ALLOW" | "BLOCK";

export interface VerifyResponse {
  verified: boolean;
  simSwapped: boolean;
  decision: VerifyDecision;
  phoneNumber: string;
  timestamp: string;
  raw: {
    numberVerification: unknown;
    simSwap: unknown;
  };
  fromFixture?: boolean;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // scenario: "legit" | "fraud" — controls which SIM swap fixture is loaded
  const scenario: string = body.scenario ?? "legit";
  const phoneNumber: string =
    body.phoneNumber ?? (scenario === "fraud" ? TEST_NUMBERS.FRAUD : TEST_NUMBERS.LEGIT);

  // Step 1: Number Verification
  const numberVerifFixture = "number-verification-success.json";
  const numberVerifResult = await orangePost<NumberVerifResult>(
    numberVerifFixture,
    ORANGE_ENDPOINTS.NUMBER_VERIF,
    { phoneNumber }
  );

  if (!numberVerifResult.ok) {
    return NextResponse.json(
      { error: "Number verification failed", detail: numberVerifResult.error },
      { status: 502 }
    );
  }

  const verified = numberVerifResult.data?.devicePhoneNumberVerified ?? false;

  // Step 2: SIM Swap check
  const simSwapFixture =
    scenario === "fraud" ? "sim-swap-fraud.json" : "sim-swap-legit.json";

  const simSwapResult = await orangePost<SimSwapResult>(
    simSwapFixture,
    ORANGE_ENDPOINTS.SIM_SWAP,
    { phoneNumber, maxAge: 240 }
  );

  if (!simSwapResult.ok) {
    return NextResponse.json(
      { error: "SIM swap check failed", detail: simSwapResult.error },
      { status: 502 }
    );
  }

  const simSwapped = simSwapResult.data?.swapped ?? false;

  // Decision logic: block if recent SIM swap detected
  const decision: VerifyDecision = simSwapped ? "BLOCK" : "ALLOW";

  const response: VerifyResponse = {
    verified,
    simSwapped,
    decision,
    phoneNumber,
    timestamp: new Date().toISOString(),
    raw: {
      numberVerification: numberVerifResult.data,
      simSwap: simSwapResult.data,
    },
    fromFixture: numberVerifResult.fromFixture || simSwapResult.fromFixture,
  };

  return NextResponse.json(response);
}

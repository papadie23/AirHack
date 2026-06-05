import { NextRequest, NextResponse } from "next/server";
import { orangePost } from "@/lib/orange/client";
import { ORANGE_ENDPOINTS, TEST_NUMBERS } from "@/lib/orange/endpoints";

interface LocationRaw {
  lastLocationTime?: string;
  area?: {
    areaType: string;
    center: { latitude: number; longitude: number };
    radius: number;
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const phoneNumber: string = body.phoneNumber ?? TEST_NUMBERS.DEFAULT;

  const result = await orangePost<LocationRaw>(
    "location-result.json",
    ORANGE_ENDPOINTS.LOCATION_RETR,
    { device: { phoneNumber }, maxAge: 3600 }
  );

  if (!result.ok) {
    return NextResponse.json(
      { error: "Location retrieval failed", detail: result.error },
      { status: 502 }
    );
  }

  const raw = result.data;

  return NextResponse.json({
    phoneNumber,
    timestamp: new Date().toISOString(),
    location: {
      latitude: raw?.area?.center?.latitude ?? null,
      longitude: raw?.area?.center?.longitude ?? null,
      radius: raw?.area?.radius ?? null,
      lastSeen: raw?.lastLocationTime ?? null,
    },
    raw,
    fromFixture: result.fromFixture,
  });
}

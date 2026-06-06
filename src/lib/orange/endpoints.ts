// Central registry of all Orange CAMARA Playground endpoints.
// Edit this file to update URLs/versions without touching route handlers.

export const ORANGE_ENDPOINTS = {
  TOKEN: "https://api.orange.com/openidconnect/playground/v1.0/token",

  // Identity pillar
  // TODO: verify exact path/version against Orange docs — number-verification may differ
  NUMBER_VERIF:
    "https://api.orange.com/camara/playground/api/number-verification/v1/verify",

  // Location pillar
  LOCATION_RETR:
    "https://api.orange.com/camara/playground/api/location-retrieval/v0.3/retrieve",

  GEOFENCING:
    "https://api.orange.com/camara/playground/api/geofencing/v0.3/subscriptions",

  // Admin (provision test numbers, list provisioned devices)
  ADMIN: "https://api.orange.com/camara/playground/admin/v1.0/action",
} as const;

// Test phone numbers pre-provisioned in the Orange Playground (+990 country code)
export const TEST_NUMBERS = {
  DEFAULT: "+99012345678",
  LEGIT: "+99012345678",
  FRAUD: "+99098765432",
} as const;

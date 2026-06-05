# AirHack — Smart Airport Connectivity

Orange CAMARA Network API hackathon demo. Next.js 16 App Router + TypeScript + Tailwind CSS.

## Stack
- **Framework**: Next.js 16 (App Router), TypeScript, Tailwind CSS v4
- **Backend**: Route Handlers under `app/api/` — these are the only files that touch Orange APIs
- **Frontend**: React client components, single-page dashboard at `app/page.tsx`
- **No database, no auth**

## Critical security rule
**The Orange `client_secret` and access token MUST live only on the server.**
- `lib/orange/token.ts` fetches and caches the token in server memory
- `lib/orange/client.ts` is the single shared helper for all Orange calls
- The browser calls `/api/verify` and `/api/location` — our own routes — and receives clean JSON
- **The browser never sees the Bearer token**

## Endpoint registry
All Orange endpoint URLs live in **`lib/orange/endpoints.ts`** — edit there, never hardcode elsewhere.

| Key | URL |
|-----|-----|
| TOKEN | `https://api.orange.com/openidconnect/playground/v1.0/token` |
| SIM_SWAP | `https://api.orange.com/camara/playground/api/sim-swap/v1/check` |
| NUMBER_VERIF | `https://api.orange.com/camara/playground/api/number-verification/v1/verify` |
| LOCATION_RETR | `https://api.orange.com/camara/playground/api/location-retrieval/v0.3/retrieve` |
| GEOFENCING | `https://api.orange.com/camara/playground/api/geofencing/v0.3/subscriptions` |
| QOD | `https://api.orange.com/camara/playground/api/quality-on-demand/v0.11/sessions` |
| ADMIN | `https://api.orange.com/camara/playground/admin/v1.0/action` |

> TODO: verify NUMBER_VERIF path/version against the official Orange docs.

## Test numbers (+990 country code)
Pre-provisioned in the Orange Playground:
- `+99012345678` — "legit" passenger (no recent SIM swap)
- `+99098765432` — "fraud" scenario (used by the fraud fixture)

Use the ADMIN endpoint to `CREATE` or `LIST` provisioned numbers.

## Fixture system
`USE_FIXTURES=true` (default) makes all API routes return pre-saved JSON from `/fixtures/` instead of calling Orange. The UI looks identical in both modes — this is the demo safety net.

| Fixture file | Scenario |
|---|---|
| `number-verification-success.json` | Phone number verified |
| `sim-swap-legit.json` | No recent SIM swap → ALLOW |
| `sim-swap-fraud.json` | Recent SIM swap → BLOCK |
| `location-result.json` | CDG airport coordinates |

To switch to live calls: set `USE_FIXTURES=false` in `.env.local` and add real credentials.

## Demo scenario (hero flow)
1. **Legit passenger** — press "Verify legit passenger" → number verified, no SIM swap → green ALLOW
2. **Fraud attempt** — press "Verify fraud attempt" → SIM swapped 2 hours ago → red BLOCK + alert
3. **Location** — press "Trigger location notification" → coordinates returned, gate notification shown

Decision logic in `app/api/verify/route.ts`: `BLOCK` if `simSwapped === true`, else `ALLOW`.

# AirHack — Smart Airport Connectivity

Hackathon demo: Orange CAMARA Network APIs powering a passenger journey — identity verification at the gate with fraud detection and location-aware notifications.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000 — the full demo runs immediately on **fixture data** (no credentials needed).

## Demo flow

Press the buttons in the bottom of the left panel:

| Button | What it shows |
|--------|---------------|
| **Verify legit passenger** | Number verified + no recent SIM swap → **green ALLOW** |
| **Verify fraud attempt** | SIM swap detected 2h ago → **red BLOCK** + security alert |
| **Trigger location notification** | Location retrieved at CDG → gate notification sent |

The right panel shows the raw CAMARA API responses and a live activity log.

## Environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

| Variable | Default | Description |
|---|---|---|
| `USE_FIXTURES` | `true` | Use local JSON fixtures instead of calling Orange |
| `ORANGE_CLIENT_ID` | — | Orange API client ID (needed when `USE_FIXTURES=false`) |
| `ORANGE_CLIENT_SECRET` | — | Orange API client secret (server-side only) |

## Architecture

```
app/
  page.tsx              ← client dashboard (3-zone layout)
  api/
    verify/route.ts     ← POST: Number Verification + SIM Swap → ALLOW/BLOCK
    location/route.ts   ← POST: Location Retrieval
components/
  PhoneMockup.tsx       ← passenger phone view
  OpsPanel.tsx          ← network terminal / API log
  DemoControls.tsx      ← demo buttons
lib/orange/
  token.ts              ← server-only token fetch + memory cache
  endpoints.ts          ← central URL registry (edit here)
  client.ts             ← shared POST helper (fixture-aware)
fixtures/               ← saved CAMARA response JSON
```

**Security**: `ORANGE_CLIENT_SECRET` and the Bearer token are server-side only. The browser only calls `/api/*` routes and receives clean JSON.

## Orange CAMARA endpoints used

- **Number Verification** `POST /camara/playground/api/number-verification/v1/verify`
- **SIM Swap** `POST /camara/playground/api/sim-swap/v1/check`
- **Location Retrieval** `POST /camara/playground/api/location-retrieval/v0.3/retrieve`

All URLs are in `lib/orange/endpoints.ts`. Test numbers use `+990` country code.

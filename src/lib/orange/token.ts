import { ORANGE_ENDPOINTS } from "./endpoints";

interface TokenCache {
  accessToken: string;
  expiresAt: number; // ms timestamp
}

let cache: TokenCache | null = null;

// Refresh 5 minutes before expiry
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cache && now < cache.expiresAt - REFRESH_BUFFER_MS) {
    return cache.accessToken;
  }

  const clientId = process.env.ORANGE_CLIENT_ID;
  const clientSecret = process.env.ORANGE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "ORANGE_CLIENT_ID and ORANGE_CLIENT_SECRET must be set in environment variables"
    );
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  const response = await fetch(ORANGE_ENDPOINTS.TOKEN, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Token request failed: ${response.status} ${response.statusText} — ${text}`
    );
  }

  const data = await response.json();
  const expiresIn: number = data.expires_in ?? 3600;

  cache = {
    accessToken: data.access_token,
    expiresAt: now + expiresIn * 1000,
  };

  return cache.accessToken;
}

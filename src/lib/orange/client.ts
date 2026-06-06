/**
 * Shared server-side helper for calling Orange CAMARA Playground endpoints.
 *
 * SECURITY: This file must only run on the server. The access token is fetched
 * here and never returned to the browser. All /api/* routes use this helper.
 */

import { getAccessToken } from "./token";

async function getBearerToken(): Promise<string> {
  // Direct API key takes priority over OAuth client credentials
  if (process.env.ORANGE_API_KEY) {
    return process.env.ORANGE_API_KEY;
  }
  return getAccessToken();
}
import path from "path";
import fs from "fs";

const USE_FIXTURES = process.env.USE_FIXTURES !== "false"; // default true

export interface OrangeCallResult<T = unknown> {
  ok: boolean;
  data: T | null;
  error?: string;
  fromFixture?: boolean;
}

/**
 * Call an Orange CAMARA endpoint (or return fixture data when USE_FIXTURES=true).
 *
 * @param fixtureFile  Filename inside /fixtures (e.g. "sim-swap-legit.json")
 * @param endpoint     Full Orange API URL
 * @param body         Request body (will be JSON-serialized)
 */
export async function orangePost<T = unknown>(
  fixtureFile: string,
  endpoint: string,
  body: Record<string, unknown>
): Promise<OrangeCallResult<T>> {
  if (USE_FIXTURES) {
    return loadFixture<T>(fixtureFile);
  }

  try {
    const token = await getBearerToken();

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        ok: false,
        data: null,
        error: `${response.status} ${response.statusText}: ${text}`,
      };
    }

    const data = (await response.json()) as T;
    return { ok: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, data: null, error: message };
  }
}

function loadFixture<T>(filename: string): OrangeCallResult<T> {
  try {
    const filePath = path.join(process.cwd(), "fixtures", filename);
    const raw = fs.readFileSync(filePath, "utf-8");
    return { ok: true, data: JSON.parse(raw) as T, fromFixture: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, data: null, error: `Fixture load failed: ${message}` };
  }
}

import { getAccessToken } from "./token";
import path from "path";
import fs from "fs";

async function getBearerToken(): Promise<string> {
  const key = import.meta.env.ORANGE_API_KEY ?? process.env.ORANGE_API_KEY;
  if (key) return key;
  return getAccessToken();
}

const USE_FIXTURES = (import.meta.env.USE_FIXTURES ?? process.env.USE_FIXTURES) !== "false";

export interface OrangeCallResult<T = unknown> {
  ok: boolean;
  data: T | null;
  error?: string;
  fromFixture?: boolean;
}

export async function orangePost<T = unknown>(
  fixtureFile: string,
  endpoint: string,
  body: Record<string, unknown>
): Promise<OrangeCallResult<T>> {
  if (USE_FIXTURES) return loadFixture<T>(fixtureFile);
  try {
    const token = await getBearerToken();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      return { ok: false, data: null, error: `${response.status} ${response.statusText}: ${text}` };
    }
    return { ok: true, data: (await response.json()) as T };
  } catch (err) {
    return { ok: false, data: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function orangePostWithKey<T = unknown>(
  apiKey: string | undefined,
  fixtureFile: string,
  endpoint: string,
  body: Record<string, unknown>
): Promise<OrangeCallResult<T>> {
  const useFixtures = (import.meta.env.USE_FIXTURES ?? process.env.USE_FIXTURES) !== "false";
  if (useFixtures || !apiKey) return loadFixture<T>(fixtureFile);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      return { ok: false, data: null, error: `${response.status} ${response.statusText}: ${text}` };
    }
    return { ok: true, data: (await response.json()) as T };
  } catch (err) {
    return { ok: false, data: null, error: err instanceof Error ? err.message : String(err) };
  }
}

function loadFixture<T>(filename: string): OrangeCallResult<T> {
  try {
    const filePath = path.join(process.cwd(), "fixtures", filename);
    const raw = fs.readFileSync(filePath, "utf-8");
    return { ok: true, data: JSON.parse(raw) as T, fromFixture: true };
  } catch (err) {
    return { ok: false, data: null, error: `Fixture load failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

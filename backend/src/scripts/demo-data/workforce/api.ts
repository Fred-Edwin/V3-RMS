/** A small client for the lane's API, so the seed's flows go through the real routes (every rule, PIN and audit entry applies). */
import { DEMO_PASSWORD, DEMO_PIN, emailOf } from './roster';

export const API = `${process.env['API'] ?? 'http://localhost:4106'}/api/v1`;
export const PIN = DEMO_PIN;

export type Body = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- loose JSON from the API
export interface Reply { status: number; data: Body | undefined; error: string; headers: Headers }

const tokens = new Map<string, string>();
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Signs in a roster person by the part of their email before the @. Waits and retries if the login door is busy. */
export async function login(local: string): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const res = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: emailOf(local), password: DEMO_PASSWORD }) });
    if (res.status === 429) { await sleep(20_000); continue; }
    const json = (await res.json()) as { data?: { accessToken?: string } };
    if (!json.data?.accessToken) throw new Error(`login failed for ${local}: ${res.status}`);
    tokens.set(local, json.data.accessToken);
    return;
  }
  throw new Error(`login for ${local} stayed rate limited`);
}

export async function call(who: string, method: string, path: string, body?: object, headers: Record<string, string> = {}): Promise<Reply> {
  const res = await fetch(`${API}${path}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${tokens.get(who)}`, ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const json = (await res.json().catch(() => ({}))) as { data?: Body; error?: { code?: string; message?: string } };
  return { status: res.status, data: json.data, error: `${json.error?.code ?? ''} ${json.error?.message ?? ''}`.trim(), headers: res.headers };
}

/** Like `call`, but a failure stops the seed with the API's own words. */
export async function must(label: string, who: string, method: string, path: string, body?: object, headers: Record<string, string> = {}): Promise<Body> {
  const reply = await call(who, method, path, body, headers);
  if (reply.status >= 300) throw new Error(`${label} failed: ${reply.status} ${reply.error}`);
  return reply.data ?? {};
}

let keys = 0;
export const key = (label: string): string => `demo-${label}-${Date.now()}-${(keys += 1)}`;

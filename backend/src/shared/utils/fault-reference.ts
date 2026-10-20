import { createHash, randomBytes } from 'node:crypto';
import type { Request } from 'express';

// No 0/O/1/I: a reference is read aloud and typed into a support message.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * The short handle a screen shows with a server fault, "WF-7Q4K": `WF-` and four characters taken from the request id, so the
 * same request always gives the same reference and support can search the log for it. A request with no id gets a random one.
 */
export function faultReference(req: Pick<Request, 'id'> | { id?: unknown }): string {
  const id = 'id' in req && req.id !== undefined && req.id !== null ? String(req.id) : null;
  const bytes = id === null ? randomBytes(4) : createHash('sha256').update(id).digest();
  let out = '';
  for (let i = 0; i < 4; i += 1) out += ALPHABET[(bytes[i] ?? 0) % ALPHABET.length];
  return `WF-${out}`;
}

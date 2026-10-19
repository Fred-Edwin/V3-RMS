import { beforeEach, describe, expect, it, vi } from 'vitest';

const hashes = vi.hoisted(() => new Map<string, string | null>());
vi.mock('./signer-pin-repository', () => ({ signerPinRepository: { hashOf: async (id: string) => hashes.get(id) ?? null } }));
vi.mock('../../../../utils/password', () => ({ comparePin: async (pin: string, hash: string) => pin === hash }));

import { LOCK_WINDOW_MS, MAX_WRONG_PINS, resetPinTries, verifySignerPin } from './signer-pin';

const T0 = Date.parse('2026-10-06T08:00:00Z');

beforeEach(() => {
  hashes.clear();
  hashes.set('u1', '1234');
  hashes.set('u2', '4321');
  resetPinTries();
});

describe('the signer’s PIN', () => {
  it('the right PIN signs, with the method and the time, and never returns the PIN', async () => {
    const signature = await verifySignerPin('u1', '1234', T0);
    expect(signature).toEqual({ method: 'PIN', signedAt: new Date(T0) });
  });

  it('a wrong PIN is a 403 PIN_INVALID (not a 401, which the apps treat as logged out)', async () => {
    await expect(verifySignerPin('u1', '0000', T0)).rejects.toMatchObject({ statusCode: 403, code: 'PIN_INVALID' });
  });

  it('no PIN set is a 403 PIN_NOT_SET, so the screen can send the person to set one', async () => {
    await expect(verifySignerPin('nobody', '1234', T0)).rejects.toMatchObject({ statusCode: 403, code: 'PIN_NOT_SET' });
  });

  it('locks after five wrong tries, even for the right PIN, for ten minutes, for that person only', async () => {
    for (let i = 0; i < MAX_WRONG_PINS; i += 1) await expect(verifySignerPin('u1', '0000', T0 + i)).rejects.toMatchObject({ code: 'PIN_INVALID' });
    await expect(verifySignerPin('u1', '1234', T0 + 10)).rejects.toMatchObject({ statusCode: 429, code: 'PIN_LOCKED' });
    await expect(verifySignerPin('u2', '4321', T0 + 10)).resolves.toBeTruthy();
    await expect(verifySignerPin('u1', '1234', T0 + LOCK_WINDOW_MS + 10)).resolves.toBeTruthy();
  });

  it('a right PIN clears the count', async () => {
    for (let i = 0; i < MAX_WRONG_PINS - 1; i += 1) await expect(verifySignerPin('u1', '0000', T0)).rejects.toBeTruthy();
    await verifySignerPin('u1', '1234', T0);
    for (let i = 0; i < MAX_WRONG_PINS - 1; i += 1) await expect(verifySignerPin('u1', '0000', T0)).rejects.toMatchObject({ code: 'PIN_INVALID' });
    await expect(verifySignerPin('u1', '1234', T0)).resolves.toBeTruthy();
  });
});

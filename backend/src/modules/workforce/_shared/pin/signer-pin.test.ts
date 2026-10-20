import { beforeEach, describe, expect, it, vi } from 'vitest';

const hashes = vi.hoisted(() => new Map<string, string | null>());
vi.mock('./signer-pin-repository', () => ({ signerPinRepository: { hashOf: async (id: string) => hashes.get(id) ?? null } }));
vi.mock('../../../../utils/password', () => ({ comparePin: async (pin: string, hash: string) => pin === hash }));

import { setWrongThresholdListener } from './pin-door';
import { resetPinTries, verifySignerPin } from './signer-pin';

const MAX_WRONG_PINS = 5;

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

  it('pauses after the fifth wrong try, even for the right PIN, for that person only, and never locks', async () => {
    for (let i = 0; i < MAX_WRONG_PINS; i += 1) await expect(verifySignerPin('u1', '0000', T0 + i)).rejects.toMatchObject({ code: 'PIN_INVALID' });
    await expect(verifySignerPin('u1', '1234', T0 + 10)).rejects.toMatchObject({ statusCode: 429, code: 'PIN_SLOWED', details: { waitSeconds: 2 } });
    await expect(verifySignerPin('u2', '4321', T0 + 10)).resolves.toBeTruthy();
    await expect(verifySignerPin('u1', '1234', T0 + 3_000)).resolves.toBeTruthy(); // 2 s later it signs: a pause, not a lock
  });

  it('the pause grows 2, 4, 8, 16, then 30 seconds with each further wrong try', async () => {
    let t = T0;
    const waits: number[] = [];
    for (let i = 0; i < 9; i += 1) {
      const error = await verifySignerPin('u1', '0000', t).catch((e: { details?: { waitSeconds?: number } }) => e);
      waits.push((error as { details?: { waitSeconds?: number } }).details?.waitSeconds ?? 0);
      t += 31_000; // always past the pause, so every try is answered
    }
    expect(waits).toEqual([0, 0, 0, 0, 2, 4, 8, 16, 30]);
  });

  it('tells the listener once, on the third wrong try of a window', async () => {
    const heard: number[] = [];
    setWrongThresholdListener(async (e) => void heard.push(e.count));
    for (let i = 0; i < 4; i += 1) await expect(verifySignerPin('u1', '0000', T0 + i)).rejects.toBeTruthy();
    setWrongThresholdListener(null);
    expect(heard).toEqual([3]);
  });

  it('a failing listener never changes the answer', async () => {
    setWrongThresholdListener(async () => {
      throw new Error('audit down');
    });
    for (let i = 0; i < 3; i += 1) await expect(verifySignerPin('u1', '0000', T0 + i)).rejects.toMatchObject({ code: 'PIN_INVALID' });
    setWrongThresholdListener(null);
  });

  it('a right PIN clears the count', async () => {
    for (let i = 0; i < MAX_WRONG_PINS - 1; i += 1) await expect(verifySignerPin('u1', '0000', T0)).rejects.toBeTruthy();
    await verifySignerPin('u1', '1234', T0);
    for (let i = 0; i < MAX_WRONG_PINS - 1; i += 1) await expect(verifySignerPin('u1', '0000', T0)).rejects.toMatchObject({ code: 'PIN_INVALID' });
    await expect(verifySignerPin('u1', '1234', T0)).resolves.toBeTruthy();
  });

  it('two phones guessing at the same moment are counted one after the other', async () => {
    const results = await Promise.allSettled([1, 2, 3, 4, 5, 6].map(() => verifySignerPin('u1', '0000', T0)));
    const codes = results.map((r) => (r.status === 'rejected' ? (r.reason as { code: string }).code : 'OK'));
    expect(codes.filter((c) => c === 'PIN_INVALID')).toHaveLength(5);
    expect(codes.filter((c) => c === 'PIN_SLOWED')).toHaveLength(1);
  });
});

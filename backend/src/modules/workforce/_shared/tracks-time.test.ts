import { afterEach, describe, expect, it } from 'vitest';
import { requireTracksTime, setTracksTimeResolver, tracksTime } from './tracks-time';

afterEach(() => setTracksTimeResolver(null));

describe('tracks time', () => {
  it('defaults per role: Accountant and Store Attendant clock in, Branch Manager does not', async () => {
    expect(await tracksTime({ id: 'u', role: 'ACCOUNTANT' })).toBe(true);
    expect(await tracksTime({ id: 'u', role: 'STORE_ATTENDANT' })).toBe(true);
    expect(await tracksTime({ id: 'u', role: 'MANAGER' })).toBe(false);
  });

  it('a registered resolver overrides the default', async () => {
    setTracksTimeResolver(async () => false);
    expect(await tracksTime({ id: 'u', role: 'WAITER' })).toBe(false);
  });

  it('requireTracksTime refuses someone who does not clock in', async () => {
    await expect(requireTracksTime({ id: 'u', role: 'DIRECTOR' })).rejects.toMatchObject({ statusCode: 403 });
    await expect(requireTracksTime({ id: 'u', role: 'WAITER' })).resolves.toBeUndefined();
  });
});

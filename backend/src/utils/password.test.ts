import { describe, expect, it } from 'vitest';
import { comparePassword, hashPassword } from './password';

describe('password utils', () => {
  it('hashes and compares valid password', async () => {
    const hash = await hashPassword('MySecret123!');
    const matches = await comparePassword('MySecret123!', hash);

    expect(matches).toBe(true);
  });

  it('returns false for wrong password', async () => {
    const hash = await hashPassword('MySecret123!');
    const matches = await comparePassword('WrongPass123!', hash);

    expect(matches).toBe(false);
  });
});

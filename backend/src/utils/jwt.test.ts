import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from './jwt';
import { env } from '../config/env';
import { UnauthorizedError } from './errors';

describe('jwt utils', () => {
  it('signs and verifies access token payload', () => {
    const token = signAccessToken({
      userId: 'user-1',
      role: 'MANAGER',
      organizationId: 'org-1',
    });

    const payload = verifyAccessToken(token);
    expect(payload.userId).toBe('user-1');
    expect(payload.role).toBe('MANAGER');
    expect(payload.organizationId).toBe('org-1');
  });

  it('signs and verifies refresh token payload', () => {
    const token = signRefreshToken({ userId: 'user-2' });
    const payload = verifyRefreshToken(token);

    expect(payload.userId).toBe('user-2');
  });

  it('generates unique refresh tokens for the same payload in quick succession', () => {
    const first = signRefreshToken({ userId: 'user-2' });
    const second = signRefreshToken({ userId: 'user-2' });

    expect(first).not.toBe(second);
  });

  it('throws UnauthorizedError for tampered access token', () => {
    const token = signAccessToken({
      userId: 'user-1',
      role: 'MANAGER',
      organizationId: 'org-1',
    });
    const tampered = `${token}x`;

    expect(() => verifyAccessToken(tampered)).toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError for expired access token', () => {
    const expired = jwt.sign(
      {
        userId: 'user-1',
        role: 'MANAGER',
        organizationId: 'org-1',
      },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '-10s' },
    );

    expect(() => verifyAccessToken(expired)).toThrow(UnauthorizedError);
  });
});

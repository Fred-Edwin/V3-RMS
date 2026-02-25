import crypto from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authRepository } from '../repositories/auth-repository';
import { UnauthorizedError } from '../utils/errors';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { authService } from './auth-service';

vi.mock('../repositories/auth-repository', () => ({
  authRepository: {
    findRefreshToken: vi.fn(),
    deleteRefreshToken: vi.fn(),
    findUserById: vi.fn(),
    saveRefreshToken: vi.fn(),
  },
}));

vi.mock('../utils/jwt', () => ({
  signAccessToken: vi.fn(),
  signRefreshToken: vi.fn(),
  verifyRefreshToken: vi.fn(),
}));

const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

describe('authService.refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(verifyRefreshToken).mockReturnValue({ userId: 'user-1' });
    vi.mocked(signRefreshToken).mockReturnValue('new-refresh-token');
    vi.mocked(signAccessToken).mockReturnValue('new-access-token');
    vi.mocked(authRepository.findRefreshToken).mockResolvedValue({
      id: 'refresh-1',
      userId: 'user-1',
      tokenHash: hashToken('old-refresh-token'),
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    });
    vi.mocked(authRepository.findUserById).mockResolvedValue({
      id: 'user-1',
      name: 'Manager One',
      email: 'manager@wendo.test',
      role: 'MANAGER',
      organizationId: 'org-1',
      isActive: true,
      phone: null,
      organization: {
        name: 'Wendo Nyeri',
      },
    });
    vi.mocked(authRepository.deleteRefreshToken).mockResolvedValue({ count: 1 });
    vi.mocked(authRepository.saveRefreshToken).mockResolvedValue({
      id: 'refresh-2',
      userId: 'user-1',
      tokenHash: hashToken('new-refresh-token'),
      expiresAt: new Date(Date.now() + 120_000),
      createdAt: new Date(),
    });
  });

  it('rotates refresh token and returns a new access token', async () => {
    const result = await authService.refresh('old-refresh-token');

    expect(result.accessToken).toBe('new-access-token');
    expect(result.refreshToken).toBe('new-refresh-token');
    expect(authRepository.findRefreshToken).toHaveBeenCalledWith(hashToken('old-refresh-token'));
    expect(authRepository.deleteRefreshToken).toHaveBeenCalledWith(hashToken('old-refresh-token'));
    expect(authRepository.saveRefreshToken).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        tokenHash: hashToken('new-refresh-token'),
      }),
    );
  });

  it('rejects when the refresh token was already consumed by a concurrent request', async () => {
    vi.mocked(authRepository.deleteRefreshToken).mockResolvedValueOnce({ count: 0 });

    const refreshAttempt = authService.refresh('old-refresh-token');
    await expect(refreshAttempt).rejects.toThrow(UnauthorizedError);
    await expect(refreshAttempt).rejects.toThrow('Refresh token already used');
    expect(authRepository.saveRefreshToken).not.toHaveBeenCalled();
  });
});

import crypto from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authRepository } from '../repositories/auth-repository';
import { UnauthorizedError, ValidationError } from '../utils/errors';
import { comparePassword } from '../utils/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { authService } from './auth-service';

vi.mock('../repositories/auth-repository', () => ({
  authRepository: {
    findRefreshToken: vi.fn(),
    deleteRefreshToken: vi.fn(),
    findUserById: vi.fn(),
    saveRefreshToken: vi.fn(),
    updatePinHash: vi.fn(),
    findUserByIdWithPassword: vi.fn(),
    hasPin: vi.fn(),
  },
}));

vi.mock('../utils/password', () => ({
  comparePassword: vi.fn(),
  hashPassword: vi.fn(),
  hashPin: vi.fn().mockResolvedValue('hashed-pin'),
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
      siteId: 'org-1',
      departmentTag: null,
      isDepartmentHead: false,
      isActive: true,
      phone: null,
      site: {
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

describe('authService.setPin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authRepository.updatePinHash).mockResolvedValue({} as never);
  });

  it('first set (no PIN yet): hashes the PIN and stores it, no password needed', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue({
      id: 'user-1',
      pinHash: null,
      passwordHash: 'pw-hash',
    } as never);

    await authService.setPin({ userId: 'user-1', pin: '4821' });

    expect(comparePassword).not.toHaveBeenCalled();
    expect(authRepository.updatePinHash).toHaveBeenCalledWith('user-1', 'hashed-pin');
  });

  it('change (PIN exists): rejects when the current password is missing', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue({
      id: 'user-1',
      pinHash: 'old-hash',
      passwordHash: 'pw-hash',
    } as never);

    await expect(authService.setPin({ userId: 'user-1', pin: '4821' })).rejects.toBeInstanceOf(ValidationError);
    expect(authRepository.updatePinHash).not.toHaveBeenCalled();
  });

  it('change (PIN exists): rejects a wrong current password', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue({
      id: 'user-1',
      pinHash: 'old-hash',
      passwordHash: 'pw-hash',
    } as never);
    vi.mocked(comparePassword).mockResolvedValue(false);

    await expect(
      authService.setPin({ userId: 'user-1', pin: '4821', currentPassword: 'wrong' }),
    ).rejects.toThrow('Current password is incorrect');
    expect(authRepository.updatePinHash).not.toHaveBeenCalled();
  });

  it('change (PIN exists): accepts the correct current password', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue({
      id: 'user-1',
      pinHash: 'old-hash',
      passwordHash: 'pw-hash',
    } as never);
    vi.mocked(comparePassword).mockResolvedValue(true);

    await authService.setPin({ userId: 'user-1', pin: '4821', currentPassword: 'right-password' });

    expect(authRepository.updatePinHash).toHaveBeenCalledWith('user-1', 'hashed-pin');
  });

  it('rejects an unknown user', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue(null);

    await expect(authService.setPin({ userId: 'ghost', pin: '4821' })).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe('authService.getPinStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns only a boolean, never the hash', async () => {
    vi.mocked(authRepository.hasPin).mockResolvedValue(true);
    await expect(authService.getPinStatus('user-1')).resolves.toEqual({ hasPin: true });

    vi.mocked(authRepository.hasPin).mockResolvedValue(false);
    await expect(authService.getPinStatus('user-1')).resolves.toEqual({ hasPin: false });
  });

  it('rejects an unknown user', async () => {
    vi.mocked(authRepository.hasPin).mockResolvedValue(null);
    await expect(authService.getPinStatus('ghost')).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

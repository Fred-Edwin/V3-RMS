import crypto from 'crypto';
import { authRepository } from '../repositories/auth-repository';
import { comparePassword, hashPassword, hashPin } from '../utils/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { UnauthorizedError, ValidationError } from '../utils/errors';
import { env } from '../config/env';

interface LoginInput {
  email: string;
  password: string;
}

interface ChangePasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const expiresAtFromDuration = (duration: string): Date => {
  const match = /^(\d+)([mhd])$/.exec(duration);
  if (!match) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 7);
    return fallback;
  }

  const amount = Number.parseInt(match[1] ?? '0', 10);
  const unit = match[2];
  const expiresAt = new Date();

  if (unit === 'm') {
    expiresAt.setMinutes(expiresAt.getMinutes() + amount);
  } else if (unit === 'h') {
    expiresAt.setHours(expiresAt.getHours() + amount);
  } else {
    expiresAt.setDate(expiresAt.getDate() + amount);
  }

  return expiresAt;
};

export const authService = {
  login: async ({ email, password }: LoginInput) => {
    const user = await authRepository.findUserByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const isValidPassword = await comparePassword(password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account deactivated');
    }

    const accessToken = signAccessToken({
      userId: user.id,
      role: user.role,
      organizationId: user.organizationId,
      departmentTag: user.departmentTag,
      isDepartmentHead: user.isDepartmentHead,
    });
    const refreshToken = signRefreshToken({ userId: user.id });
    const refreshTokenHash = hashToken(refreshToken);

    await authRepository.saveRefreshToken({
      userId: user.id,
      tokenHash: refreshTokenHash,
      expiresAt: expiresAtFromDuration(env.JWT_REFRESH_EXPIRES_IN),
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        organizationName: user.organization?.name ?? null,
        departmentTag: user.departmentTag,
        isDepartmentHead: user.isDepartmentHead,
      },
    };
  },

  refresh: async (rawRefreshToken: string) => {
    const payload = verifyRefreshToken(rawRefreshToken);
    const oldTokenHash = hashToken(rawRefreshToken);

    const existingToken = await authRepository.findRefreshToken(oldTokenHash);
    if (!existingToken) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    if (existingToken.expiresAt.getTime() <= Date.now()) {
      await authRepository.deleteRefreshToken(oldTokenHash);
      throw new UnauthorizedError('Refresh token expired');
    }

    const user = await authRepository.findUserById(payload.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const newRefreshToken = signRefreshToken({ userId: payload.userId });
    const newRefreshTokenHash = hashToken(newRefreshToken);
    const deleted = await authRepository.deleteRefreshToken(oldTokenHash);
    if (deleted.count === 0) {
      throw new UnauthorizedError('Refresh token already used');
    }

    await authRepository.saveRefreshToken({
      userId: payload.userId,
      tokenHash: newRefreshTokenHash,
      expiresAt: expiresAtFromDuration(env.JWT_REFRESH_EXPIRES_IN),
    });

    const accessToken = signAccessToken({
      userId: user.id,
      role: user.role,
      organizationId: user.organizationId,
      departmentTag: user.departmentTag,
      isDepartmentHead: user.isDepartmentHead,
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        organizationName: user.organization?.name ?? null,
        departmentTag: user.departmentTag,
        isDepartmentHead: user.isDepartmentHead,
      },
    };
  },

  logout: async (rawRefreshToken: string): Promise<void> => {
    const tokenHash = hashToken(rawRefreshToken);
    await authRepository.deleteRefreshToken(tokenHash);
  },

  changePassword: async ({ userId, currentPassword, newPassword }: ChangePasswordInput): Promise<void> => {
    const user = await authRepository.findUserByIdWithPassword(userId);
    if (!user) {
      throw new UnauthorizedError('Invalid user');
    }

    const isValidPassword = await comparePassword(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      throw new ValidationError('Current password is incorrect');
    }

    const newPasswordHash = await hashPassword(newPassword);
    await authRepository.updatePassword(user.id, newPasswordHash);

    // Revoke all existing sessions so a compromised token can't persist
    await authRepository.deleteAllRefreshTokensByUserId(user.id);
  },

  // Stateless re-authentication for view-gates (e.g. payslip page).
  // Verifies the supplied password against the current user's hash.
  // Issues no token and changes no session.
  verifyPassword: async ({ userId, password }: { userId: string; password: string }): Promise<void> => {
    const user = await authRepository.findUserByIdWithPassword(userId);
    if (!user) {
      throw new UnauthorizedError('Invalid user');
    }

    const isValidPassword = await comparePassword(password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedError('Password verification failed');
    }
  },

  registerDevice: async (input: { userId: string; fcmToken: string }): Promise<void> => {
    await authRepository.saveFcmToken(input.userId, input.fcmToken);
  },

  // Whether the caller has set a signing PIN (drives the Sign Sheet's
  // "Set your PIN" step and the Team/Profile PIN status). Boolean only.
  getPinStatus: async (userId: string): Promise<{ hasPin: boolean }> => {
    const hasPin = await authRepository.hasPin(userId);
    if (hasPin === null) {
      throw new UnauthorizedError('Invalid user');
    }
    return { hasPin };
  },

  // Sets the caller's own in-app PIN. First set (no pinHash yet) needs nothing
  // beyond authentication. CHANGING an existing PIN requires the current
  // account password, so a stolen session token cannot silently take over
  // signing. A Store Manager clearing an attendant's PIN goes through
  // staffService.resetPin, after which the attendant's next set is a "first set".
  setPin: async (input: { userId: string; pin: string; currentPassword?: string }): Promise<void> => {
    const user = await authRepository.findUserByIdWithPassword(input.userId);
    if (!user) {
      throw new UnauthorizedError('Invalid user');
    }

    if (user.pinHash !== null) {
      if (!input.currentPassword) {
        throw new ValidationError('Current password is required to change your PIN');
      }
      const isValidPassword = await comparePassword(input.currentPassword, user.passwordHash);
      if (!isValidPassword) {
        throw new ValidationError('Current password is incorrect');
      }
    }

    const pinHash = await hashPin(input.pin);
    await authRepository.updatePinHash(input.userId, pinHash);
  },
};

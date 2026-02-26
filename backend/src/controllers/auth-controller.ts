import type { Request, Response } from 'express';
import { env } from '../config/env';
import { authService } from '../services/auth-service';
import { changePasswordSchema, loginSchema, registerDeviceSchema } from '../validators/auth-schemas';
import { UnauthorizedError } from '../utils/errors';

const REFRESH_COOKIE_NAME = 'refreshToken';
const ACCESS_COOKIE_NAME = 'accessToken';
const isProduction = env.NODE_ENV === 'production';
const cookieSameSite: 'none' | 'lax' = isProduction ? 'none' : 'lax';
const cookieDomain = env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {};

const refreshCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: cookieSameSite,
  path: '/',
  ...cookieDomain,
};

const accessCookieOptions = {
  httpOnly: false,
  secure: isProduction,
  sameSite: cookieSameSite,
  path: '/',
  ...cookieDomain,
};

const parseCookieValue = (cookieHeader: string | undefined, key: string): string | null => {
  if (!cookieHeader) {
    return null;
  }

  const parts = cookieHeader.split(';').map((part) => part.trim());
  for (const part of parts) {
    const [cookieKey, ...rest] = part.split('=');
    if (cookieKey === key) {
      return decodeURIComponent(rest.join('='));
    }
  }

  return null;
};

export const authController = {
  login: async (req: Request, res: Response): Promise<void> => {
    const data = loginSchema.parse(req.body);
    const result = await authService.login(data);

    res
      .cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
        ...refreshCookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .cookie(ACCESS_COOKIE_NAME, result.accessToken, {
        ...accessCookieOptions,
        maxAge: 15 * 60 * 1000,
      })
      .status(200)
      .json({
        success: true,
        data: {
          accessToken: result.accessToken,
          user: result.user,
        },
        message: 'Login successful',
      });
  },

  refresh: async (req: Request, res: Response): Promise<void> => {
    const refreshToken = parseCookieValue(req.headers.cookie, REFRESH_COOKIE_NAME);
    if (!refreshToken) {
      throw new UnauthorizedError('Refresh token missing');
    }

    const result = await authService.refresh(refreshToken);

    res
      .cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
        ...refreshCookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .cookie(ACCESS_COOKIE_NAME, result.accessToken, {
        ...accessCookieOptions,
        maxAge: 15 * 60 * 1000,
      })
      .status(200)
      .json({
        success: true,
        data: {
          accessToken: result.accessToken,
          user: result.user,
        },
      });
  },

  logout: async (req: Request, res: Response): Promise<void> => {
    const refreshToken = parseCookieValue(req.headers.cookie, REFRESH_COOKIE_NAME);
    if (refreshToken) {
      await authService.logout(refreshToken);
    }

    res
      .clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions)
      .clearCookie(ACCESS_COOKIE_NAME, accessCookieOptions)
      .status(200)
      .json({
        success: true,
        message: 'Logged out successfully',
      });
  },

  changePassword: async (req: Request, res: Response): Promise<void> => {
    const data = changePasswordSchema.parse(req.body);
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    await authService.changePassword({
      userId: req.user.id,
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });

    res.status(200).json({
      success: true,
      message: 'Password updated successfully',
    });
  },

  registerDevice: async (req: Request, res: Response): Promise<void> => {
    const data = registerDeviceSchema.parse(req.body);
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    await authService.registerDevice({
      userId: req.user.id,
      fcmToken: data.fcmToken,
    });

    res.status(200).json({
      success: true,
      message: 'Device registered for notifications',
    });
  },
};

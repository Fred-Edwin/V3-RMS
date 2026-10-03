import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { AppError } from '../utils/errors';
import { Sentry } from '../config/sentry';
import { keyToWire } from '../shared/utils/wire-names';

interface ErrorWithStatus extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler = (
  error: ErrorWithStatus,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: error.issues.map((issue) => ({
          ...issue,
          path: issue.path.map((segment) => (typeof segment === 'string' ? keyToWire(segment) : segment)),
        })),
      },
    });
    return;
  }

  if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Record not found' },
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
    return;
  }

  const statusCode = error.statusCode ?? 500;
  const code = error.code ?? 'INTERNAL_ERROR';

  // Capture unexpected errors in Sentry (fire-and-forget)
  if (statusCode === 500) {
    Sentry.captureException(error);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: statusCode === 500 ? 'An unexpected error occurred' : error.message,
    },
  });
};

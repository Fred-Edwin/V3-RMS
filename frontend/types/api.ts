export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponseEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: ApiErrorPayload;
  message?: string;
  pagination?: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  };
  totalValue?: number;
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, statusCode: number, code: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Zod validation errors arrive as `error.details: [{ path, message }, ...]`
 * (see backend `inventory-validators.ts`'s `.parse()` failures). The generic
 * top-level `error.message` ("Validation failed") is useless to a user on
 * its own — this pulls the field-specific messages out so a form can show
 * "Buy unit is required" instead. Falls back to `err.message` for any error
 * whose `details` isn't this shape (network errors, non-validation 4xx/5xx).
 */
export function formatApiErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  if (Array.isArray(err.details) && err.details.length > 0) {
    const fieldMessages = err.details
      .map((d) => (d && typeof d === 'object' && 'message' in d ? String((d as { message: unknown }).message) : null))
      .filter((m): m is string => Boolean(m));
    if (fieldMessages.length > 0) return fieldMessages.join(' ');
  }
  return err.message || fallback;
}

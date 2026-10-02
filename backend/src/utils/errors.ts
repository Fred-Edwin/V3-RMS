export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', code = 'AUTHENTICATION_ERROR', details?: unknown) {
    super(401, code, message, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', code = 'AUTHORIZATION_ERROR', details?: unknown) {
    super(403, code, message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found', code = 'NOT_FOUND', details?: unknown) {
    super(404, code, message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code = 'CONFLICT', details?: unknown) {
    super(409, code, message, details);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, code = 'VALIDATION_ERROR', details?: unknown) {
    super(400, code, message, details);
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message: string, code = 'UNPROCESSABLE_ENTITY', details?: unknown) {
    super(422, code, message, details);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service unavailable', code = 'SERVICE_UNAVAILABLE', details?: unknown) {
    super(503, code, message, details);
  }
}

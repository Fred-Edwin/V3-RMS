export interface ApiErrorPayload {
  code: string;
  message: string;
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
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

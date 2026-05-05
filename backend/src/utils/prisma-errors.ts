import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { ConflictError, NotFoundError, ValidationError } from './errors';

/**
 * Maps known Prisma error codes to domain errors.
 *
 * P2002 — unique constraint violation → ConflictError
 * P2025 — record not found during update/delete → NotFoundError
 * P2003 — foreign key constraint → ValidationError
 * P2000 — value too long → ValidationError
 *
 * Re-throws the original error for any unknown code.
 */
export const mapPrismaError = (
  error: unknown,
  messages: {
    conflict?: string;
    notFound?: string;
  } = {},
): never => {
  if (error instanceof PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new ConflictError(messages.conflict ?? 'A record with this value already exists');
    }
    if (error.code === 'P2025') {
      throw new NotFoundError(messages.notFound ?? 'Record not found');
    }
    if (error.code === 'P2003') {
      throw new ValidationError('Invalid reference: related record does not exist');
    }
    if (error.code === 'P2000') {
      throw new ValidationError('Input value is too long');
    }
  }
  throw error;
};

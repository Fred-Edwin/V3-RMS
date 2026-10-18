/** True when the database refused a duplicate on a unique index (Prisma code P2002), without importing Prisma runtime code. */
export const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'P2002';

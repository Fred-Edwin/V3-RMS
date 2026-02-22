import type { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface UserContext {
      id: string;
      role: UserRole;
      organizationId: string | null;
    }

    interface Request {
      user?: UserContext;
    }
  }
}

export {};

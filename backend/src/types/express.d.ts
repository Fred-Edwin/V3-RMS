import type { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface UserContext {
      id: string;
      role: UserRole;
      organizationId: string | null;
    }

    interface PrintStationContext {
      id: string;
      organizationId: string;
    }

    interface Request {
      user?: UserContext;
      printStation?: PrintStationContext;
    }
  }
}

export {};

import type { DepartmentTag, UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface UserContext {
      id: string;
      role: UserRole;
      organizationId: string | null;
      departmentTag?: DepartmentTag | null;
      isDepartmentHead?: boolean;
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

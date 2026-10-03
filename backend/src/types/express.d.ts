import type { DepartmentTag, UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface UserContext {
      id: string;
      role: UserRole;
      siteId: string | null;
      departmentTag?: DepartmentTag | null;
      isDepartmentHead?: boolean;
    }

    interface PrintStationContext {
      id: string;
      siteId: string;
    }

    interface Request {
      user?: UserContext;
      printStation?: PrintStationContext;
    }
  }
}

export {};

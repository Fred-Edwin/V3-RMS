import { prisma } from '../../../../config/database';

/** The login facts a display needs about people who are clocked in (role and department tag live on the user). */
export const onShiftRepository = {
  usersByIds: (ids: readonly string[]) =>
    prisma.user.findMany({ where: { id: { in: [...ids] }, isActive: true }, select: { id: true, name: true, role: true, departmentTag: true } }),
};

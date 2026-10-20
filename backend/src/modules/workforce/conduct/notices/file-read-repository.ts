import { prisma } from '../../../../config/database';

export const fileReadRepository = {
  /** Whether this viewer already has a `conduct.file_read` entry for this person since the start of the Nairobi day. */
  async readToday(args: { companyId: string; viewerId: string; employeeId: string; dayStart: Date }): Promise<boolean> {
    const count = await prisma.auditEntry.count({
      where: { companyId: args.companyId, actorId: args.viewerId, action: 'conduct.file_read', subjectId: args.employeeId, occurredAt: { gte: args.dayStart } },
    });
    return count > 0;
  },
};

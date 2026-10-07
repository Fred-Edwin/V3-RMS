import type { CountingThresholds, Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';

type Client = typeof prisma | Prisma.TransactionClient;

export type CountSettingsRecord = CountingThresholds & {
  updatedBy: { id: string; name: string; role: string } | null;
  directorUpdatedBy: { id: string; name: string; role: string } | null;
};

const PERSON = { select: { id: true, name: true, role: true } } as const;

/** The hub's one `counting_thresholds` row (null until someone saves). Shared by the live count, the sign freeze and the settings screens. */
export const countSettingsRepository = {
  find: (siteId: string, client: Client = prisma): Promise<CountSettingsRecord | null> =>
    client.countingThresholds.findUnique({ where: { siteId }, include: { updatedBy: PERSON, directorUpdatedBy: PERSON } }),
};

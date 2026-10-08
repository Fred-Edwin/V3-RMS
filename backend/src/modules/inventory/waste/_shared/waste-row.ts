import type { Prisma } from '@prisma/client';

/** What every waste read pulls with a log: the item, who logged it and, when reversed, who reversed it. */
export const wasteLogInclude = {
  inventoryItem: { select: { id: true, name: true, usageUnit: true } },
  loggedBy: { select: { id: true, name: true, role: true } },
  reversedBy: { select: { id: true, name: true, role: true } },
} satisfies Prisma.WasteLogInclude;

export type WasteLogRow = Prisma.WasteLogGetPayload<{ include: typeof wasteLogInclude }>;

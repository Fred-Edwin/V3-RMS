import type { Prisma } from '@prisma/client';

/** What every branch waste read pulls with a log: the item, who logged and reversed it, its branch, and its department (through the location). */
export const branchWasteLogInclude = {
  inventoryItem: { select: { id: true, name: true, usageUnit: true } },
  loggedBy: { select: { id: true, name: true, role: true } },
  reversedBy: { select: { id: true, name: true, role: true } },
  site: { select: { id: true, name: true, code: true } },
  location: { select: { id: true, name: true, departmentId: true, department: { select: { id: true, name: true } } } },
} satisfies Prisma.WasteLogInclude;

export type BranchWasteLogRow = Prisma.WasteLogGetPayload<{ include: typeof branchWasteLogInclude }>;

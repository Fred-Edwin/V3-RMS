import type { DepartmentTag } from '@prisma/client';

// kept for the branch-day refactor: delete when branch day is redone
/** "BARISTA" → "Barista" — department labels as the designs print them. */
export const departmentLabel = (tag: DepartmentTag): string => tag.charAt(0) + tag.slice(1).toLowerCase();

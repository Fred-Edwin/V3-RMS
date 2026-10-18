import type { DepartmentCreateBody, DepartmentUpdateBody } from '../../_shared/types/org-types';

/** The checks and request bodies of the department dialogs. The server checks again (`DEPARTMENT_NAME_TAKEN` and the rest). */

export function departmentNameError(name: string): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) return 'Give the department a name.';
  if (trimmed.length > 60) return 'Keep the name under 60 letters.';
  return undefined;
}

export const toCreateBody = (name: string, siteId: string, positionIds: string[]): DepartmentCreateBody => ({ siteId, name: name.trim(), positionIds });

/** Only what changed, so the audit entry says what was edited. Returns null when nothing changed. */
export function toUpdateBody(
  before: { name: string; description: string | null; positionIds: readonly string[] },
  after: { name: string; description: string; positionIds: readonly string[] }
): DepartmentUpdateBody | null {
  const body: DepartmentUpdateBody = {};
  if (after.name.trim() !== before.name) body.name = after.name.trim();
  const description = after.description.trim();
  if (description !== (before.description ?? '')) body.description = description === '' ? null : description;
  const a = [...before.positionIds].sort().join(',');
  const b = [...after.positionIds].sort().join(',');
  if (a !== b) body.positionIds = [...after.positionIds];
  return Object.keys(body).length > 0 ? body : null;
}

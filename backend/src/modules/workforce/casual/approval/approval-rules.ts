import type { UserRole } from '@prisma/client';
import { ConflictError, ForbiddenError } from '../../../../utils/errors';
import type { Scope } from '../../_shared/workforce-access';

const MANAGER_ROLES: readonly UserRole[] = ['MANAGER', 'STORE_MANAGER'];
export const isUnitManager = (role: string): boolean => (MANAGER_ROLES as readonly string[]).includes(role);

export interface ApproverFacts {
  id: string;
  role: UserRole;
  siteId: string | null;
  scope: Scope | null; // the casual.approve scope
}

export interface SheetFacts {
  siteId: string;
  recordedById: string;
  sentById: string | null;
  recordedByRole: string;
}

/**
 * PD24. Who may decide a sent sheet:
 *  - never the person who recorded or sent it (403 SELF_APPROVAL);
 *  - a Branch or Store Manager (`unit`): the sheet's own site;
 *  - the Director (`all`): the Director's own site (Head office), or any sheet a Branch Manager recorded.
 * Anyone else is refused with the same 404-like "no such sheet" the caller used to find it; the service throws that, this returns the verdict.
 */
export function mayDecide(approver: ApproverFacts, sheet: SheetFacts): boolean {
  if (approver.scope === null) return false;
  if (approver.scope === 'unit') return approver.siteId === sheet.siteId;
  if (approver.scope === 'all') return approver.siteId === sheet.siteId || isUnitManager(sheet.recordedByRole);
  return false;
}

/**
 * After the sheet is in reach: never the person who recorded or sent it (403 SELF_APPROVAL), and a sheet a Branch or Store Manager
 * recorded is the Director's to decide, not another manager's (403 DIRECTOR_ONLY, PD24).
 */
export function assertMayDecide(approver: Pick<ApproverFacts, 'id' | 'scope'>, sheet: Pick<SheetFacts, 'recordedById' | 'sentById' | 'recordedByRole'>): void {
  if (approver.id === sheet.recordedById || approver.id === sheet.sentById) {
    throw new ForbiddenError('You recorded this sheet. The Director approves it.', 'SELF_APPROVAL');
  }
  if (approver.scope === 'unit' && isUnitManager(sheet.recordedByRole)) {
    throw new ForbiddenError('A manager recorded this sheet. The Director approves it.', 'DIRECTOR_ONLY');
  }
}

/** A sheet is decided from SENT only. Another state answers 409 with the state, so the screen reloads. */
export function assertSent(status: string): void {
  if (status !== 'SENT') throw new ConflictError(`This sheet is ${status === 'APPROVED' ? 'already approved' : status === 'VOID' ? 'void' : 'not waiting for approval'}. Check it again.`, 'SHEET_NOT_WAITING', { status });
}

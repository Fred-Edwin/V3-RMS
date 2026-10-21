import { NotFoundError } from '../../../../utils/errors';
import { env } from '../../../../config/env';
import type { AccessSubject } from '../../_shared/workforce-access';
import { resolveActor } from '../../people/people-context';
import { applicationsRepository, type ApplicationRow } from '../data/applications-repository';
import { dbOf, peopleRepository } from '../data/people-repository';
import { roleWord } from '../leave-words';
import { assertCanOpen } from '../reads/read-scope';
import { renderSlipPdf } from './slip-pdf';
import { hashPrefix, slipCode, type SlipSnapshot } from './slip-snapshot';

export interface SlipView {
  number: number;
  code: string;
  status: 'APPROVED' | 'CANCELLED';
  snapshot: SlipSnapshot;
  cancelled: { at: string; byRole: string } | null;
  pdfUrl: string;
  /** The text the QR carries. */
  qrUrl: string;
}

const qrUrlOf = (app: ApplicationRow): string => `${env.FRONTEND_ORIGIN.replace(/\/$/, '')}/verify/lve/${slipCode(app.slipNumber ?? 0)}?h=${hashPrefix(app.slipHash)}`;

async function loadSlip(subject: AccessSubject, id: string): Promise<{ app: ApplicationRow; view: SlipView }> {
  const ctx = await resolveActor(subject);
  const app = await applicationsRepository.byId(ctx.companyId, id);
  const person = app ? await peopleRepository.byId(ctx.companyId, app.employeeId) : null;
  if (!app || !person) throw new NotFoundError('That leave request was not found', 'LEAVE_NOT_FOUND');
  assertCanOpen(subject, person);
  if (app.slipNumber === null || app.slipSnapshot === null || (app.status !== 'APPROVED' && app.status !== 'CANCELLED')) throw new NotFoundError('There is no leave slip for this request', 'NO_SLIP');
  const who = app.cancelledBy ? (await peopleRepository.userNames([app.cancelledBy])).get(app.cancelledBy) : undefined;
  return {
    app,
    view: {
      number: app.slipNumber,
      code: slipCode(app.slipNumber),
      status: app.status,
      snapshot: app.slipSnapshot as unknown as SlipSnapshot,
      cancelled: app.status === 'CANCELLED' && app.cancelledAt ? { at: app.cancelledAt.toISOString(), byRole: roleWord(who?.role ?? null) } : null,
      pdfUrl: `/workforce/leave/applications/${app.id}/slip.pdf`,
      qrUrl: qrUrlOf(app),
    },
  };
}

/** S1: the model for the Document view. Anyone who may open the request may open its slip; anyone else gets 404. */
export async function slipOf(subject: AccessSubject, id: string): Promise<SlipView> {
  return (await loadSlip(subject, id)).view;
}

/** S2: the PDF, rendered from the frozen snapshot only (same bytes every time). A cancelled slip carries the CANCELLED stamp. */
export async function slipPdf(subject: AccessSubject, id: string): Promise<{ buffer: Buffer; fileName: string }> {
  const { view } = await loadSlip(subject, id);
  return { buffer: await renderSlipPdf({ snapshot: view.snapshot, qrUrl: view.qrUrl, cancelled: view.cancelled }), fileName: `Leave-slip-${view.code}.pdf` };
}

/** What the public verify page may say (owner decision O3): role and date only, never a name, a reason, a figure or a head count. */
export interface LeaveSlipVerdict {
  kind: 'LEAVE_SLIP';
  number: string;
  valid: boolean;
  status: 'APPROVED' | 'CANCELLED' | null;
  issuedOn: string | null;
  issuerRole: string | null;
}

/** Back end B's verify page and documents door call this. An unknown number, or a hash prefix that does not match, is `valid: false`. */
export async function verifyLeaveSlip(number: number, hash: string | null): Promise<LeaveSlipVerdict> {
  const app = Number.isInteger(number) && number > 0 ? await applicationsRepository.bySlipNumber(number, dbOf()) : null;
  const valid = app !== null && app.slipHash !== null && (hash === null || hashPrefix(app.slipHash) === hash);
  if (!app || !valid) return { kind: 'LEAVE_SLIP', number: slipCode(Math.max(0, number)), valid: false, status: null, issuedOn: null, issuerRole: null };
  return { kind: 'LEAVE_SLIP', number: slipCode(number), valid: true, status: app.status === 'CANCELLED' ? 'CANCELLED' : 'APPROVED', issuedOn: app.decidedAt?.toISOString().slice(0, 10) ?? null, issuerRole: roleWord(app.deciderRole) };
}

/** What the documents door needs to know about a leave slip. */
export interface DocumentKindRegistration {
  kind: 'LEAVE_SLIP';
  prefix: 'LVE';
  verifyPath: (number: number, hash: string) => string;
  verify: (number: number, hash: string | null) => Promise<LeaveSlipVerdict>;
}

export const leaveSlipDocument: DocumentKindRegistration = {
  kind: 'LEAVE_SLIP',
  prefix: 'LVE',
  verifyPath: (number, hash) => `/verify/lve/${slipCode(number)}?h=${hashPrefix(hash)}`,
  verify: verifyLeaveSlip,
};

/** Called once at start-up with the documents door's register function when back end B provides it. Until then nothing calls it. */
export function registerLeaveSlipDocument(register: (registration: DocumentKindRegistration) => void): void {
  register(leaveSlipDocument);
}

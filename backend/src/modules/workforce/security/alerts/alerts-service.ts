import { ConflictError, NotFoundError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import type { AccessSubject } from '../../_shared/workforce-access';
import { roleLabel } from '../../notifications';
import { securityActor, securityEntry } from '../security-context';
import type { AlertKind, AlertRow, AlertStatus } from '../security-types';
import { alertsRepository } from './alerts-repository';

type AlertRecord = Awaited<ReturnType<typeof alertsRepository.findIn>> & object;

async function present(rows: AlertRecord[]): Promise<AlertRow[]> {
  const ids = rows.flatMap((r) => [r.subjectUserId, r.clearedById]).filter((id): id is string => id !== null);
  const names = await alertsRepository.namesOf(ids);
  // The screen prints the role as given, so it is worded here ("HR Manager"), never the stored code.
  const who = (id: string | null) => {
    const user = id ? names.get(id) : undefined;
    return user ? { ...user, role: roleLabel(user.role) } : null;
  };
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as AlertKind,
    status: r.status as AlertStatus,
    occurredAt: r.occurredAt.toISOString(),
    person: who(r.subjectUserId),
    deviceLabel: r.deviceLabel,
    placeLabel: r.placeLabel,
    detail: r.detail,
    siteId: r.siteId,
    auditEntryId: r.auditEntryId,
    clearedBy: who(r.clearedById),
    clearedAt: r.clearedAt?.toISOString() ?? null,
    clearNote: r.clearNote,
  }));
}

export interface AlertListQuery {
  status?: AlertStatus | undefined;
  kind?: AlertKind | undefined;
  siteId?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
  page: number;
  pageSize: number;
}

/** The System Admin's alert list, newest first, for their own company. Nothing here shows an amount: the rows hold labels only. */
export async function listAlerts(subject: AccessSubject, query: AlertListQuery) {
  const ctx = await securityActor(subject, 'security.alerts.read');
  const { rows, total } = await alertsRepository.list({ companyId: ctx.companyId, status: query.status, kind: query.kind, siteId: query.siteId, from: query.from, to: query.to }, query.page, query.pageSize);
  return { items: await present(rows as AlertRecord[]), total, page: query.page, pageSize: query.pageSize };
}

export async function alertCounts(subject: AccessSubject) {
  const ctx = await securityActor(subject, 'security.alerts.read');
  const { open, cleared } = await alertsRepository.counts(ctx.companyId);
  return { open, cleared, all: open + cleared, alertsStarted: (await alertsRepository.settingOf(ctx.companyId))?.alertsStartedAt != null };
}

/**
 * Clears an alert with a one-line note (at least 3 characters). Idempotent by `idempotencyKey`: the same key again answers the same
 * alert. Two System Admins at once: the second gets 409 ALREADY_CLEARED naming who and when. Written in the audit log with the note.
 */
export async function clearAlert(subject: AccessSubject, id: string, input: { note: string; idempotencyKey: string }, now: Date = new Date()): Promise<AlertRow> {
  const ctx = await securityActor(subject, 'security.alerts.clear');
  const existing = await alertsRepository.findIn(ctx.companyId, id);
  if (!existing) throw new NotFoundError('We could not find that alert.', 'ALERT_NOT_FOUND');
  if (existing.status === 'CLEARED') return alreadyCleared(existing as AlertRecord, input.idempotencyKey);
  await runAudited<void>(async (tx) => {
    const cleared = await alertsRepository.clear(tx, ctx.companyId, id, subject.id, input.note, input.idempotencyKey, now);
    return {
      result: undefined,
      entries: cleared ? [securityEntry({ companyId: ctx.companyId, siteId: existing.siteId, actor: ctx.auditActor, action: 'security.alert_cleared', subjectType: 'Alert', subjectId: id, after: { kind: existing.kind }, reason: input.note })] : [],
    };
  });
  const after = await alertsRepository.findIn(ctx.companyId, id);
  if (!after) throw new NotFoundError('We could not find that alert.', 'ALERT_NOT_FOUND');
  return alreadyCleared(after as AlertRecord, input.idempotencyKey);
}

/** The cleared alert when this very request (same key) cleared it, a repeat included; otherwise 409 naming who got there first. */
async function alreadyCleared(row: AlertRecord, key: string): Promise<AlertRow> {
  const [presented] = await present([row]);
  if (row.clearKey === key) return presented!;
  const by = presented?.clearedBy;
  throw new ConflictError(`Cleared by ${by ? `${by.name}, ${by.role}` : 'another System Admin'}.`, 'ALREADY_CLEARED', { clearedBy: by, clearedAt: presented?.clearedAt });
}

/** "Start alerts" (the rollout gate, 6a X1): once pressed, unconfirmed-phone openings page the System Admin. Idempotent. */
export async function startAlerts(subject: AccessSubject, now: Date = new Date()): Promise<{ alertsStarted: true; at: string }> {
  const ctx = await securityActor(subject, 'security.alerts.clear');
  const current = await alertsRepository.settingOf(ctx.companyId);
  if (current?.alertsStartedAt) return { alertsStarted: true, at: current.alertsStartedAt.toISOString() };
  await runAudited<void>(async (tx) => {
    const first = await alertsRepository.startAlerts(tx, ctx.companyId, subject.id, now); // false when another System Admin got there first
    return { result: undefined, entries: first ? [securityEntry({ companyId: ctx.companyId, actor: ctx.auditActor, action: 'security.alerts_started', subjectType: 'Company', subjectId: ctx.companyId })] : [] };
  });
  return { alertsStarted: true, at: ((await alertsRepository.settingOf(ctx.companyId))?.alertsStartedAt ?? now).toISOString() };
}

import { describeEntry } from '../_shared/audit/audit-describe';
import type { AuditCategoryCode, JsonValue } from '../_shared/audit/audit.types';
import { eventOfCategory, mayNameSubject, maySeeDevice, type EventCode, type LogScope } from './audit-visibility';

/** The columns of a stored entry the log needs (what Prisma returns for an audit entry). */
export interface StoredEntry {
  id: string;
  seq: bigint;
  occurredAt: Date;
  siteId: string | null;
  action: string;
  category: string;
  subjectType: string;
  subjectId: string;
  actorId: string | null;
  actorRole: string;
  actorName: string;
  channel: string;
  subjectUserId: string | null;
  before: unknown;
  after: unknown;
  reason: string | null;
  deviceLabel: string | null;
  placeLabel: string | null;
  prevHash: string;
  hash: string;
}

export interface LogRow {
  id: string;
  seq: string;
  occurredAt: string;
  actor: { id: string | null; name: string; role: string };
  channel: string;
  area: string;
  event: EventCode;
  action: string;
  title: string;
  detail: string;
  subject: { type: string; id: string; label: string };
  subjectUser: { id: string; name: string } | null;
  siteId: string | null;
  siteName: string | null;
  flagged: boolean;
  reason: string | null;
  deviceLabel: string | null;
  placeLabel: string | null;
}

export interface RowContext {
  scope: LogScope;
  area: string;
  siteNames: ReadonlyMap<string, string>;
  userNames: ReadonlyMap<string, string>;
}

export const asJson = (value: unknown): JsonValue | null => (value === undefined ? null : (value as JsonValue | null));

const isRecord = (v: JsonValue | null): v is { [key: string]: JsonValue } => v !== null && typeof v === 'object' && !Array.isArray(v);

/** A short label for what the entry is about: a document number when the entry carries one, else the kind of thing. */
function subjectLabel(entry: StoredEntry): string {
  const after = asJson(entry.after);
  const number = isRecord(after) ? (after.number ?? after.documentNumber) : null;
  return typeof number === 'string' ? number : entry.subjectType;
}

/** One entry as the log shows it. Pure: the reader's scope decides what is left out, never the caller. */
export function toLogRow(entry: StoredEntry, ctx: RowContext): LogRow {
  const category = entry.category as AuditCategoryCode;
  const wording = describeEntry({ action: entry.action, category, reason: entry.reason, before: asJson(entry.before), after: asJson(entry.after) });
  const nameSubject = entry.subjectUserId !== null && mayNameSubject(category, ctx.scope);
  const device = maySeeDevice(ctx.scope);
  return {
    id: entry.id,
    seq: entry.seq.toString(),
    occurredAt: entry.occurredAt.toISOString(),
    actor: { id: entry.actorId, name: entry.actorName, role: entry.actorRole },
    channel: entry.channel,
    area: ctx.area,
    event: eventOfCategory(category),
    action: entry.action,
    title: wording.title,
    detail: wording.detail,
    subject: { type: entry.subjectType, id: entry.subjectId, label: subjectLabel(entry) },
    subjectUser: nameSubject && entry.subjectUserId ? { id: entry.subjectUserId, name: ctx.userNames.get(entry.subjectUserId) ?? '' } : null,
    siteId: entry.siteId,
    siteName: entry.siteId ? (ctx.siteNames.get(entry.siteId) ?? null) : null,
    flagged: wording.flagged,
    reason: entry.reason,
    deviceLabel: device ? entry.deviceLabel : null,
    placeLabel: device ? entry.placeLabel : null,
  };
}

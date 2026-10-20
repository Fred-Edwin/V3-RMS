import { z } from 'zod';
import { NotFoundError } from '../../../utils/errors';
import { runAudited } from '../_shared/audit/audit-writer';
import { DOCUMENT_KINDS, KIND_INFO, readableKindsOf } from '../_shared/documents/document-kinds';
import { DOCUMENT_COUNT_CAP, documentsRepository, type DocumentFilter } from '../_shared/documents/documents-repository';
import type { AccessSubject } from '../_shared/workforce-access';
import { rangeOf } from '../audit/audit-range';
import { noteLogViewed } from '../audit/log-views';
import { resolveActor } from '../people/people-context';
import { toItem, toPanel, type DocumentItem, type DocumentPanel } from './document-view';
import { INDEX_READ_FRESH_MS, reconcileIfStale } from './reconcile';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const documentsQuery = z
  .object({
    q: z.string().trim().max(60).optional(),
    type: z.enum(DOCUMENT_KINDS).optional(),
    siteId: z.string().uuid().optional(),
    from: day.optional(),
    to: day.optional(),
    sort: z.enum(['newest', 'oldest']).default('newest'),
    page: z.coerce.number().int().min(1).max(100_000).default(1),
    pageSize: z.coerce.number().int().refine((n) => [25, 50, 100].includes(n)).default(50),
  })
  .strict();
export type DocumentsQuery = z.infer<typeof documentsQuery>;

export const numberParam = z.object({ number: z.string().regex(/^[A-Za-z0-9-]{3,24}$/) }).strict();
export const versionQuery = z.object({ v: z.coerce.number().int().min(1).optional() }).strict();

export interface DocumentsPage {
  items: DocumentItem[];
  total: number;
  totalIsExact: boolean;
  page: number;
  pageSize: number;
  types: { code: string; label: string }[];
}

/** D2. Only the types this reader may read; a type they may not read is neither listed nor counted. */
export async function listDocuments(subject: AccessSubject, q: DocumentsQuery, now: Date = new Date()): Promise<DocumentsPage> {
  const kinds = readableKindsOf(subject);
  if (kinds.length === 0) throw new NotFoundError('We could not find that page.', 'NOT_FOUND');
  const ctx = await resolveActor(subject);
  await reconcileIfStale(INDEX_READ_FRESH_MS);
  await noteLogViewed(ctx, 'list', now);
  const range = rangeOf(q.from, q.to, now);
  const filter: DocumentFilter = { companyId: ctx.companyId, kinds, type: q.type, siteId: q.siteId, from: range.start, before: range.end, q: q.q?.toLowerCase() };
  const [rows, counted] = await Promise.all([documentsRepository.page(filter, q.sort, (q.page - 1) * q.pageSize, q.pageSize), documentsRepository.countCapped(filter)]);
  const siteNames = await documentsRepository.siteNames(rows.flatMap((r) => (r.siteId ? [r.siteId] : [])));
  return {
    items: rows.map((r) => toItem(r, siteNames, now)),
    total: Math.min(counted, DOCUMENT_COUNT_CAP),
    totalIsExact: counted <= DOCUMENT_COUNT_CAP,
    page: q.page,
    pageSize: q.pageSize,
    types: kinds.map((k) => ({ code: k.kind, label: KIND_INFO[k.kind].label })),
  };
}

/** D2 panel. 404 for a number outside the reader's types or site. */
export async function documentPanel(subject: AccessSubject, number: string, version: number | undefined, now: Date = new Date()): Promise<DocumentPanel> {
  const kinds = readableKindsOf(subject);
  const ctx = await resolveActor(subject);
  const versions = await documentsRepository.versionsOf(ctx.companyId, number.toUpperCase());
  const row = version ? versions.find((v) => v.version === version) : versions[0];
  const allowed = row && kinds.some((k) => k.kind === row.kind && (k.siteId === null || k.siteId === row.siteId));
  if (!row || !allowed) throw new NotFoundError('We could not find that document.', 'DOCUMENT_NOT_FOUND');
  await noteLogViewed(ctx, 'detail', now);
  const siteNames = await documentsRepository.siteNames(row.siteId ? [row.siteId] : []);
  const person = row.subjectUserId ? await documentsRepository.personOf(row.subjectUserId) : null;
  return toPanel(row, siteNames, person, now);
}

/** "Open document" on a type with no audit of its own: one `document.opened` entry. */
export async function recordOpened(subject: AccessSubject, number: string, version: number | undefined): Promise<{ openHref: string | null }> {
  const panel = await documentPanel(subject, number, version);
  const ctx = await resolveActor(subject);
  await runAudited<void>(async () => ({
    result: undefined,
    entries: [{ companyId: ctx.companyId, siteId: subject.siteId ?? null, actor: ctx.auditActor, action: 'document.opened', category: 'DOCUMENTS', subjectType: 'Document', subjectId: panel.number, after: { number: panel.number, version: panel.version } }],
  }));
  return { openHref: panel.openHref };
}

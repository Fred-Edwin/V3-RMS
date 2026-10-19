import { AppError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import type { NairobiDate } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { resolveActor } from '../../people/people-context';
import { timesheetEntry } from '../timesheets-audit';
import { ExportTooLarge, buildExportModel } from './export-model-service';
import { fileNameOf } from './export-model';
import { exportsRepository } from './exports-repository';
import type { ExportBody } from './exports-validators';
import { renderPdf } from './pdf-render';
import { renderXlsx } from './xlsx-render';

/** At most this many exports per person in this many minutes: a big month is heavy, and a stuck button should not hammer the server. */
export const EXPORT_LIMIT = 12;
export const EXPORT_WINDOW_MINUTES = 10;
/** A file that takes longer than this is abandoned (the screen says "could not be made, try again"). */
export const EXPORT_TIMEOUT_MS = 20_000;

export interface ExportFile {
  buffer: Buffer;
  filename: string;
  contentType: string;
  documentNumber: string | null;
}

const CONTENT_TYPES = { pdf: 'application/pdf', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } as const;

const withTimeout = <T>(work: Promise<T>): Promise<T> =>
  Promise.race([work, new Promise<never>((_, reject) => setTimeout(() => reject(new AppError(504, 'EXPORT_TOO_SLOW', 'The file took too long to make. Try again.')), EXPORT_TIMEOUT_MS).unref())]);

/**
 * Export a month (spec S3, section 10) as a signed-style PDF or a working-copy Excel. `timesheet.export` at the site (403
 * without it, 404 for another site). Never any pay figure. Every export is audited once per idempotency key (who, format, month,
 * range, document number or "draft"); a repeat of the same key makes the file again but writes no second entry. The file itself
 * is not stored. Limited in number per person and in size.
 */
export async function exportMonth(subject: AccessSubject, monthKey: string, body: ExportBody, now: Date = new Date()): Promise<ExportFile> {
  const ctx = await resolveActor(subject);
  const repeat = await exportsRepository.find(subject.id, body.idempotencyKey);
  if (!repeat) {
    const since = new Date(now.getTime() - EXPORT_WINDOW_MINUTES * 60_000);
    if ((await exportsRepository.countSince(subject.id, since)) >= EXPORT_LIMIT) throw new AppError(429, 'EXPORT_RATE_LIMIT', 'Too many exports just now. Wait a few minutes and try again.');
  }
  let model;
  try {
    model = await buildExportModel(subject, monthKey, body, { name: ctx.name, role: subject.role }, now);
  } catch (error) {
    if (error instanceof ExportTooLarge) throw new AppError(413, 'EXPORT_TOO_LARGE', error.message);
    throw error;
  }
  const buffer = await withTimeout(body.format === 'pdf' ? renderPdf(model) : renderXlsx(model));

  await runAudited(async (tx) => {
    const first = await exportsRepository.claim(tx, {
      periodId: model.periodId,
      siteId: model.siteId,
      userId: subject.id,
      format: body.format,
      scope: body.scope,
      from: (body.from as NairobiDate | undefined) ?? null,
      to: (body.to as NairobiDate | undefined) ?? null,
      idempotencyKey: body.idempotencyKey,
      documentNumber: model.documentNumber ? Number(model.documentNumber.slice(4)) : null,
    });
    if (!first) return { result: undefined, entries: [] };
    const entry = timesheetEntry({
      companyId: ctx.companyId,
      siteId: model.siteId,
      actor: ctx.auditActor,
      action: 'timesheet.exported',
      subjectId: model.periodId,
      subjectType: 'TimesheetPeriod',
      after: { format: body.format, month: model.monthKey, scope: body.scope, from: body.from ?? null, to: body.to ?? null, person: body.employeeId ?? null, document: model.documentNumber ?? 'draft' },
    });
    return { result: undefined, entries: [entry] };
  });

  return { buffer, filename: fileNameOf(model, body.format), contentType: CONTENT_TYPES[body.format], documentNumber: model.documentNumber };
}

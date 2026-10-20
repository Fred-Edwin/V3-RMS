import { AppError, ConflictError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import type { AccessSubject } from '../../_shared/workforce-access';
import { payrollEntry } from '../payroll-audit';
import { payrollActor, requireMonth } from '../payroll-context';
import { CONTENT_TYPES, fileNameOf, type ExportFormat, type ExportKind, type PayrollModel } from './export-model';
import { ExportTooLarge, buildPayrollModel } from './export-model-service';
import { exportsRepository } from './exports-repository';
import type { ExportBody } from './exports-validators';
import { renderPayslip } from './render/payslip-pdf';
import { renderRegisterPdf } from './render/register-pdf';
import { renderStatutory } from './render/statutory-xlsx';
import { renderSummaryPdf } from './render/summary-pdf';
import { renderWorkbook } from './render/workbook-xlsx';
import { zipStore } from './render/zip';

/** At most this many exports per person in this many minutes: a big month is heavy, and a stuck button should not hammer the server. */
export const EXPORT_LIMIT = 12;
export const EXPORT_WINDOW_MINUTES = 10;
/** A file that takes longer than this is abandoned (the screen says "could not be made, try again"). */
export const EXPORT_TIMEOUT_MS = 30_000;

export interface ExportFile {
  buffer: Buffer;
  filename: string;
  contentType: string;
  documentNumber: string | null;
  revision: number;
}

const withTimeout = <T>(work: Promise<T>): Promise<T> =>
  Promise.race([work, new Promise<never>((_, reject) => setTimeout(() => reject(new AppError(504, 'EXPORT_TOO_SLOW', 'The file took too long to make. Try again.')), EXPORT_TIMEOUT_MS).unref())]);

const slug = (name: string): string => name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'Staff';

async function render(kind: ExportKind, format: ExportFormat, model: PayrollModel): Promise<Buffer> {
  if (kind === 'REGISTER') return format === 'pdf' ? renderRegisterPdf(model) : renderWorkbook(model);
  if (kind === 'SUMMARY') return renderSummaryPdf(model);
  if (kind === 'STATUTORY') return renderStatutory(model);
  const entries = [];
  for (const p of [...model.payslips].sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'en'))) {
    entries.push({ name: `Payslip-${model.numbers.get(p.employeeId) ?? 'draft'}-${slug(p.employeeName)}-${model.monthKey}.pdf`, data: await renderPayslip(model, p) });
  }
  return zipStore(entries);
}

/**
 * Export a month (S9, E8). `payroll.export` (403 without it). A draft is allowed once the month is calculated and says so on every
 * page; an approved month reads the frozen snapshot, so the file never moves. All payslips needs the month published. Nothing is
 * stored. Every export is audited once per idempotency key (who, kind, format, month, document number or "draft", revision), a
 * repeat of the key makes the file again with no second entry. Limited in number per person and in size.
 */
export async function exportMonth(subject: AccessSubject, monthKey: string, body: ExportBody, now: Date = new Date()): Promise<ExportFile> {
  const ctx = await payrollActor(subject, 'payroll.export');
  const month = await requireMonth(ctx.companyId, monthKey);
  if (body.kind === 'PAYSLIPS' && month.state !== 'PUBLISHED' && month.state !== 'PAID') throw new ConflictError('Available once the payslips are published.', 'PAYSLIPS_NOT_PUBLISHED', { state: month.state });
  const repeat = await exportsRepository.find(subject.id, body.idempotencyKey);
  if (!repeat) {
    const since = new Date(now.getTime() - EXPORT_WINDOW_MINUTES * 60_000);
    if ((await exportsRepository.countSince(subject.id, since)) >= EXPORT_LIMIT) throw new AppError(429, 'EXPORT_RATE_LIMIT', 'Too many exports just now. Wait a few minutes and try again.');
  }
  let model: PayrollModel;
  try {
    model = await buildPayrollModel(ctx, month, now);
  } catch (error) {
    if (error instanceof ExportTooLarge) throw new AppError(413, 'EXPORT_TOO_LARGE', error.message);
    throw error;
  }
  const buffer = await withTimeout(render(body.kind, body.format, model));

  await runAudited(async (tx) => {
    const first = await exportsRepository.claim(tx, { monthId: month.id, userId: subject.id, kind: body.kind, format: body.format, documentNumber: model.documentNumber, revision: model.revision, idempotencyKey: body.idempotencyKey });
    if (!first) return { result: undefined, entries: [] };
    const entry = payrollEntry({ companyId: ctx.companyId, actor: ctx.auditActor, action: 'payroll.exported', category: subject.role === 'HR_MANAGER' ? 'PAY_RUN_PREPARE' : 'PAY_RUN_DECIDE', monthId: month.id, after: { month: monthKey, kind: body.kind, format: body.format, document: model.documentNumber ?? 'draft', revision: model.revision, people: model.totals.headcount, bankSheet: model.bank !== null } });
    return { result: undefined, entries: [entry] };
  });

  return { buffer, filename: fileNameOf(body.kind, body.format, monthKey), contentType: CONTENT_TYPES[body.format], documentNumber: model.documentNumber, revision: model.revision };
}

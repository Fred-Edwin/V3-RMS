import { createHash } from 'node:crypto';
import { NotFoundError } from '../../../../utils/errors';
import { latestPerMonth } from '../reads/payslip-model';
import { recordOfPayslip, recordsOf, versionData, type MonthRecord } from '../reads/records';
import { readsRepository, type EmployeeFacts } from '../reads/reads-repository';
import { buildPayslipDoc } from './document-model';
import { documentsRepository, type DocumentVariant } from './documents-repository';
import { renderPayslipPdf } from './payslip-pdf';

export interface PayslipFile {
  bytes: Buffer;
  hash: string;
  filename: string;
  number: string | null;
  variant: DocumentVariant;
}

/**
 * The A4 payslip for one version (S5, PD16). It is drawn once, from the frozen lines, and stored with its hash: every view, download and
 * share after that is the same bytes, and a payslip that is paid never changes. A version that a later one replaced is drawn once more
 * as REPLACED (watermark and the "Replaced by version 2" line) for the person; the original file stays as it was for the audit.
 *
 * Payroll part 2 may call `ensureOriginalFile` when it publishes (so the file exists from that moment); until then the first read makes it.
 */
export async function payslipFile(employee: EmployeeFacts, record: MonthRecord, allRecords: readonly MonthRecord[], version: number): Promise<PayslipFile> {
  const target = record.versions.find((v) => v.version === version);
  if (!target) throw new NotFoundError('We could not find that payslip.', 'NO_PAYSLIP');
  const next = record.versions.find((v) => v.version === version + 1) ?? null;
  const variant: DocumentVariant = next ? 'REPLACED' : 'ORIGINAL';
  const data = versionData(record, target);
  const filename = `Payslip-${data.number ? `${data.number}-` : ''}${record.monthKey}${version > 1 ? `-v${version}` : ''}.pdf`;
  const stored = await documentsRepository.find(target.id, variant);
  if (stored) return { bytes: Buffer.from(stored.bytes), hash: stored.hash, filename, number: data.number, variant };

  const previous = record.versions.find((v) => v.version === version - 1) ?? null;
  const year = record.monthKey.slice(0, 4);
  const earlier = latestPerMonth(allRecords.filter((r) => r.monthKey.startsWith(`${year}-`) && r.monthKey < record.monthKey).map((r) => ({ monthKey: r.monthKey, version: r.latest.version, r }))).map((x) => versionData(x.r, x.r.latest));
  const signerId = version === 1 ? record.approvedById : (target.correctedById ?? record.approvedById);
  const signedAt = version === 1 ? (record.approvedAt ?? target.createdAt) : (target.correctedAt ?? target.createdAt);
  const names = await readsRepository.names(signerId ? [signerId] : []);
  const signer = signerId && names.get(signerId) ? { name: names.get(signerId)!.name, role: names.get(signerId)!.role, at: signedAt } : null;
  const replacedBy = next ? { version: next.version, at: next.correctedAt ?? next.createdAt } : null;
  const bytes = await renderPayslipPdf(
    buildPayslipDoc({
      variant,
      siteName: target.siteName,
      payDay: record.pub.payDay,
      employee,
      department: target.department,
      data,
      previous: previous ? versionData(record, previous) : null,
      earlierMonths: earlier,
      replacedBy,
      previousAt: previous ? (version === 2 ? (record.approvedAt ?? previous.createdAt) : (previous.correctedAt ?? previous.createdAt)) : null,
      signer,
      created: replacedBy ? replacedBy.at : signedAt,
    }),
  );
  const hash = createHash('sha256').update(bytes).digest('hex');
  const row = await documentsRepository.store({ payslipId: target.id, variant, number: data.number ?? '', bytes, hash });
  return { bytes: Buffer.from(row.bytes), hash: row.hash, filename, number: data.number, variant };
}

/**
 * For Payroll part 2 to call when it publishes a month or corrects a payslip: the A4 file for that payslip row is made and stored at that
 * moment. Returns null when the payslip is not (yet) a visible one, e.g. the publication source does not call its month published.
 */
export async function ensureFileForPayslip(payslipId: string): Promise<PayslipFile | null> {
  const row = await readsRepository.payslipById(payslipId);
  const month = row ? await readsRepository.monthOf(row.monthId) : null;
  const employee = row && month ? await readsRepository.employeeById(month.companyId, row.employeeId) : null;
  const record = row ? await recordOfPayslip(row) : null;
  if (!row || !month || !employee || !record) return null;
  return payslipFile(employee, record, await recordsOf(month.companyId, employee.id), row.version);
}

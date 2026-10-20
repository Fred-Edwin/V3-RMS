import type { PayslipData } from './payslip-model';
import { publicationOf, type MonthPublication } from './publication';
import { readsRepository, type StoredPayslip } from './reads-repository';

export interface MonthRecord {
  monthId: string;
  monthKey: string;
  approvedAt: Date | null;
  approvedById: string | null;
  pub: MonthPublication;
  /** Every version of this person's payslip in the month's current run, oldest first. */
  versions: StoredPayslip[];
  first: StoredPayslip;
  latest: StoredPayslip;
}

const dataOf = (p: StoredPayslip, monthKey: string, number: string | null): PayslipData => ({
  id: p.id,
  monthKey,
  version: p.version,
  number: p.documentNumber ?? number,
  gross: p.gross.toFixed(2),
  net: p.net.toFixed(2),
  taxablePay: p.taxablePay.toFixed(2),
  incomeTax: p.incomeTax.toFixed(2),
  correctedAt: p.correctedAt,
  lines: p.lines.map((l) => ({
    code: l.code, label: l.label, kind: l.kind, amount: l.amount.toFixed(2), share: l.share, taxable: l.taxable, workingText: l.workingText, baseAmount: l.baseAmount?.toFixed(2) ?? null,
    bandsUsed: (l.bandsUsed as PayslipData['lines'][number]['bandsUsed']) ?? null,
  })),
});

/** A stored version as the view maths reads it. The number is the first version's (a correction keeps it). */
export const versionData = (record: MonthRecord, p: StoredPayslip): PayslipData => dataOf(p, record.monthKey, record.first.documentNumber);

/**
 * A person's payslips as staff may see them: only months the publication source calls published, only the month's current run (an older
 * calculation is never a payslip), newest month first. Nothing is visible before publish, so nothing unpublished is ever listed (S1).
 */
export async function recordsOf(companyId: string, employeeId: string): Promise<MonthRecord[]> {
  const months = await readsRepository.months(companyId);
  const pub = await publicationOf(months);
  const visible = months.filter((m) => m.currentRunId !== null && pub.get(m.id)?.published === true);
  if (visible.length === 0) return [];
  const rows = await readsRepository.payslipsOf(employeeId, visible.map((m) => m.currentRunId as string));
  const records: MonthRecord[] = [];
  for (const m of visible) {
    const versions = rows.filter((r) => r.runId === m.currentRunId).sort((a, b) => a.version - b.version);
    const first = versions[0];
    const latest = versions[versions.length - 1];
    if (!first || !latest) continue;
    records.push({ monthId: m.id, monthKey: m.monthKey, approvedAt: m.approvedAt, approvedById: m.approvedById, pub: pub.get(m.id)!, versions, first, latest });
  }
  return records;
}

/** The record a payslip id belongs to (any version's id works), or null when it is not a visible current payslip. */
export async function recordOfPayslip(row: StoredPayslip): Promise<MonthRecord | null> {
  const month = await readsRepository.monthOf(row.monthId);
  if (!month || month.currentRunId !== row.runId) return null;
  const pub = (await publicationOf([month])).get(month.id);
  if (!pub?.published) return null;
  const versions = (await readsRepository.payslipsOf(row.employeeId, [row.runId])).sort((a, b) => a.version - b.version);
  const first = versions[0];
  const latest = versions[versions.length - 1];
  if (!first || !latest) return null;
  return { monthId: month.id, monthKey: month.monthKey, approvedAt: month.approvedAt, approvedById: month.approvedById, pub, versions, first, latest };
}

import { fromDateColumn, monthKey } from '../../_shared/time/nairobi-time';
import type { IssuedDocument } from '../../_shared/documents/documents.types';
import { dayLabel, monthName } from '../../notifications';
import { sourcesRepository } from './sources-repository';

const pad4 = (n: number): string => String(n).padStart(4, '0');
const unknown = { name: 'Unknown', role: 'UNKNOWN' };

/** TSH: a site's approved month of timesheets. The hash is the one printed in the report's QR. */
export async function issuedTimesheets(companyId: string): Promise<IssuedDocument[]> {
  const rows = await sourcesRepository.timesheetMonths(companyId);
  const people = await sourcesRepository.people(rows.flatMap((r) => (r.approvedById ? [r.approvedById] : [])));
  return rows.flatMap((r): IssuedDocument[] => {
    if (r.documentNumber === null || r.documentHash === null || r.approvedAt === null) return [];
    const key = monthKey(fromDateColumn(r.startDate));
    const who = (r.approvedById ? people.get(r.approvedById) : undefined) ?? unknown;
    return [
      {
        input: {
          companyId, siteId: r.siteId, kind: 'TSH', number: `TSH-${pad4(r.documentNumber)}`, title: 'Timesheet report', about: monthName(key),
          signedBy: { id: r.approvedById, ...who }, signedAt: r.approvedAt, hash: r.documentHash, openHref: `/workforce/timesheets/months/${key}/exports`,
        },
      },
    ];
  });
}

/** CPS: an approved casual pay sheet; one voided before any worker signed stays listed, withdrawn. */
export async function issuedCasualSheets(companyId: string): Promise<IssuedDocument[]> {
  const rows = await sourcesRepository.casualSheets(companyId);
  const people = await sourcesRepository.people(rows.flatMap((r) => [r.approvedById, r.voidedById].filter((id): id is string => id !== null)));
  return rows.flatMap((r): IssuedDocument[] => {
    if (r.number === null || r.documentHash === null || r.approvedAt === null) return [];
    const who = (r.approvedById ? people.get(r.approvedById) : undefined) ?? unknown;
    const voider = (r.voidedById ? people.get(r.voidedById) : undefined) ?? unknown;
    return [
      {
        input: {
          companyId, siteId: r.siteId, kind: 'CPS', number: `CPS-${pad4(r.number)}`, title: 'Casual pay sheet', about: dayLabel(fromDateColumn(r.workDate)),
          signedBy: { id: r.approvedById, ...who }, signedAt: r.approvedAt, hash: r.documentHash, openHref: `/workforce/casual/sheets/${r.id}/document`,
        },
        ...(r.voidedAt ? { withdrawn: { at: r.voidedAt, byRole: voider.role } } : {}),
      },
    ];
  });
}

/** PAY: the approved month. Every snapshot revision is a version of the same number (a correction makes a new revision with its own hash). */
export async function issuedPayrollMonths(companyId: string): Promise<IssuedDocument[]> {
  const rows = await sourcesRepository.payrollMonths(companyId);
  const people = await sourcesRepository.people(rows.flatMap((r) => [r.approvedById, r.sentById].filter((id): id is string => id !== null)));
  return rows.flatMap((r): IssuedDocument[] =>
    r.documentNumber === null || r.approvedAt === null
      ? []
      : r.snapshots.map((s) => {
          const approver = (r.approvedById ? people.get(r.approvedById) : undefined) ?? unknown;
          const sender = r.sentById ? people.get(r.sentById) : undefined;
          return {
            input: {
              companyId, siteId: null, kind: 'PAY', number: r.documentNumber!, version: s.revision, title: 'Payroll', about: monthName(r.monthKey),
              signedBy: { id: r.approvedById, ...approver }, ...(sender && r.sentAt ? { reviewedBy: { id: r.sentById, ...sender, at: r.sentAt } } : {}),
              signedAt: s.revision === 1 ? r.approvedAt! : s.createdAt, hash: s.hash, openHref: `/workforce/payroll/months/${r.monthKey}/exports`,
            },
          };
        }),
  );
}

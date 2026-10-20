import { payslipContentHash } from '../../_shared/documents/qr-hash';
import type { IssuedDocument } from '../../_shared/documents/documents.types';
import { monthName } from '../../notifications';
import { p9Repository } from '../p9/p9-repository';
import { recordsOf, versionData } from '../reads/records';
import { readsRepository } from '../reads/reads-repository';

const unknown = { name: 'Unknown', role: 'UNKNOWN' };

/**
 * PS: every published payslip version, as the index and the verify page hold it. The number and the hash are the ones the person's own
 * file prints in its QR (`payslipContentHash`), the signer and date are the ones on the file (the approval for version 1, the
 * correction for a later version). Walks the people who have a published payslip; read only.
 */
export async function issuedPayslips(companyId: string): Promise<IssuedDocument[]> {
  const out: IssuedDocument[] = [];
  for (const employeeId of await readsRepository.publishedEmployeeIds(companyId)) {
    const employee = await readsRepository.employeeById(companyId, employeeId);
    if (!employee) continue;
    const records = await recordsOf(companyId, employeeId);
    const signerIds = records.flatMap((r) => r.versions.map((v) => (v.version === 1 ? r.approvedById : (v.correctedById ?? r.approvedById)))).filter((id): id is string => id !== null);
    const names = await readsRepository.names(signerIds);
    for (const record of records) {
      for (const stored of record.versions) {
        const data = versionData(record, stored);
        if (!data.number) continue;
        const signerId = stored.version === 1 ? record.approvedById : (stored.correctedById ?? record.approvedById);
        const who = (signerId ? names.get(signerId) : undefined) ?? unknown;
        out.push({
          input: {
            companyId, siteId: employee.siteId, kind: 'PS', number: data.number, version: stored.version, title: 'Payslip', about: monthName(record.monthKey), subjectUserId: employee.userId,
            signedBy: { id: signerId, name: who.name, role: who.role },
            signedAt: (stored.version === 1 ? record.approvedAt : stored.correctedAt) ?? stored.createdAt,
            hash: payslipContentHash({ number: data.number, version: stored.version, monthKey: record.monthKey, gross: data.gross, net: data.net, lines: data.lines }),
            openHref: `/workforce/payslips/${stored.id}/document`,
          },
        });
      }
    }
  }
  return out;
}

/** P9: a generated tax certificate for a person and a year. The hash is the file's own (it is what the QR carries). */
export async function issuedP9(companyId: string): Promise<IssuedDocument[]> {
  const rows = await p9Repository.forCompany(companyId);
  const names = await readsRepository.names(rows.map((r) => r.generatedById));
  const out: IssuedDocument[] = [];
  for (const row of rows) {
    const employee = await readsRepository.employeeById(companyId, row.employeeId);
    const who = names.get(row.generatedById) ?? unknown;
    out.push({
      input: {
        companyId, siteId: employee?.siteId ?? null, kind: 'P9', number: row.number, title: 'P9', about: `Tax year ${row.year}`, subjectUserId: employee?.userId ?? null,
        signedBy: { id: row.generatedById, name: who.name, role: who.role }, signedAt: row.generatedAt, hash: row.hash, openHref: `/workforce/payslips/p9/${row.year}/people/${row.employeeId}/generate`,
      },
    });
  }
  return out;
}

import { NotFoundError } from '../../../../utils/errors';
import type { NairobiDate } from '../../_shared/time/nairobi-time';
import { getEffectiveRuleGroup } from '../../rules';
import { last4, latestPerMonth, monthSection, yearSection, type Section } from './payslip-model';
import { versionData, type MonthRecord } from './records';
import type { EmployeeFacts } from './reads-repository';

export interface VersionInfo {
  versionNumber: number;
  createdAt: string;
  replacedAt: string | null;
  current: boolean;
}

export interface PayslipDetail {
  id: string;
  number: string | null;
  month: string;
  versionNumber: number;
  correctedAt: string | null;
  replacedBy: { versionNumber: number; correctedAt: string } | null;
  employeeSummary: { role: string | null; site: string };
  payDay: string | null;
  paidOn: string | null;
  status: 'PUBLISHED' | 'PAID';
  thisMonth: Section;
  ytd: Section & { fromMonth: string; toMonth: string };
  bank: { name: string; last4: string | null } | null;
  hrContact: { phone: string; hoursText: string } | null;
  versions: VersionInfo[];
  document: { available: true; path: string };
}

export const versionInfos = (record: MonthRecord): VersionInfo[] =>
  record.versions.map((v, i) => {
    const later = record.versions[i + 1];
    return { versionNumber: v.version, createdAt: (v.correctedAt ?? v.createdAt).toISOString(), replacedAt: later ? (later.correctedAt ?? later.createdAt).toISOString() : null, current: later === undefined };
  });

/** The months of the year up to and including this one, the latest version of each (this month uses the version being opened). */
function yearMonths(record: MonthRecord, allRecords: readonly MonthRecord[], shown: ReturnType<typeof versionData>) {
  const year = record.monthKey.slice(0, 4);
  const earlier = allRecords.filter((r) => r.monthKey.startsWith(`${year}-`) && r.monthKey < record.monthKey).map((r) => versionData(r, r.latest));
  return latestPerMonth([...earlier, shown]);
}

/** S3 for one version of one payslip. `pathBase` is where the document is served from (the staff route or the HR route). */
export async function buildDetail(args: { employee: EmployeeFacts; record: MonthRecord; allRecords: readonly MonthRecord[]; version: number | null; today: NairobiDate; pathBase: string }): Promise<PayslipDetail> {
  const { employee, record } = args;
  const target = args.version === null ? record.latest : record.versions.find((v) => v.version === args.version);
  if (!target) throw new NotFoundError('We could not find that payslip.', 'NO_PAYSLIP');
  const shown = versionData(record, target);
  const previous = record.versions.find((v) => v.version === target.version - 1);
  const next = record.versions.find((v) => v.version === target.version + 1);
  const months = yearMonths(record, args.allRecords, shown);
  const hr = (await getEffectiveRuleGroup(employee.siteId, args.today, 'LEAVE')).values.hrContact;
  return {
    id: record.first.id,
    number: shown.number,
    month: record.monthKey,
    versionNumber: target.version,
    correctedAt: target.correctedAt?.toISOString() ?? null,
    replacedBy: next ? { versionNumber: next.version, correctedAt: (next.correctedAt ?? next.createdAt).toISOString() } : null,
    employeeSummary: { role: employee.position, site: target.siteName },
    payDay: record.pub.payDay,
    paidOn: record.pub.paidOn,
    status: record.pub.paid ? 'PAID' : 'PUBLISHED',
    thisMonth: monthSection(shown, previous ? versionData(record, previous) : null),
    ytd: { ...yearSection(months), fromMonth: months[0]?.monthKey ?? record.monthKey, toMonth: record.monthKey },
    bank: employee.bankName ? { name: employee.bankName, last4: last4(employee.accountNumber) } : null,
    hrContact: hr,
    versions: versionInfos(record),
    document: { available: true, path: `${args.pathBase}/${record.first.id}/document${target.version > 1 ? `?v=${target.version}` : ''}` },
  };
}

import { nairobiDateOf } from '../../_shared/time/nairobi-time';
import { workforceCan, type AccessSubject } from '../../_shared/workforce-access';
import { monthName, plural } from '../../notifications';
import { P9_LAYOUT_VERSION } from '../../payslips';
import type { NeedsYouContext, NeedsYouRow, NeedsYouSource } from '../needs-you-types';
import { payReads } from './pay-repository';

const base = { siteId: null, siteName: null, personUserId: null, canRemind: false } as const;

/** Payroll steps for HR and the Accountant, the tax tables and the P9 format. Wording counts people, never an amount. */
export const paySource: NeedsYouSource = {
  id: 'pay',
  kinds: ['payroll', 'tables', 'p9'],
  async list(subject: AccessSubject, ctx: NeedsYouContext) {
    const wants = { review: workforceCan(subject, 'payroll.review'), publish: workforceCan(subject, 'payroll.publish'), approve: workforceCan(subject, 'payroll.approve'), pay: workforceCan(subject, 'payroll.pay'), tables: workforceCan(subject, 'rules.confirm.statutory') };
    if (!Object.values(wants).some(Boolean)) return [];
    const states = [...(wants.review ? (['IN_REVIEW'] as const) : []), ...(wants.publish ? (['TO_PUBLISH'] as const) : []), ...(wants.approve ? (['TO_APPROVE'] as const) : []), ...(wants.pay ? (['PUBLISHED'] as const) : [])];
    const rows: NeedsYouRow[] = [];
    if (states.length > 0) {
      const months = await payReads.monthsInState(ctx.companyId, states);
      const [leftOut, names] = await Promise.all([payReads.leftOutNoProfile(months.map((m) => m.id)), payReads.userNames(months.map((m) => m.sentById))]);
      for (const m of months) {
        const people = plural(m.sites.reduce((n, s) => n + s.headcount, 0), 'person', 'people');
        const month = monthName(m.monthKey);
        const row = (id: string, text: string, since: Date | null, waitingOnRole: string): NeedsYouRow => ({ ...base, id: `payroll:${id}:${m.id}`, kind: 'payroll', text, opens: '/app/workforce/payroll', badge: 'workforce-payroll', since: (since ?? m.createdAt).toISOString(), waitingOnRole });
        if (m.state === 'IN_REVIEW' && wants.review) {
          rows.push(row('review', `Review the ${month} payroll · ${people}`, m.calculatedAt, 'HR_MANAGER'));
          const n = leftOut.get(m.id) ?? 0;
          if (n > 0) rows.push(row('left-out', `${plural(n, 'person', 'people')} left out of ${month}: no pay profile`, m.calculatedAt, 'HR_MANAGER'));
        }
        if (m.state === 'TO_PUBLISH' && wants.publish) rows.push(row('publish', `Publish the ${month} payroll · ${people} · approved by the Accountant`, m.approvedAt, 'HR_MANAGER'));
        // Never one the Accountant reviewed themselves (nobody approves their own work).
        if (m.state === 'TO_APPROVE' && wants.approve && m.sentById !== subject.id) rows.push(row('approve', `Approve the ${month} payroll · ${people} · reviewed by ${names.get(m.sentById ?? '') ?? 'HR'}, HR Manager`, m.sentAt, 'ACCOUNTANT'));
        if (m.state === 'PUBLISHED' && wants.pay && m._count.bankFiles > 0) rows.push(row('pay', `Mark the ${month} payroll as paid`, m.publishedAt, 'ACCOUNTANT'));
      }
    }
    if (wants.tables) {
      const pending = await payReads.unconfirmedStatutory(ctx.companyId);
      if (pending) rows.push({ ...base, id: `tables:${pending.id}`, kind: 'tables', text: `Confirm the PAYE, NSSF, SHA and housing levy tables, version ${pending.version}`, opens: '/app/workforce/rules/statutory', badge: null, since: pending.createdAt.toISOString(), waitingOnRole: 'ACCOUNTANT' });
      const firstPublished = await payReads.firstPublishedAt(ctx.companyId);
      if (firstPublished && !(await payReads.p9Confirmed(ctx.companyId, P9_LAYOUT_VERSION))) {
        rows.push({ ...base, id: `p9:${P9_LAYOUT_VERSION}`, kind: 'p9', text: `Confirm the P9 format for ${nairobiDateOf(ctx.now).slice(0, 4)}`, opens: '/app/workforce/payslips/p9', badge: null, since: firstPublished.toISOString(), waitingOnRole: 'ACCOUNTANT' });
      }
    }
    return rows;
  },
};

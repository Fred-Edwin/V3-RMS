import { describe, expect, it } from 'vitest';
import { hashPrefixOf } from '../../_shared/documents/qr-hash';
import type { NairobiDate } from '../../_shared/time/nairobi-time';
import { renderNotification } from '../../notifications';
import { buildSlipSnapshot, hashPrefix, hashSlip, slipCode, type SlipInput } from './slip-snapshot';
import { renderSlipPdf } from './slip-pdf';
import { leaveSlipDocument, registerLeaveSlipDocument } from './slip-service';
import { longDate, slipLines, stampLine } from './slip-text';

const d = (value: string): NairobiDate => value as NairobiDate;
const input = (over: Partial<SlipInput> = {}): SlipInput => ({
  number: 31, person: { name: 'Cynthia Wairimu', roleLabel: 'Barista', department: 'Barista', site: 'Nyeri Town' }, type: { code: 'ANNUAL', label: 'Annual leave', paid: true },
  start: d('2026-10-26'), end: d('2026-10-28'), days: 3, unpaidTailDays: 0, sickNoteNeeded: false, askedAt: new Date('2026-10-09T12:10:00Z'), approvedAt: new Date('2026-10-09T13:05:00Z'),
  approver: { name: 'Faith Njeri', roleLabel: 'Branch Manager', role: 'MANAGER' }, balanceBefore: 12, balanceAfter: 9, head: { name: 'Victor Maina', roleLabel: 'Head of Barista' }, ...over,
});

describe('slip snapshot and wording', () => {
  it('pads the number to four digits and grows past 9999', () => {
    expect(slipCode(31)).toBe('LVE-0031');
    expect(slipCode(12345)).toBe('LVE-12345');
  });
  it('hashes the same snapshot to the same value and a changed one differently', () => {
    expect(hashSlip(buildSlipSnapshot(input()))).toBe(hashSlip(buildSlipSnapshot(input())));
    expect(hashSlip(buildSlipSnapshot(input({ days: 4 })))).not.toBe(hashSlip(buildSlipSnapshot(input())));
    const hash = hashSlip(buildSlipSnapshot(input()));
    expect(hashPrefix(hash)).toHaveLength(10);
    expect(hashPrefix(hash)).toBe(hashPrefixOf(hash));
  });
  it('fills the fixed template with no title and the singular day', () => {
    const lines = slipLines(buildSlipSnapshot(input()));
    expect(lines.heading).toBe('Annual leave approved: Monday 26 October to Wednesday 28 October 2026');
    expect(lines.paragraphs[0]).toContain('for 3 days, from Monday 26 October 2026 to Wednesday 28 October 2026, and you return to work on Thursday 29 October 2026');
    expect(lines.paragraphs[1]).toContain('balance was 12 days and is now 9 days. Leave days are paid at your normal pay. Your department head, Victor Maina, Head of Barista, has been told');
    expect(lines.paragraphs.join(' ')).not.toMatch(/\b(Ms|Mr|Mrs)\b/);
    expect(slipLines(buildSlipSnapshot(input({ days: 1, end: d('2026-10-26') }))).paragraphs[0]).toContain('for 1 day,');
    expect(lines.signedLine).toBe('Signed with PIN · 9 Oct 2026, 16:05');
    expect(lines.footerRight).toBe('Approved by the Branch Manager');
  });
  it('says HR when HR approved, names the unpaid tail, and the sick note', () => {
    const s = buildSlipSnapshot(input({ approver: { name: 'Mercy Achieng', roleLabel: 'HR Manager', role: 'HR_MANAGER' }, days: 7, unpaidTailDays: 2, sickNoteNeeded: true, head: null }));
    const lines = slipLines(s);
    expect(lines.footerRight).toBe('Approved by HR');
    expect(lines.paragraphs[1]).toContain('Your department head has been told');
    expect(lines.paragraphs[1]).toContain('5 annual days and 2 unpaid days.');
    expect(lines.paragraphs[1]).toContain('A sick note is needed.');
    expect(lines.paragraphs[1]).toContain('These days are not paid.');
    expect(lines.paragraphs[2]).toContain('tell your HR before');
  });
  it('formats dates in Nairobi time', () => {
    expect(longDate('2026-10-26')).toBe('Monday 26 October 2026');
    expect(stampLine('2026-10-09T21:30:00Z')).toBe('10 Oct 2026, 00:30');
  });
});

describe('slip pdf', () => {
  it('renders the same bytes twice, and a cancelled slip differs', async () => {
    const snapshot = buildSlipSnapshot(input());
    const a = await renderSlipPdf({ snapshot, qrUrl: 'http://x/verify/lve/31?h=abcd1234', cancelled: null });
    const b = await renderSlipPdf({ snapshot, qrUrl: 'http://x/verify/lve/31?h=abcd1234', cancelled: null });
    const c = await renderSlipPdf({ snapshot, qrUrl: 'http://x/verify/lve/31?h=abcd1234', cancelled: { at: '2026-10-12T08:00:00Z', byRole: 'Branch Manager' } });
    expect(a.subarray(0, 4).toString()).toBe('%PDF');
    expect(a.equals(b)).toBe(true);
    expect(c.equals(a)).toBe(false);
  }, 20_000);
});

describe('documents registration', () => {
  it('hands the documents door a leave slip kind with its verify path', () => {
    const seen: string[] = [];
    registerLeaveSlipDocument((registration) => seen.push(`${registration.kind}:${registration.prefix}`));
    expect(seen).toEqual(['LEAVE_SLIP:LVE']);
    expect(leaveSlipDocument.verifyPath(31, 'abcdef1234567890')).toBe('/verify/lve/LVE-0031?h=abcdef1234');
  });
});

describe('leave notification wording', () => {
  it.each(['leave.asked', 'leave.approved', 'leave.declined', 'leave.head_told', 'leave.moved_to_hr_person', 'leave.moved_to_hr', 'leave.cancelled_by_person', 'leave.cancelled_by_manager', 'leave.cancelled_plan_days', 'leave.balance_adjusted'])(
    '%s is a Leave row with no name, balance or reason on the lock screen',
    (kind) => {
      const row = renderNotification(kind, { id: 'abc' });
      expect(row.area).toBe('LEAVE');
      expect(`${row.title} ${row.body}`).not.toMatch(/Reason|Cynthia|days? left|balance (was|is)/i);
    },
  );
});

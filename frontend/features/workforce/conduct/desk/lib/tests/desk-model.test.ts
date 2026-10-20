import { describe, expect, it } from 'vitest';

import type { DeskDetail, DeskList } from '../../../_shared/types/conduct-types';
import { chipCounts, detailRows, filterOf, kpiCells, recordButton, showsAppealLayout, whatHappened, withHrLine } from '../desk-model';

const detail: DeskDetail = {
  view: 'DESK',
  id: 'n1',
  personId: 'p1',
  personName: 'Dan Kiprop',
  jobLabel: 'Barista',
  siteName: 'Nyeri Town',
  title: 'Dan Kiprop · Written warning',
  level: 'WRITTEN_WARNING',
  number: 'WRN-0004',
  aboutLabel: 'Lateness',
  issuedAt: '2026-08-20T13:00:00.000Z',
  issuerLabel: 'Faith Njeri, Branch Manager',
  status: 'SIGNED',
  statusWord: 'Signed',
  ownLine: 'We spoke about it on Thursday.',
  verbalLine: null,
  facts: { kind: 'LATENESS', monthKey: '2026-07', count: 6, minutes: 41, rows: [] },
  checkedForYou: [],
  signedLine: 'Signed by Dan Kiprop, Thu 20 Aug, 17:14',
  appealLine: 'None',
  witness: null,
  appeal: null,
  decisions: [],
  validUntil: '20 Feb 2027',
  months: 6,
  version: 1,
  actions: { canRecordNotSigned: false, recordableFrom: null, canDecide: false, outcomes: [], canChange: false, canOpenAsIssued: false },
  updatedAt: '2026-08-20T14:14:00.000Z',
};

const counts: DeskList['counts'] = { active: 3, written: 1, endingIn30: 0, appealsWithHr: 2, appealed: 2, ended: 2 };

describe('kpiCells', () => {
  it('draws four cells and makes appeals a button only when some wait', () => {
    const cells = kpiCells(counts, null, () => undefined);
    expect(cells.map((c) => c.label)).toEqual(['ACTIVE NOTICES', 'WRITTEN WARNINGS', 'ENDING IN 30 DAYS', 'APPEALS WITH HR']);
    expect(cells[3]?.actionable).toBe(true);
    expect(cells[2]?.detail).toBe('nothing ends soon');
    expect(kpiCells({ ...counts, appealsWithHr: 0 }, null, () => undefined)[3]?.actionable).toBe(false);
  });
  it('names who ends next by role, not by name', () => {
    expect(kpiCells(counts, { jobLabel: 'Barista', date: '22 Dec 2026' }, () => undefined)[2]?.detail).toBe('next: Barista, 22 Dec 2026');
  });
});

describe('filters', () => {
  it('reads the chip value and falls back to Active', () => {
    expect(filterOf(undefined)).toBe('active');
    expect(filterOf('appealed')).toBe('appealed');
    expect(filterOf('nonsense')).toBe('active');
    expect(chipCounts(counts)).toEqual({ status: { '': 3, appealed: 2, ended: 2 } });
  });
});

describe('detail rows', () => {
  it('says what happened from the facts', () => {
    expect(whatHappened(detail)).toBe('Late 6 times in July 2026');
    expect(detailRows(detail).map((r) => r.label)).toEqual(['What happened', 'Evidence from timesheets', 'Signed', 'Appeal', 'Ends by itself on']);
  });
  it('uses the own line when there are no timesheet facts', () => {
    expect(whatHappened({ ...detail, facts: null })).toBe('We spoke about it on Thursday.');
  });
  it('flags a witness who did not confirm', () => {
    const rows = detailRows({ ...detail, witness: { askedAt: '2026-08-21T08:00:00.000Z', state: 'NOT_CONFIRMED' } });
    expect(rows.at(-1)).toMatchObject({ label: 'Witness', value: 'Not confirmed' });
  });
});

describe('record button', () => {
  const issued: DeskDetail = { ...detail, status: 'ISSUED', actions: { ...detail.actions, canRecordNotSigned: true, recordableFrom: '2026-10-12T00:00:00.000Z' } };
  it('is hidden for anyone the server did not allow', () => {
    expect(recordButton(detail, new Date())).toEqual({ show: false });
  });
  it('waits for the sign limit and says when', () => {
    const early = recordButton(issued, new Date('2026-10-10T08:00:00.000Z'));
    expect(early).toMatchObject({ show: true, enabled: false });
    expect(early.show && early.reason).toBe('You can record this from Mon 12 Oct.');
  });
  it('opens once the limit has passed, or at once for a person with no login', () => {
    expect(recordButton(issued, new Date('2026-10-13T08:00:00.000Z'))).toMatchObject({ show: true, enabled: true });
    expect(recordButton({ ...issued, actions: { ...issued.actions, recordableFrom: null } }, new Date('2026-10-10T08:00:00.000Z'))).toMatchObject({ enabled: true });
  });
});

describe('appeals', () => {
  const appealed: DeskDetail = { ...detail, status: 'APPEALED', appeal: { appealedAt: '2026-10-10T06:15:00.000Z', reasonKey: 'GOOD_REASON', reasonLabel: 'x', text: 'y', dueBy: '2026-10-17T20:59:00.000Z', overdueDays: 0 } };
  it('says "with HR" for a reader who cannot decide', () => {
    expect(withHrLine(appealed)).toBe('With HR since Sat 10 Oct');
    expect(withHrLine({ ...appealed, actions: { ...appealed.actions, canDecide: true } })).toBeNull();
  });
  it('uses the appeal layout for a decider, or for HR and the Director reading', () => {
    expect(showsAppealLayout(appealed, false)).toBe(false);
    expect(showsAppealLayout(appealed, true)).toBe(true);
    expect(showsAppealLayout({ ...appealed, actions: { ...appealed.actions, canDecide: true } }, false)).toBe(true);
  });
});

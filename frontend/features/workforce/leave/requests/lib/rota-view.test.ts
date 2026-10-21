import { describe, expect, it } from 'vitest';

import type { RotaPanel } from '../../_shared/types/leave-types';
import { coverSentence, dayList, footerCells, gridRows, teamLine } from './rota-view';

const row = (id: string, cell: 'SHIFT' | 'LEAVE' | 'ASKED' | 'OFF', templateName: string | null = null) => ({ employeeId: id, name: id.toUpperCase(), cell, templateName });
const day = (date: string, working: number, tight: boolean): RotaPanel['days'][number] => ({
  date, planned: false, minimum: 4, working, tight,
  rows: [row('a', 'ASKED'), row('b', 'SHIFT', 'Morning'), row('c', 'LEAVE'), row('d', 'OFF')],
});

describe('rota view', () => {
  const days = [day('2026-10-26', 5, false), day('2026-10-27', 3, true), day('2026-10-28', 3, true)];

  it('draws asked, shift, leave and a day off', () => {
    const rows = gridRows(days, 'a');
    expect(rows[0]?.cells[0]).toMatchObject({ tone: 'asked', label: 'Asked for' });
    expect(rows[1]?.cells[0]).toMatchObject({ tone: 'morning', label: 'Morning' });
    expect(rows[2]?.cells[0]).toMatchObject({ tone: 'leave' });
    expect(rows[3]?.cells[0]).toBeNull();
    expect(rows[0]?.sub).toBe('Asking');
  });

  it('puts working of team in the footer, amber below the minimum', () => {
    expect(footerCells(days).map((c) => [c.text, c.tone])).toEqual([['5 of 4', 'default'], ['3 of 4', 'warning'], ['3 of 4', 'warning']]);
  });

  it('words the tight days and says it only warns', () => {
    expect(coverSentence(days, 'Barista')).toBe('Tue 27 and Wed 28 would be down to 3 people, below the least you set for Barista (4). This warns you; it does not stop you.');
    expect(coverSentence([day('2026-10-26', 5, false)], 'Barista')).toBe('Enough people on those days.');
  });

  it('lists days and shortens past three', () => {
    expect(dayList(['2026-10-26'])).toBe('Mon 26');
    expect(dayList(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'])).toBe('Mon 26, Tue 27, Wed 28 and 2 more');
  });

  it('gives the dialog the worst tight day', () => {
    expect(teamLine(days)).toEqual({ label: 'Team on Tue 27, Wed 28', value: '3 of 4 working', tight: true });
    expect(teamLine([day('2026-10-26', 5, false)])).toMatchObject({ tight: false });
  });
});

import { describe, expect, it } from 'vitest';

import type { EmployeeFile, TimelineEvent } from '../../../_shared/types/people-types';
import { eventText, lifeEvents } from '../file-timeline';

const file = (over: Partial<EmployeeFile> = {}): EmployeeFile =>
  ({ status: 'ACTIVE', position: { id: 'p', name: 'Barista' }, probation: { endsOn: '2026-10-14', confirmedOn: null }, timeline: [], ...over }) as unknown as EmployeeFile;
const ev = (on: string, kind: TimelineEvent['kind'], detail: TimelineEvent['detail'] = {}): TimelineEvent => ({ on, kind, detail });

describe('Life at Wendo', () => {
  it('writes each kind in plain words', () => {
    expect(eventText(ev('2026-07-14', 'HIRED'), file())).toBe('Hired as Barista, probation began');
    expect(eventText(ev('2026-07-15', 'DOCUMENT', { type: 'ID_COPY' }), file())).toBe('ID received');
    expect(eventText(ev('2026-10-31', 'EXIT', { reason: 'RESIGNED' }), file())).toBe('Left: Resigned');
    expect(eventText(ev('2026-11-01', 'TRANSFER', { toSite: 'Nyeri Highway' }), file())).toBe('Moved to Nyeri Highway');
  });
  it('orders by date and ends with the decision still to come, dashed', () => {
    const f = file({ timeline: [ev('2026-10-02', 'PROBATION'), ev('2026-07-14', 'HIRED'), ev('2026-07-15', 'DOCUMENT', { type: 'ID_COPY' })] });
    const events = lifeEvents(f);
    expect(events.map((e) => e.date)).toEqual(['14 JUL', '15 JUL', '2 OCT', '14 OCT']);
    expect(events.at(-1)).toMatchObject({ text: 'Probation decision', state: 'future' });
  });
  it('keeps only the latest events so the band stays four wide', () => {
    const many = Array.from({ length: 6 }, (_, i) => ev(`2026-0${i + 1}-10`, 'DOCUMENT', { type: 'CERTIFICATE' }));
    expect(lifeEvents(file({ timeline: many })).length).toBe(4);
  });
  it('draws no future decision once probation is confirmed or the person has left', () => {
    expect(lifeEvents(file({ probation: { endsOn: '2026-10-14', confirmedOn: '2026-10-15' } as never })).some((e) => e.state === 'future')).toBe(false);
    expect(lifeEvents(file({ status: 'EXITED' })).some((e) => e.state === 'future')).toBe(false);
  });
});

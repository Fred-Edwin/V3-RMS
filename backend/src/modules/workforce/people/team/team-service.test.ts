import { describe, expect, it } from 'vitest';
import { teamMembers } from './team-service';

const person = (id: string, name: string, onProbation = false) => ({ id, name, positionName: 'Barista', departmentName: 'Barista', onProbation });

describe('My team rows', () => {
  it('marks a person with a shift today as on shift and shows the times', () => {
    const rows = teamMembers([person('a', 'Joy')], [{ employeeId: 'a', startTime: '06:00', endTime: '14:00' }]);
    expect(rows[0]).toMatchObject({ status: 'ON_SHIFT', shift: '06:00 to 14:00' });
  });

  it('on the new clock, "on shift" means clocked in now: a rostered person who has not started is not on shift, and still shows the times', () => {
    const shifts = [{ employeeId: 'a', startTime: '14:00', endTime: '22:00' }, { employeeId: 'b', startTime: '06:00', endTime: '14:00' }];
    const rows = teamMembers([person('a', 'Joy'), person('b', 'Peter')], shifts, false, new Set(['b']));
    expect(rows.map((r) => [r.name, r.status, r.shift])).toEqual([['Joy', 'NOT_ON_SHIFT', '14:00 to 22:00'], ['Peter', 'ON_SHIFT', '06:00 to 14:00']]);
  });

  it('marks a person with no shift as not on shift, with no shift text', () => {
    expect(teamMembers([person('b', 'Peter')], [])[0]).toMatchObject({ status: 'NOT_ON_SHIFT', shift: null });
  });

  it('joins two shifts in one day and carries no pay or ID field', () => {
    const [row] = teamMembers([person('c', 'Mercy')], [
      { employeeId: 'c', startTime: '06:00', endTime: '10:00' },
      { employeeId: 'c', startTime: '16:00', endTime: '20:00' },
    ]);
    expect(row?.shift).toBe('06:00 to 10:00, 16:00 to 20:00');
    expect(Object.keys(row ?? {}).sort()).toEqual(['canReport', 'department', 'id', 'name', 'position', 'shift', 'status']);
  });

  it('offers a probation report only for a person on probation and only to someone who may write one', () => {
    const people = [person('d', 'Jackline', true), person('e', 'Naomi', false)];
    expect(teamMembers(people, [], true).map((m) => m.canReport)).toEqual([true, false]);
    expect(teamMembers(people, [], false).map((m) => m.canReport)).toEqual([false, false]);
  });
});

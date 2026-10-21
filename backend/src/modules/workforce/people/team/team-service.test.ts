import { describe, expect, it } from 'vitest';
import { teamMembers } from './team-service';

const person = (id: string, name: string) => ({ id, name, positionName: 'Barista', departmentName: 'Barista' });

describe('My team rows', () => {
  it('marks a person with a shift today as on shift and shows the times', () => {
    const rows = teamMembers([person('a', 'Joy')], [{ employeeId: 'a', startTime: '06:00', endTime: '14:00' }]);
    expect(rows[0]).toMatchObject({ status: 'ON_SHIFT', shift: '06:00 to 14:00' });
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
    expect(Object.keys(row ?? {}).sort()).toEqual(['department', 'id', 'name', 'position', 'shift', 'status']);
  });
});

import { describe, expect, it } from 'vitest';
import { shiftCell, statusCell, toTeamQuery } from './team-copy';

describe('My team words', () => {
  it('turns the table state into the endpoint query', () => {
    expect(toTeamQuery({ page: 2, perPage: 20, search: 'joy', filters: { filter: 'on_shift' } })).toEqual({ page: 2, perPage: 20, q: 'joy', status: 'on_shift' });
    expect(toTeamQuery({ page: 1, perPage: 10, search: '', filters: {} })).toEqual({ page: 1, perPage: 10, q: undefined, status: 'all' });
    expect(toTeamQuery({ page: 1, perPage: 10, search: '', filters: { filter: 'nonsense' } }).status).toBe('all');
  });
  it('says today’s status and shift', () => {
    expect(statusCell({ status: 'ON_SHIFT' })).toEqual({ label: 'On shift', tone: 'success' });
    expect(statusCell({ status: 'NOT_ON_SHIFT' }).label).toBe('Not on shift');
    expect(shiftCell({ shift: null })).toBe('No shift today');
    expect(shiftCell({ shift: '06:00 to 14:00' })).toBe('06:00 to 14:00');
  });
});

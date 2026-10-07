import { beforeAll, describe, expect, it } from 'vitest';
import { ApiError } from '@/types/api';
import { setFixtureRole } from '../../../_shared/fixtures/fixture-role';
import { COUNT_STOCK_FIGURE_KEYS, type CountDetail } from '../types/counting-contract';
import { countingFixtureHandler as call } from './counting.fixtures';

const get = <T>(path: string, q = ''): T => call({ method: 'GET', path, query: new URLSearchParams(q), body: undefined }) as T;
const post = <T>(path: string, body: unknown): T => call({ method: 'POST', path, query: new URLSearchParams(), body }) as T;
const put = <T>(path: string, body: unknown): T => call({ method: 'PUT', path, query: new URLSearchParams(), body }) as T;
const code = (fn: () => unknown): string | null => {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof ApiError ? e.code : 'OTHER';
  }
};

describe('counting fixture flow: the walk the screens rely on', () => {
  beforeAll(() => setFixtureRole('STORE_ATTENDANT'));

  it('an Attendant starts, counts, is refused a second count, and signs; no stock figure ever reaches them', () => {
    const options = get<{ sections: { id: string; name: string; busy: unknown }[] }>('/counts/start-options');
    const free = options.sections.find((s) => !s.busy);
    expect(free).toBeTruthy();
    const count = post<CountDetail>('/counts', { sectionIds: [free?.id], idempotencyKey: 'k1' });
    expect(post<CountDetail>('/counts', { sectionIds: [free?.id], idempotencyKey: 'k1' }).id).toBe(count.id);
    expect(code(() => post('/counts', { sectionIds: [free?.id], idempotencyKey: 'k2' }))).toBe('YOU_HAVE_OPEN_COUNT');
    const stock = new Set<string>(COUNT_STOCK_FIGURE_KEYS);
    expect(Object.keys(count).filter((k) => stock.has(k))).toEqual([]);
    for (const l of count.lines) expect(Object.keys(l).filter((k) => stock.has(k))).toEqual([]);
    put(`/counts/${count.id}/lines`, { lines: count.lines.map((l) => ({ lineId: l.id, countedQty: '1', skipped: false })) });
    expect(code(() => post(`/counts/${count.id}/sign`, { pin: '0000', idempotencyKey: 's1' }))).toBe('INVALID_PIN');
    const signed = post<CountDetail>(`/counts/${count.id}/sign`, { pin: '1234', idempotencyKey: 's2' });
    expect(signed.status).toBe('SUBMITTED');
  });

  it('a section someone else is counting is busy', () => {
    const options = get<{ sections: { busy: unknown }[] }>('/counts/start-options');
    expect(options.sections.some((s) => s.busy)).toBe(true);
  });

  it('the Manager decides every outside-range line before approval, and approval needs a valid PIN', () => {
    setFixtureRole('STORE_MANAGER');
    const list = get<{ rows: { id: string; status: string; can: { review: boolean } }[] }>('/counts', 'status=waiting');
    const waiting = list.rows.find((r) => r.can.review);
    expect(waiting).toBeTruthy();
    const detail = get<CountDetail>(`/counts/${waiting?.id}`);
    expect(detail.figures?.toDecide).toBeGreaterThan(0);
    expect(code(() => post(`/counts/${detail.id}/approve`, { pin: '1234', idempotencyKey: 'a1' }))).toBe('LINES_UNDECIDED');
    const decided = post<CountDetail>(`/counts/${detail.id}/decisions`, { group: undefined, lineIds: detail.lines.filter((l) => l.can.decide && l.result === 'EXCEEDS').map((l) => l.id), decision: { kind: 'WRITE_OFF', cause: 'MISCOUNT' } });
    expect(decided.figures?.toDecide).toBe(0);
    expect(code(() => post(`/counts/${detail.id}/approve`, { pin: '0000', idempotencyKey: 'a2' }))).toBe('INVALID_PIN');
    expect(post<CountDetail>(`/counts/${detail.id}/approve`, { pin: '1234', idempotencyKey: 'a3' }).status).toBe('APPROVED');
  });

  it('a Director may mark flagged lines seen; an Accountant may not', () => {
    setFixtureRole('ACCOUNTANT');
    expect(code(() => post('/counts/seen', { lineIds: ['x'] }))).toBe('FORBIDDEN');
    setFixtureRole('DIRECTOR');
    expect(post<{ seen: number }>('/counts/seen', { lineIds: [] }).seen).toBe(0);
  });
});

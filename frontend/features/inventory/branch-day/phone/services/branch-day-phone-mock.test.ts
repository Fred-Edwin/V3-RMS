import { describe, expect, it } from 'vitest';

import { ApiError } from '@/types/api';
import { DAY_COUNT_BLIND_KEYS, DAY_MONEY_KEYS } from '../../_shared/types/branch-day-contract';
import { branchDayPhoneMock as api } from './branch-day-phone-mock';

const codeOf = async (run: () => Promise<unknown>): Promise<string | null> => {
  try {
    await run();
    return null;
  } catch (err) {
    return err instanceof ApiError ? err.code : 'OTHER';
  }
};

// The mock keeps its state for the whole file, so these run in order like one head's day.
describe('the head’s day on the mock', () => {
  it('starts with the opening not checked and no money anywhere', async () => {
    const home = await api.home();
    expect(home.opening.state).toBe('NOT_CHECKED');
    expect(JSON.stringify(home)).not.toMatch(new RegExp(DAY_MONEY_KEYS.join('|')));
  });

  it('refuses a wrong PIN on the recount and takes the right one', async () => {
    const view = await api.opening();
    const lines = view.lines.map((l) => ({ itemId: l.itemId, countedQty: l.itemName === 'Milk 1L' ? '7' : l.lastNightQty }));
    const preview = await api.recountPreview({ lines });
    expect(preview.differences).toHaveLength(1);
    expect(preview.differences[0]?.difference).toBe('-1');
    expect(await codeOf(() => api.recount({ lines, pin: '0000', idempotencyKey: 'k1' }))).toBe('INVALID_PIN');
    const result = await api.recount({ lines, pin: '1234', idempotencyKey: 'k1' });
    expect(result.view.check.state).toBe('RECOUNTED');
    expect(await codeOf(() => api.recount({ lines, pin: '1234', idempotencyKey: 'other' }))).toBe('OPENING_ALREADY_CHECKED');
  });

  it('keeps the evening count blind and refuses to sign while a box is blank', async () => {
    const view = await api.count();
    expect(JSON.stringify(view)).not.toMatch(new RegExp(DAY_COUNT_BLIND_KEYS.join('|')));
    expect(view.canSign).toBe(false);
    expect(await codeOf(() => api.signCount({ pin: '1234', idempotencyKey: 's1' }))).toBe('COUNT_INCOMPLETE');
  });

  it('saves figures, signs with the right PIN only, and replays the same key', async () => {
    const view = await api.count();
    await api.saveCount({ lines: view.lines.map((l) => ({ itemId: l.itemId, countedQty: '3' })) });
    expect((await api.count()).canSign).toBe(true);
    expect(await codeOf(() => api.signCount({ pin: '9999', idempotencyKey: 's2' }))).toBe('INVALID_PIN');
    const signed = await api.signCount({ pin: '1234', idempotencyKey: 's2' });
    expect(signed.view.state).toBe('COUNTED');
    expect((await api.signCount({ pin: '1234', idempotencyKey: 's2' })).view.state).toBe('COUNTED');
    expect(await codeOf(() => api.signCount({ pin: '1234', idempotencyKey: 'other' }))).toBe('ALREADY_COUNTED');
    expect(await codeOf(() => api.saveCount({ lines: [] }))).toBe('ALREADY_COUNTED');
  });

  it('lists past days with a page and quantities only', async () => {
    const page = await api.myHistory({ page: 2, pageSize: 25 });
    expect(page.page.total).toBe(28);
    expect(page.rows).toHaveLength(3);
    const first = page.rows[0];
    const day = await api.myDay(first?.id ?? '');
    expect(JSON.stringify(day)).not.toMatch(new RegExp(DAY_MONEY_KEYS.join('|')));
  });
});

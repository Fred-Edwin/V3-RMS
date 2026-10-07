import { describe, expect, it, vi } from 'vitest';
import { getWorkforceNotifier, setWorkforceNotifier, workforceEvents, type WorkforceNotifier } from './events';

describe('workforceEvents', () => {
  it('handlers receive the typed payload', () => {
    const handler = vi.fn();
    const off = workforceEvents.on('payroll.published', handler);
    workforceEvents.emit('payroll.published', { siteId: 's1', payRunId: 'p1', publishedById: 'u1' });
    off();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]![0]).toMatchObject({ name: 'payroll.published', payload: { payRunId: 'p1' } });
  });

  it('on returns an unsubscribe', () => {
    const handler = vi.fn();
    const off = workforceEvents.on('payroll.published', handler);
    off();
    workforceEvents.emit('payroll.published', { siteId: 's1', payRunId: 'p1', publishedById: 'u1' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('only listeners of that event are called', () => {
    const other = vi.fn();
    const off = workforceEvents.on('rota.published', other);
    workforceEvents.emit('payroll.published', { siteId: 's1', payRunId: 'p1', publishedById: 'u1' });
    off();
    expect(other).not.toHaveBeenCalled();
  });
});

describe('notifier', () => {
  it('can be replaced', async () => {
    const original = getWorkforceNotifier();
    const custom: WorkforceNotifier = { notify: vi.fn(async () => undefined) };
    setWorkforceNotifier(custom);
    await getWorkforceNotifier().notify('u1', 'x', {});
    expect(custom.notify).toHaveBeenCalled();
    setWorkforceNotifier(original);
  });
});

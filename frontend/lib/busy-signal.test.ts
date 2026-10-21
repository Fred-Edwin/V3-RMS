import { afterEach, describe, expect, it, vi } from 'vitest';

import { BUSY_EVENT, busyEnded, busyStarted } from './busy-signal';

describe('busy signal (finding 46)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('counts reads that are waiting and tells the shell each time', () => {
    const seen: number[] = [];
    const target = new EventTarget();
    vi.stubGlobal('window', Object.assign(target, { dispatchEvent: target.dispatchEvent.bind(target) }));
    target.addEventListener(BUSY_EVENT, (e) => seen.push((e as CustomEvent<{ waiting: number }>).detail.waiting));
    busyStarted();
    busyStarted();
    busyEnded();
    busyEnded();
    busyEnded(); // never below zero
    expect(seen).toEqual([1, 2, 1, 0, 0]);
  });
});

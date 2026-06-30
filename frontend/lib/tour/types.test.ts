import { describe, expect, it } from 'vitest';
import { buildDriverSteps, type TourStep } from './types';

const steps: TourStep[] = [
  { anchor: 'pay-period', title: 'Pay Period', description: 'Pick a month.' },
  { anchor: 'branch', title: 'Branch', description: 'Choose a branch.', side: 'bottom', align: 'start' },
  { anchor: 'publish', title: 'Publish', description: 'Lock the period.' },
  { anchor: 'intro', title: 'Welcome', description: 'A quick tour.', showWhenMissing: true },
];

describe('buildDriverSteps', () => {
  it('drops steps whose anchor is absent from the DOM', () => {
    // Only pay-period and branch exist; publish is hidden (all-branches view).
    const present = new Set(['pay-period', 'branch']);
    const result = buildDriverSteps(steps, (a) => present.has(a));

    // pay-period, branch, and the showWhenMissing intro survive — publish drops.
    expect(result).toHaveLength(3);
    expect(result.map((s) => s.popover?.title)).toEqual(['Pay Period', 'Branch', 'Welcome']);
  });

  it('targets present anchors via their data-tour selector', () => {
    const result = buildDriverSteps(steps, (a) => a === 'branch');
    const branchStep = result.find((s) => s.popover?.title === 'Branch');
    expect(branchStep?.element).toBe('[data-tour="branch"]');
  });

  it('keeps showWhenMissing steps element-less when their anchor is absent', () => {
    const result = buildDriverSteps(steps, () => false);
    expect(result).toHaveLength(1);
    expect(result[0]?.popover?.title).toBe('Welcome');
    expect(result[0]?.element).toBeUndefined();
  });

  it('passes through side and align placement when provided', () => {
    const result = buildDriverSteps(steps, () => true);
    const branchStep = result.find((s) => s.popover?.title === 'Branch');
    expect(branchStep?.popover?.side).toBe('bottom');
    expect(branchStep?.popover?.align).toBe('start');
  });

  it('returns an empty list when nothing is present and nothing is forced', () => {
    const onlyAnchored: TourStep[] = [{ anchor: 'x', title: 'X', description: 'x' }];
    expect(buildDriverSteps(onlyAnchored, () => false)).toEqual([]);
  });
});

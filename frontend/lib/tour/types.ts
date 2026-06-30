// Reusable in-app guided tour primitives (built on driver.js).
//
// This is the first slice of a system-wide onboarding feature. Pages describe
// their tour as a list of `TourStep`s keyed by a stable `data-tour` attribute on
// the target element. `buildDriverSteps` turns those into driver.js step config,
// dropping any step whose anchor is not currently in the DOM so the tour stays
// coherent when controls are conditionally rendered (e.g. Publish/Revert is
// hidden in the all-branches view).

import type { DriveStep } from 'driver.js';

/** A single tour step authored by a page. */
export interface TourStep {
  /**
   * The value of the target element's `data-tour` attribute, e.g. `"pay-period"`
   * for an element rendered as `<input data-tour="pay-period" />`. We anchor on
   * data-attributes rather than class/structure selectors so tours don't break
   * when styling changes.
   */
  anchor: string;
  title: string;
  description: string;
  /** driver.js popover placement. Defaults to driver.js's own auto behaviour. */
  side?: DriveStep['popover'] extends infer P
    ? P extends { side?: infer S }
      ? S
      : never
    : never;
  align?: DriveStep['popover'] extends infer P
    ? P extends { align?: infer A }
      ? A
      : never
    : never;
  /**
   * When true the step is shown even if its anchor element is missing — it is
   * rendered as a centered, element-less popover. Use for intro/outro copy.
   */
  showWhenMissing?: boolean;
}

const tourSelector = (anchor: string): string => `[data-tour="${anchor}"]`;

/** True if a step's anchor element is present in the document. */
const anchorExists = (anchor: string): boolean =>
  typeof document !== 'undefined' && document.querySelector(tourSelector(anchor)) !== null;

/**
 * Convert authored `TourStep`s into driver.js `DriveStep`s, filtering out steps
 * whose anchor is not in the DOM (unless `showWhenMissing` is set). Pure aside
 * from the DOM lookup, which is injected for testability.
 */
export function buildDriverSteps(
  steps: TourStep[],
  exists: (anchor: string) => boolean = anchorExists,
): DriveStep[] {
  return steps
    .filter((step) => step.showWhenMissing || exists(step.anchor))
    .map((step) => {
      const present = exists(step.anchor);
      // A present anchor → highlight the element; a missing-but-kept step (intro
      // copy) → a centered popover with no element.
      const driveStep: DriveStep = {
        popover: {
          title: step.title,
          description: step.description,
          ...(step.side ? { side: step.side } : {}),
          ...(step.align ? { align: step.align } : {}),
        },
      };
      if (present) {
        driveStep.element = tourSelector(step.anchor);
      }
      return driveStep;
    });
}

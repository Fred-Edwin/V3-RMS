'use client';

import { useCallback, useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { buildDriverSteps, type TourStep } from '@/lib/tour/types';

const seenKey = (pageKey: string): string => `tour_seen_${pageKey}`;

interface UsePageTourOptions {
  /** Stable key per page, used for the localStorage "seen" flag. */
  pageKey: string;
  /** Authored steps for this page. */
  steps: TourStep[];
  /**
   * Auto-start the tour on first visit (when the seen flag is absent). The tour
   * still starts only after `enabled` is true, so callers can wait for the page
   * data/anchors to render first.
   */
  autoStartOnFirstVisit?: boolean;
  /**
   * Gate that must be true before the tour may run (auto or manual). Use this to
   * wait until the target elements are mounted, and to suppress the tour for
   * roles that cannot use the page. Defaults to true.
   */
  enabled?: boolean;
}

interface PageTour {
  /** Manually (re)start the tour — wired to the "Take the tour" button. */
  startTour: () => void;
  /** Whether this page's tour has been seen before on this device. */
  hasSeenTour: () => boolean;
}

/**
 * Reusable in-app guided tour for a page. Wraps driver.js with:
 *  - first-visit auto-start tracked in localStorage (per `pageKey`)
 *  - a replayable `startTour` for the "Take the tour" button
 *  - DOM-aware step filtering (see `buildDriverSteps`)
 *
 * Follows the Frontend Hook Stability Rules: `startTour` is a stable callback,
 * `steps`/options are read through refs inside it, and the auto-start effect runs
 * a single time per "enabled" transition (guarded by a ref) so it cannot loop.
 */
export function usePageTour({
  pageKey,
  steps,
  autoStartOnFirstVisit = true,
  enabled = true,
}: UsePageTourOptions): PageTour {
  // Read latest steps inside the stable callback without making it a dependency.
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  const autoStartedRef = useRef(false);

  const hasSeenTour = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(seenKey(pageKey)) === '1';
    } catch {
      return false;
    }
  }, [pageKey]);

  const markSeen = useCallback((): void => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(seenKey(pageKey), '1');
    } catch {
      // Private mode / disabled storage — tour simply replays next visit.
    }
  }, [pageKey]);

  const startTour = useCallback((): void => {
    const driveSteps = buildDriverSteps(stepsRef.current);
    if (driveSteps.length === 0) return;

    const drive = driver({
      showProgress: true,
      allowClose: true,
      overlayColor: '#2C1810', // espresso — matches the design system
      overlayOpacity: 0.6,
      stagePadding: 6,
      stageRadius: 8,
      popoverClass: 'wendo-tour',
      nextBtnText: 'Next →',
      prevBtnText: '← Back',
      doneBtnText: 'Done',
      progressText: '{{current}} of {{total}}',
      steps: driveSteps,
      // Mark seen whichever way the tour ends (finished or skipped/closed).
      onDestroyed: () => {
        markSeen();
      },
    });
    drive.drive();
  }, [markSeen]);

  useEffect(() => {
    if (!enabled) return;
    if (!autoStartOnFirstVisit) return;
    if (autoStartedRef.current) return; // run at most once per mount
    if (hasSeenTour()) return;

    autoStartedRef.current = true;
    // Defer to the next frame so freshly-rendered anchors are in the DOM before
    // driver.js measures them.
    const raf = requestAnimationFrame(() => startTour());
    return () => cancelAnimationFrame(raf);
  }, [enabled, autoStartOnFirstVisit, hasSeenTour, startTour]);

  return { startTour, hasSeenTour };
}

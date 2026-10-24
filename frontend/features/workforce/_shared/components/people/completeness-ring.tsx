import * as React from 'react';

import { cn } from '@/lib/cn';

import {
  STATUS_FILL_CLASS,
  STATUS_STROKE,
  STATUS_TEXT_CLASS,
  clampPercent,
  completenessColour,
  isComplete,
  probationColour,
  probationProgress,
} from '../../lib/style/status-colour';

/**
 * Completeness ring (Paper employee file, 11LC-0): 96 px, track 8 px, the
 * percent in 24 px semibold with a 9 px mono caption. Red under 50, amber 50 to
 * 84, green 85 to 99; at 100 it is solid green with a tick.
 */
export function CompletenessRing({
  percent,
  caption = 'COMPLETE',
  size = 96,
  variant = 'status',
  className,
}: {
  percent: number;
  caption?: string;
  size?: number;
  /**
   * `status` is the file header ring (colour by threshold). `progress` is the
   * small ring on "The file so far" (Paper RD3-0): brand stroke, mono percent, no caption.
   */
  variant?: 'status' | 'progress';
  className?: string;
}) {
  const p = clampPercent(percent);
  const colour = completenessColour(p);
  const done = isComplete(p);
  const progress = variant === 'progress';
  const stroke = Math.round(((progress ? 6 : 8) / (progress ? 64 : 96)) * size);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const half = size / 2;
  return (
    <div
      role="img"
      aria-label={done ? 'File complete' : `File ${p} percent complete`}
      className={cn('relative shrink-0', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={half} cy={half} r={r} fill={done ? STATUS_STROKE.green : 'none'} stroke={done ? STATUS_STROKE.green : progress ? 'var(--wds-neutral-100)' : 'var(--wds-neutral-200)'} strokeWidth={stroke} />
        {done ? null : (
          <circle
            cx={half}
            cy={half}
            r={r}
            transform={`rotate(-90 ${half} ${half})`}
            fill="none"
            stroke={progress ? 'var(--wds-selected-edge)' : STATUS_STROKE[colour]}
            strokeWidth={stroke}
            strokeDasharray={`${(p / 100) * c} ${c}`}
          />
        )}
        {done ? <circle cx={half} cy={half} r={r} fill="none" stroke={STATUS_STROKE.green} strokeWidth={stroke} /> : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden>
        {done ? (
          <svg width={size * 0.36} height={size * 0.36} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        ) : (
          <>
            {progress ? (
              <span className="font-wds-mono text-[15px] font-medium leading-[18px] text-wds-text-ink">{p}%</span>
            ) : (
              <>
                <span className={cn('font-wds-sans text-[24px] font-semibold leading-[26px] tracking-[-0.025em]', STATUS_TEXT_CLASS[colour])}>
                  {p}%
                </span>
                <span className="font-wds-mono text-[9px] leading-3 tracking-[0.06em] text-wds-text-secondary">{caption}</span>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Probation bar (Paper 11LC-0): an 8 px track with a fill. Green with more than
 * 30 days left, amber at 30 or fewer, red at 7 or fewer. The words ("Day 80 of
 * 90, 10 days left") are written by the screen, and the bar also exposes them as
 * its accessible name so colour is never the only signal.
 */
export function ProbationBar({
  dayNumber,
  totalDays,
  className,
}: {
  dayNumber: number;
  totalDays: number;
  className?: string;
}) {
  const daysLeft = Math.max(0, totalDays - dayNumber);
  const colour = probationColour(daysLeft);
  const pct = probationProgress(dayNumber, totalDays);
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={totalDays}
      aria-valuenow={Math.min(dayNumber, totalDays)}
      aria-valuetext={`Day ${dayNumber} of ${totalDays}, ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`}
      className={cn('relative h-2 w-full bg-wds-neutral-200', className)}
    >
      <div className={cn('absolute left-0 top-0 h-2', STATUS_FILL_CLASS[colour])} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** The colour of the "Day 80" figure above the bar, so it matches the fill. */
export function probationTextClass(daysLeft: number): string {
  return STATUS_TEXT_CLASS[probationColour(daysLeft)];
}

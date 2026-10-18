'use client';

import { TimerChip } from '../../../_shared';
import { useMyDay, useServerNow } from '../hooks/use-my-day';
import { shiftPillOf } from '../lib/clock-view';

/**
 * The shift pill in the phone's top bar (the slot the frame built empty): the shift's start before it, hours on shift during it, amber
 * near and after the end. It draws nothing for a person whose branch is still on the old clock, or who has no shift today.
 */
export function ShiftPill() {
  const mine = useMyDay();
  const nowMs = useServerNow(mine.offsetMs, mine.status === 'ready' && mine.day.enabled);
  if (mine.status !== 'ready') return null;
  const pill = shiftPillOf(mine.day, nowMs);
  return pill ? <TimerChip tone={pill.tone} time={pill.time} label={pill.label} /> : null;
}

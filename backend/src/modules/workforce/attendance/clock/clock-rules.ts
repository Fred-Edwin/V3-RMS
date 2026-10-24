import { ConflictError, ForbiddenError, ValidationError } from '../../../../utils/errors';
import { haversineDistanceMetres } from '../../../../utils/haversine';
import { EARLY_LEAVE_REASONS, MAX_OFFLINE_DELAY_MINUTES, type EarlyLeaveReason } from '../attendance.constants';
import type { EntryDay } from '../attendance.types';

const MS_PER_MINUTE = 60_000;

export interface TrustedMoment {
  /** The moment that counts: never later than the server's clock, whatever the phone says. */
  occurredAt: Date;
  deviceAt: Date | null;
  /** The phone's clock minus the server's, in minutes (null when the phone sent no time). */
  skewMinutes: number | null;
  skewFlagged: boolean;
}

/**
 * Decision A5. The phone sends `deviceAt` (when the person tapped) and `sentAt` (what its clock said when it sent the
 * request). A tap made online has no delay; a tap kept offline arrives later. The delay is `sentAt - deviceAt`, which a
 * wrong phone clock cannot change (both readings come from the same clock). The tap counts for `serverNow - delay`.
 * The phone's clock error is `sentAt - serverNow`; further off than the rule is flagged, never trusted.
 */
export function trustedMoment(serverNow: Date, deviceAt: Date | undefined, sentAt: Date | undefined, flagMinutes: number): TrustedMoment {
  if (!deviceAt) return { occurredAt: serverNow, deviceAt: null, skewMinutes: null, skewFlagged: false };
  const reference = sentAt ?? deviceAt;
  const delayMs = reference.getTime() - deviceAt.getTime();
  if (delayMs < 0 || delayMs > MAX_OFFLINE_DELAY_MINUTES * MS_PER_MINUTE) {
    throw new ValidationError('That tap is too old to trust. Ask your manager to confirm your time.', 'CLOCK_TIME_INVALID');
  }
  const offsetMs = reference.getTime() - serverNow.getTime();
  return {
    occurredAt: new Date(serverNow.getTime() - delayMs),
    deviceAt,
    skewMinutes: Math.round(offsetMs / MS_PER_MINUTE),
    skewFlagged: Math.abs(offsetMs) > flagMinutes * MS_PER_MINUTE,
  };
}

/**
 * Which rostered shift a clock-in is for. The days must be built as of the moment of the tap. A named shift is the only
 * candidate; otherwise the first shift whose window is open (from "clock-in opens" to the scheduled end) with no clock yet.
 */
export function chooseEntryToClockIn(days: readonly EntryDay[], entryId: string | undefined): EntryDay {
  const pool = entryId ? days.filter((d) => d.entryId === entryId) : days;
  if (pool.length === 0) throw new ConflictError('You have no shift planned for that time.', 'NOT_ROSTERED');
  if (days.some((d) => d.state === 'ON_SHIFT' || d.state === 'PROMPT_DUE' || d.state === 'STAYING_ON')) {
    throw new ConflictError('You are already clocked in.', 'CLOCK_ALREADY_IN');
  }
  const open = pool.find((d) => d.state === 'CLOCK_IN_OPEN' || d.state === 'NOT_IN');
  if (open) return open;
  const upcoming = pool.find((d) => d.state === 'UPCOMING');
  if (upcoming) throw new ConflictError('Clock in has not opened yet.', 'CLOCK_NOT_OPEN', { opensAt: upcoming.opensAt.toISOString(), startsAt: upcoming.startsAt.toISOString() });
  if (pool.every((d) => d.state === 'DONE' || d.state === 'AUTO_CLOSED')) {
    throw new ConflictError('This shift is already finished. If that was a mistake, ask your manager to fix it.', 'SHIFT_ALREADY_DONE');
  }
  throw new ConflictError('Your shift has ended. Ask your manager to put your time right.', 'SHIFT_OVER');
}

/** The shift a clock-out is for: the one with an open clock-in (a named shift must be that one). */
export function chooseEntryToClockOut(days: readonly EntryDay[], entryId: string | undefined): EntryDay {
  const pool = entryId ? days.filter((d) => d.entryId === entryId) : days;
  const open = pool.find((d) => d.state === 'ON_SHIFT' || d.state === 'PROMPT_DUE' || d.state === 'STAYING_ON');
  if (!open) throw new ConflictError('You are not clocked in.', 'CLOCK_NOT_IN');
  return open;
}

/** Leaving before the scheduled end needs a reason chip (proposal 5.2). Returns the code to store, or null when none is needed. */
export function earlyLeaveReason(day: EntryDay, moment: Date, code: string | undefined): EarlyLeaveReason | null {
  if (moment.getTime() >= day.endsAt.getTime()) return null;
  if (!code || !(EARLY_LEAVE_REASONS as readonly string[]).includes(code)) {
    throw new ConflictError('Your shift runs to ' + day.shift.endTime + '. Say why you are leaving early.', 'REASON_REQUIRED', { reasons: EARLY_LEAVE_REASONS });
  }
  return code as EarlyLeaveReason;
}

export interface Place {
  latitude: number;
  longitude: number;
}

/**
 * "Your phone checks you are at Nyeri Town." Mirrors the legacy radius (the Rules store holds it; null keeps the
 * environment value). No position at all is refused in plain words so the screen can offer "Ask my manager to confirm".
 */
export function checkLocation(site: Place, position: Place | undefined, radiusMetres: number): { distanceMetres: number } {
  if (!position) throw new ValidationError('We could not find where you are. Ask your manager to confirm your time.', 'LOCATION_REQUIRED');
  const distance = Math.round(haversineDistanceMetres(position.latitude, position.longitude, site.latitude, site.longitude));
  if (distance > radiusMetres) {
    throw new ForbiddenError(`You must be at the branch to clock. You are about ${distance} metres away.`, 'CLOCK_OUTSIDE_GEOFENCE', {
      distanceMetres: distance,
      allowedRadiusMetres: radiusMetres,
    });
  }
  return { distanceMetres: distance };
}

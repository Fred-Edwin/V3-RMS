/**
 * Small pure helpers for the Prep screens: the stepper's unit-aware step, quantity text, and the dates the run lists show.
 * Quantities travel as decimal strings; these helpers never put a JS float on the wire (they only compute the next string).
 */

const WHOLE_UNITS = /^(portions?|pcs?|pieces?|plates?|servings?|units?)$/i;

/** Portions and pieces step by 1; kg, litres and the rest by 0.5 (plan §6, "PrepStepper"). */
export const stepForUnit = (unit: string): number => (WHOLE_UNITS.test(unit.trim()) ? 1 : 0.5);

const scale = (n: number): number => Math.round(n * 10000) / 10000;

/** "10", "1.5", "0.25": no trailing zeros, at most 4 decimals. Anything that is not a number reads as "0". */
export const formatQuantity = (value: string): string => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return String(scale(n));
};

/** The next quantity after a tap on − or +; never below zero. */
export const stepQuantity = (value: string, direction: 1 | -1, unit: string): string => {
  const n = Number(value);
  const base = Number.isFinite(n) ? n : 0;
  return String(Math.max(0, scale(base + direction * stepForUnit(unit))));
};

/** What a person typed into the tap-to-type field, as a quantity string; null when it is not a number (the field keeps the old value). */
export const parseTypedQuantity = (text: string): string | null => {
  const cleaned = text.replace(',', '.').trim();
  if (!/^\d*\.?\d*$/.test(cleaned) || cleaned === '' || cleaned === '.') return null;
  return String(scale(Number(cleaned)));
};

export const isPositive = (value: string): boolean => Number(value) > 0;

const TZ = 'Africa/Nairobi';

/** "12 Oct 07:20" in Nairobi time, matching Paper's WHEN column. */
export const formatWhen = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: TZ });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });
  return `${date} ${time}`;
};

/** "07:20" in Nairobi time. */
export const formatClock = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });
};

const dayKey = (d: Date): string => d.toLocaleDateString('en-CA', { timeZone: TZ });

/** "today 07:20", "yesterday 07:20", else "12 Oct 07:20", for the "Recorded" subtitle and the fix window. */
export const formatDayAndClock = (iso: string, now: Date = new Date()): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diffDays = Math.round((new Date(dayKey(d)).getTime() - new Date(dayKey(now)).getTime()) / 86_400_000);
  const clock = formatClock(iso);
  if (diffDays === 0) return `today ${clock}`;
  if (diffDays === 1) return `tomorrow ${clock}`;
  if (diffDays === -1) return `yesterday ${clock}`;
  return formatWhen(iso);
};

/** "36 portions", "8 kg". */
export const withUnit = (quantity: string, unit: string): string => `${formatQuantity(quantity)} ${unit}`;

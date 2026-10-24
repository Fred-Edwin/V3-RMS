import { shiftCellLabel, type ShiftTone } from '../../../_shared';
import type { GridShift, ShiftColour, TemplateView } from '../types/rota-types';

/**
 * The server stores one of six colours; the kit draws five (Paper's swatches). ROSE has no Paper swatch, so it borrows Early bake's
 * mix (the nearest). The picker offers the five Paper draws only (see decisions-2-rota-frontend.md).
 */
const TONE_OF: Record<ShiftColour, ShiftTone> = {
  BLUE: 'morning',
  GREEN: 'afternoon',
  AMBER: 'midday',
  VIOLET: 'earlyBake',
  ROSE: 'earlyBake',
  GREY: 'leave',
};

const COLOUR_OF: Record<ShiftTone, ShiftColour> = {
  morning: 'BLUE',
  afternoon: 'GREEN',
  midday: 'AMBER',
  earlyBake: 'VIOLET',
  leave: 'GREY',
};

export const toneOfColour = (colour: ShiftColour): ShiftTone => TONE_OF[colour];
export const colourOfTone = (tone: ShiftTone): ShiftColour => COLOUR_OF[tone];

/** "8", "7.5", "40": hours as the grid shows them, no unit. */
export function hoursNumber(minutes: number): string {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? String(hours) : String(Math.round(hours * 10) / 10);
}

/** "8 h", "7.5 h". */
export const hoursUnit = (minutes: number): string => `${hoursNumber(minutes)} h`;

/** "06:00 to 14:00" and "06:00–14:00". */
export const timeRangeWords = (t: Pick<TemplateView, 'startTime' | 'endTime'>): string => `${t.startTime} to ${t.endTime}`;
export const timeRangeMono = (t: Pick<TemplateView, 'startTime' | 'endTime'>): string => `${t.startTime}–${t.endTime}`;

/** What a cell on the Shifts grid says: the timings ("06–14"). The name ("Morning") is in the tooltip, the picker, the legend and the spoken label. */
export const cellLabelOf = (t: Pick<TemplateView, 'startTime' | 'endTime'>): string => shiftCellLabel(t.startTime, t.endTime);

/** The shift's name for a sentence ("Morning"), or "day off". */
export const shiftName = (templates: ReadonlyMap<string, TemplateView>, shifts: readonly GridShift[]): string =>
  shifts.length === 0 ? 'day off' : shifts.map((s) => templates.get(s.templateId)?.name ?? 'a shift').join(' and ');

/** Paid minutes of a break in words: "None", "30 min". */
export const breakWords = (minutes: number): string => (minutes === 0 ? 'None' : `${minutes} min`);

/** Who a template is for: "All departments" or "Kitchen, Pastry, Service". */
export const usedByWords = (t: Pick<TemplateView, 'departments'>): string => (t.departments.length === 0 ? 'All departments' : t.departments.map((d) => d.name).join(', '));

/** True when a person in this department may be given the template. */
export const templateFits = (t: TemplateView, departmentId: string | null): boolean =>
  t.isActive && (t.departments.length === 0 || (departmentId !== null && t.departments.some((d) => d.id === departmentId)));

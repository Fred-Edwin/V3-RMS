import type { KpiCell } from '../../_shared/wire';

/**
 * The first three cells S1 (Overview) and S2 (All items) share. The server decides the words, the screen draws them.
 * `filter` is the chip a tap switches to on All items; an alert tone appears only while there is something to look at.
 */
export const trackedCell = (tracked: number, sections: number): KpiCell => ({
  key: 'tracked',
  label: 'ITEMS TRACKED',
  value: String(tracked),
  caption: `${sections} ${sections === 1 ? 'section' : 'sections'}`,
  tone: 'NEUTRAL',
});

export const lowCell = (lowOrOut: number): KpiCell => ({
  key: 'low',
  label: 'LOW OR OUT',
  value: String(lowOrOut),
  caption: 'below restock level',
  tone: lowOrOut > 0 ? 'WARN' : 'NEUTRAL',
  filter: 'low',
});

export const negativeCell = (negative: number): KpiCell => ({
  key: 'negative',
  label: 'NEGATIVE STOCK',
  value: String(negative),
  caption: 'need a count',
  tone: negative > 0 ? 'ALERT' : 'NEUTRAL',
  filter: 'negative',
});

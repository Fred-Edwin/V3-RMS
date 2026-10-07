import { describe, expect, it } from 'vitest';
import { lowCell, negativeCell, trackedCell } from './stock-kpis';

describe('stock KPI cells', () => {
  it('words the three shared cells', () => {
    expect(trackedCell(142, 4)).toEqual({ key: 'tracked', label: 'ITEMS TRACKED', value: '142', caption: '4 sections', tone: 'NEUTRAL' });
    expect(trackedCell(3, 1).caption).toBe('1 section');
    expect(lowCell(9)).toEqual({ key: 'low', label: 'LOW OR OUT', value: '9', caption: 'below restock level', tone: 'WARN', filter: 'low' });
    expect(negativeCell(2)).toEqual({ key: 'negative', label: 'NEGATIVE STOCK', value: '2', caption: 'need a count', tone: 'ALERT', filter: 'negative' });
  });

  it('turns the warning tones off when there is nothing to look at', () => {
    expect(lowCell(0).tone).toBe('NEUTRAL');
    expect(negativeCell(0).tone).toBe('NEUTRAL');
  });
});

import { describe, expect, it } from 'vitest';
import { phoneLabelOf, placeLabelOf } from './device-label';

describe('phoneLabelOf', () => {
  it('names the make and the system', () => {
    expect(phoneLabelOf('Mozilla/5.0 (Linux; Android 13; TECNO KG5k) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36')).toBe('Tecno, Android');
    expect(phoneLabelOf('Mozilla/5.0 (Linux; Android 14; SM-A145F) Chrome/120 Mobile')).toBe('Samsung, Android');
    expect(phoneLabelOf('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1')).toBe('iPhone');
  });

  it('falls back to the system alone, then to Unknown phone', () => {
    expect(phoneLabelOf('Mozilla/5.0 (Linux; Android 10; K) Chrome/99 Mobile')).toBe('Android');
    expect(phoneLabelOf(undefined)).toBe('Unknown phone');
    expect(phoneLabelOf('curl/8')).toBe('Unknown phone');
  });
});

describe('placeLabelOf', () => {
  const headers = (h: Record<string, string>) => (name: string) => h[name];

  it('is the city and the country when the tunnel sends them', () => {
    expect(placeLabelOf(headers({ 'cf-ipcity': 'Nyeri', 'cf-ipcountry': 'KE' }))).toBe('Nyeri, Kenya');
    expect(placeLabelOf(headers({ 'cf-ipcountry': 'ke' }))).toBe('Kenya');
  });

  it('is null when there is nothing coarse to say, and ignores a malformed country', () => {
    expect(placeLabelOf(headers({}))).toBeNull();
    expect(placeLabelOf(headers({ 'cf-ipcountry': '<script>' }))).toBeNull();
  });
});

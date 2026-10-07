import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const dir = __dirname;
const sources = readdirSync(dir)
  .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
  .map((name) => ({ name, text: readFileSync(join(dir, name), 'utf8') }));

describe('time engine static rules (contract 4.1 rule 3)', () => {
  it('finds the engine files', () => {
    expect(sources.length).toBeGreaterThanOrEqual(7);
  });

  it.each([
    ['local-time getters and setters', /\.(getHours|getMinutes|getSeconds|getDay|getDate|getMonth|getFullYear|setHours|setMinutes|setDate|setMonth|setFullYear)\(/],
    ['toLocale*', /toLocale\w*\(/],
    ['Intl', /\bIntl\./],
    ['the local-time Date constructor', /new Date\(\s*[^()\s][^()]*,/],
    ['an argument-less new Date()', /new Date\(\s*\)/],
    ['Date.now()', /Date\.now\(/],
  ])('contains no %s', (_label, pattern) => {
    const offenders = sources.filter(({ text }) => pattern.test(text)).map(({ name }) => name);
    expect(offenders).toEqual([]);
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { newKey } from './idempotency';

describe('idempotency keys', () => {
  it('a key is 8 to 80 characters (what the server accepts) and each one is new', () => {
    const a = newKey();
    const b = newKey();
    expect(a.length).toBeGreaterThanOrEqual(8);
    expect(a.length).toBeLessThanOrEqual(80);
    expect(a).not.toBe(b);
  });

  it('the hook returns one object for the life of the component', () => {
    // The dialogs list `key` in effect dependencies. A new object every render re-ran those effects after every render: a wrong-PIN
    // message was cleared the moment it was set, and a retry sent a new key. There is no DOM test library, so the source is checked.
    const source = readFileSync(resolve(__dirname, 'idempotency.ts'), 'utf8');
    expect(source).toMatch(/return useMemo\(\(\) => \(\{ current, fresh \}\), \[current, fresh\]\)/);
  });
});

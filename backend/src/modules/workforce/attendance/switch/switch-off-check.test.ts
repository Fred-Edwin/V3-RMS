import { afterEach, describe, expect, it } from 'vitest';
import { assertMaySwitchOff, setSwitchOffCheck } from './switch-off-check';

afterEach(() => setSwitchOffCheck(null));

describe('the switch-off hook', () => {
  it('lets a site switch off when nothing holds it (the behaviour before Payroll)', async () => {
    await expect(assertMaySwitchOff('s1')).resolves.toBeUndefined();
  });

  it('refuses while a payroll month that includes the site is unpaid, and names the months', async () => {
    setSwitchOffCheck(async (siteId) => (siteId === 's1' ? ['2026-09'] : []));
    await expect(assertMaySwitchOff('s1')).rejects.toMatchObject({ statusCode: 409, code: 'SITE_IN_UNPAID_PAYROLL', details: { months: ['2026-09'] } });
    await expect(assertMaySwitchOff('s2')).resolves.toBeUndefined();
  });
});

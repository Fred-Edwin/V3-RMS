import { describe, expect, it } from 'vitest';

import { asksPayroll } from './use-payroll-on';

describe('who asks whether Payroll is on (the menu row)', () => {
  it('asks only for the four roles that read payroll', () => {
    for (const role of ['HR_MANAGER', 'ACCOUNTANT', 'DIRECTOR', 'SYSTEM_ADMIN']) expect(asksPayroll(role), role).toBe(true);
  });

  it('never asks for Branch Managers, Store Managers, floor staff or nobody, so they see no new row', () => {
    for (const role of ['MANAGER', 'STORE_MANAGER', 'STORE_ATTENDANT', 'WAITER', '', null, undefined]) expect(asksPayroll(role), String(role)).toBe(false);
  });
});

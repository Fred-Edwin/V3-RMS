import { test, expect, type Locator, type Page } from '@playwright/test';

// Reproduces the HR-reported bug: editing a payroll figure, then editing a
// second figure on the same staff row shortly after, could cause the first
// (or a stale) value to silently revert to 0 once autosave settled. This
// exercises the exact same-row multi-field edit pattern HR uses in practice
// (tab across a row filling Gross Pay, then Advance, etc.) against a real
// backend + Postgres, and asserts the values survive a full page reload.
//
// Requires: backend + frontend running locally (see CLAUDE.md dev commands),
// and the E2E fixtures from backend/e2e/seed-e2e.ts seeded into whatever
// database the backend is currently pointed at. Run with:
//   pnpm exec playwright test e2e/payroll-autosave.spec.ts

const HR_EMAIL = 'e2e-hr-manager@wendo.test';
const HR_PASSWORD = 'E2ePassword123!';
const WAITER_NAME = 'E2E Test Waiter';
const BRANCH_NAME = 'E2E Test Branch';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(HR_EMAIL);
  await page.getByRole('textbox', { name: 'Password' }).fill(HR_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/app/);
}

async function goToPayrollForBranch(page: Page) {
  await page.goto('/app/hr/payroll');
  await expect(page.getByRole('heading', { name: 'Payroll' })).toBeVisible();
  // Branch select is a native <select> in the entry controls.
  const branchSelect = page.locator('select').filter({ hasText: BRANCH_NAME }).first();
  await branchSelect.selectOption({ label: BRANCH_NAME });
}

function waiterRow(page: Page) {
  return page.getByRole('row', { name: new RegExp(WAITER_NAME) });
}

async function waitForAllSaved(page: Page, timeout = 15_000) {
  await expect(page.getByText('All changes saved', { exact: false }).first()).toBeVisible({ timeout });
}

// The sheet doesn't reformat a cell's value client-side after typing, and the
// server may or may not zero-pad the decimal (Prisma Decimal serialization) —
// neither is what this test cares about. What matters is the *number* the
// figure round-trips to after a reload, so compare numerically.
async function expectNumericValue(input: Locator, expected: number) {
  await expect(async () => {
    const raw = await input.inputValue();
    expect(Number(raw || 0)).toBe(expected);
  }).toPass({ timeout: 10_000 });
}

test.describe('Payroll sheet autosave', () => {
  test('editing two fields on the same row in quick succession does not zero out either value after reload', async ({ page }) => {
    await login(page);
    await goToPayrollForBranch(page);

    const row = waiterRow(page);
    await expect(row).toBeVisible();

    // Column order on the sheet: NAME, GROSS PAY, PAYE, SHA, NSSF T1, NSSF T2,
    // HOUSING LEVY, N.C.N.S/DEDUCTIONS(x2 stacked), ADVANCE, INCENTIVES, O.T,
    // ALLOWANCES — plus 3 read-only computed + 3 staff-detail columns after.
    // Row-number cell is index 0, NAME is index 1 (both non-input <td>s).
    const cells = row.locator('td');
    const grossPayInput = cells.nth(2).locator('input');
    const advanceInput = cells.nth(9).locator('input');

    await grossPayInput.click();
    await grossPayInput.fill('45000');
    await grossPayInput.blur();

    // Simulate HR moving on to another field on the SAME row before the
    // 1500ms autosave debounce for Gross Pay has elapsed — the exact pattern
    // that used to race two full-row autosave requests against each other.
    await page.waitForTimeout(400);
    await advanceInput.click();
    await advanceInput.fill('2500');
    await advanceInput.blur();

    await waitForAllSaved(page);

    // Reload from scratch — this is the moment HR reported the figures
    // "went back to 0". Re-fetch the row fresh from the server.
    await page.reload();
    await goToPayrollForBranch(page);
    const rowAfterReload = waiterRow(page);
    await expect(rowAfterReload).toBeVisible();

    const cellsAfter = rowAfterReload.locator('td');
    await expectNumericValue(cellsAfter.nth(2).locator('input'), 45000);
    await expectNumericValue(cellsAfter.nth(9).locator('input'), 2500);
  });

  test('rapid same-row edits across three fields all persist together', async ({ page }) => {
    await login(page);
    await goToPayrollForBranch(page);

    const row = waiterRow(page);
    await expect(row).toBeVisible();
    const cells = row.locator('td');

    const grossPayInput = cells.nth(2).locator('input');
    const payeInput = cells.nth(3).locator('input');
    const advanceInput = cells.nth(9).locator('input');

    await grossPayInput.click();
    await grossPayInput.fill('60000');
    await page.waitForTimeout(200);

    await payeInput.click();
    await payeInput.fill('8000');
    await page.waitForTimeout(200);

    await advanceInput.click();
    await advanceInput.fill('1000');
    await advanceInput.blur();

    await waitForAllSaved(page);

    await page.reload();
    await goToPayrollForBranch(page);
    const rowAfterReload = waiterRow(page);
    const cellsAfter = rowAfterReload.locator('td');

    await expectNumericValue(cellsAfter.nth(2).locator('input'), 60000);
    await expectNumericValue(cellsAfter.nth(3).locator('input'), 8000);
    await expectNumericValue(cellsAfter.nth(9).locator('input'), 1000);
  });

  // Deterministic reproduction of the race itself (not just its end symptom).
  // Localhost round-trips are normally too fast and too close to the 1500ms
  // debounce for two requests to reliably overlap — which is why the tests
  // above alone don't catch a regression reliably. This test forces the
  // overlap by delaying the FIRST outgoing bulk-upsert request at the network
  // layer, so if the frontend ever fires a second request before the first
  // has resolved, both are provably in flight at once — exactly the
  // condition that let a stale full-row snapshot silently overwrite a newer
  // one. With the per-row save queue in place, the count of concurrently
  // in-flight bulk-upsert requests for the row must never exceed 1.
  test('never has two bulk-upsert requests in flight for the same row at once, even when the first is slow', async ({ page }) => {
    await login(page);
    await goToPayrollForBranch(page);

    let inFlight = 0;
    let maxConcurrent = 0;
    let delayedFirstRequest = true;

    await page.route('**/payslips/bulk-upsert', async (route) => {
      inFlight += 1;
      maxConcurrent = Math.max(maxConcurrent, inFlight);
      if (delayedFirstRequest) {
        delayedFirstRequest = false;
        // Hold this request open well past the 1500ms debounce so a second
        // edit to the same row has every opportunity to fire its own
        // request while this one is still pending.
        await new Promise((r) => setTimeout(r, 3000));
      }
      const response = await route.fetch();
      inFlight -= 1;
      await route.fulfill({ response });
    });

    const row = waiterRow(page);
    await expect(row).toBeVisible();
    const cells = row.locator('td');
    const grossPayInput = cells.nth(2).locator('input');
    const advanceInput = cells.nth(9).locator('input');

    // Unique values each run — reusing a value already on the row (e.g. left
    // over from an earlier test/run) can leave the cell un-dirtied and skip
    // autosave entirely, which would make this test pass for the wrong reason.
    const unique = Date.now() % 100000;
    const grossPayValue = 40000 + unique;
    const advanceValue = 1000 + unique;

    await grossPayInput.click();
    await grossPayInput.fill(String(grossPayValue));
    await grossPayInput.blur();

    // This edit's debounce would normally fire while the first request
    // (above) is still artificially delayed — without the save queue, this
    // sends a second overlapping request for the same row.
    await page.waitForTimeout(1800);
    await advanceInput.click();
    await advanceInput.fill(String(advanceValue));
    await advanceInput.blur();

    await waitForAllSaved(page, 20_000);

    expect(maxConcurrent, 'a second autosave request fired for this row before the first one finished').toBe(1);

    await page.reload();
    await goToPayrollForBranch(page);
    const rowAfterReload = waiterRow(page);
    const cellsAfter = rowAfterReload.locator('td');
    await expectNumericValue(cellsAfter.nth(2).locator('input'), grossPayValue);
    await expectNumericValue(cellsAfter.nth(9).locator('input'), advanceValue);
  });
});

test.describe('Payroll sheet staff details', () => {
  // Reproduces: HR edits KRA PIN / Bank Name / Account Number for a staff
  // member who has no payslip yet in the current period (the common case for
  // a brand-new pay period before anyone has entered money figures). The edit
  // PATCHes the employee profile directly and persists correctly, but the
  // sheet used to source these three columns from the payslip's embedded
  // employeeProfile snapshot — which doesn't exist for a staff member with no
  // payslip this period (and no usable prior-period payslip either) — so on
  // reload the columns fell back to blank even though the save succeeded.
  test('KRA PIN / bank details persist after reload for a staff member with no payslip yet this period', async ({ page }) => {
    await login(page);
    await goToPayrollForBranch(page);

    const row = waiterRow(page);
    await expect(row).toBeVisible();
    const cells = row.locator('td');

    // Column order: ... 13 totalDeductions, 14 netSalary, 15 kraPIN, 16 bankName, 17 accountNumber.
    const kraPinInput = cells.nth(15).locator('input');
    const bankNameInput = cells.nth(16).locator('input');
    const accountNumberInput = cells.nth(17).locator('input');

    const unique = Date.now() % 100000;
    const kraPin = `A${unique}Z`;
    const bankName = 'Equity Bank';
    const accountNumber = `${1000000 + unique}`;

    await kraPinInput.click();
    await kraPinInput.fill(kraPin);
    await kraPinInput.blur();

    await bankNameInput.click();
    await bankNameInput.fill(bankName);
    await bankNameInput.blur();

    await accountNumberInput.click();
    await accountNumberInput.fill(accountNumber);
    await accountNumberInput.blur();

    // Staff-detail saves debounce 1500ms and save-on-blur when dirty; give the
    // PATCH plenty of room to land.
    await page.waitForTimeout(2500);

    await page.reload();
    await goToPayrollForBranch(page);
    const rowAfterReload = waiterRow(page);
    await expect(rowAfterReload).toBeVisible();
    const cellsAfter = rowAfterReload.locator('td');

    await expect(cellsAfter.nth(15).locator('input')).toHaveValue(kraPin);
    await expect(cellsAfter.nth(16).locator('input')).toHaveValue(bankName);
    await expect(cellsAfter.nth(17).locator('input')).toHaveValue(accountNumber);
  });
});

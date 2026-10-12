import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The input rules from the training (12 Oct 2026), written in docs/UI_BUILD_RULES.md "Inputs":
 *  1. No native `<select>` or `<datalist>` (or a `list=` attribute) in new code: Android and Chrome draw those lists themselves, over
 *     the field. Use `components/ui2/picker`. `components/ui/` (legacy, frozen) and the legacy screens listed below are exempt.
 *  2. Every `<input>` and `<textarea>` sets `autoComplete` (off, except a login field), so the phone offers no saved-entry list.
 *     The `ui2` primitives (`Input`, `SearchInput`, `Textarea`) already do; a raw tag must say it.
 * The legacy lists only shrink: when a screen is rebuilt its entry goes. A new file, or more tags in a listed file, fails the build.
 */
const root = resolve(__dirname, '..');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name === '.next') return [];
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx$/.test(name) && !/\.test\./.test(name) ? [p] : [];
  });
const rel = (f: string): string => relative(root, f).split('\\').join('/');
const read = (f: string): string => readFileSync(f, 'utf8');

// Legacy screens (not yet redone) that still use a native select. components/ui/ is frozen and never scanned.
const LEGACY_SELECT = /^(app\/app\/|components\/orders\/)/;
const SCAN_SELECT = ['app', 'features', 'components/app', 'components/ui2', 'components/orders'];
const SCAN_AUTOCOMPLETE = ['features', 'components/app', 'components/ui2'];

const NOT_TEXT = /type=["'{](checkbox|radio|file|hidden|range|submit|button)/;
const missingAutoComplete = (text: string): number => {
  let n = 0;
  const tag = /<(input|textarea)\b/g;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(text))) {
    const end = text.indexOf('/>', m.index);
    const chunk = text.slice(m.index, end < 0 ? m.index + 600 : end);
    if (m[1] === 'input' && NOT_TEXT.test(chunk)) continue;
    if (!/autoComplete/.test(chunk)) n++;
  }
  return n;
};

// Raw `<input>`/`<textarea>` tags with no autoComplete today (a ratchet: the numbers only go down). The phone quantity fields among
// them were replaced by the shared QuantityField / PadNumberInput (which set it); the rest are desktop forms.
const AUTOCOMPLETE_BASELINE: Record<string, number> = {
  'features/inventory/branch-day/desk/components/correct-drawer.tsx': 2,
  'features/inventory/catalog/components/category-view.tsx': 1,
  'features/inventory/catalog/components/phone/add-missing-item-flow.tsx': 4,
  'features/inventory/catalog/components/screens/item-catalog-screen.tsx': 1,
  'features/inventory/counting/components/count-reason.tsx': 1,
  'features/inventory/counting/components/count-verify-parts.tsx': 1,
  'features/inventory/counting/record/components/count-shelf-screen.tsx': 1,
  'features/inventory/counting/record/components/start-count-screen.tsx': 1,
  'features/inventory/counting/review/components/decision-panel.tsx': 1,
  'features/inventory/counting/review/components/review-count-screen.tsx': 1,
  'features/inventory/counting/setup/components/count-settings-drawer.tsx': 3,
  'features/inventory/counting/setup/components/count-setup-screen.tsx': 1,
  'features/inventory/prep/recipes/components/recipe-drawer.tsx': 1,
  'features/inventory/purchasing/components/needs-restocking-tab.tsx': 3,
  'features/inventory/purchasing/components/payment-sheet.tsx': 1,
  'features/inventory/purchasing/components/phone/order-approved.tsx': 2,
  'features/inventory/purchasing/components/phone/order-returned.tsx': 1,
  'features/inventory/purchasing/components/phone/phone-kit.tsx': 1,
  'features/inventory/purchasing/components/phone/review-screen.tsx': 1,
  'features/inventory/purchasing/components/phone/search-screen.tsx': 1,
  'features/inventory/purchasing/components/phone/supplier-screen.tsx': 1,
  'features/inventory/purchasing/components/screens/new-order-screen.tsx': 1,
  'features/inventory/requisitions/components/edit-reason-popover.tsx': 1,
  'features/inventory/restock/components/review-dialog.tsx': 1,
  'features/inventory/stock/components/screens/stock-ledger-screen.tsx': 2,
  'features/inventory/suppliers/components/pay-method-views.tsx': 1,
  'features/inventory/suppliers/components/supplier-form-view.tsx': 2,
  'features/inventory/suppliers/components/upload-view.tsx': 2,
  'features/inventory/waste/branch/components/log-waste-flow.tsx': 1,
  'features/inventory/waste/branch/components/reverse-sheet.tsx': 1,
  'features/inventory/waste/branch-desk/components/reverse-entry-dialog.tsx': 1,
  'features/inventory/waste/log/components/log-waste-drawer.tsx': 2,
  'features/inventory/waste/log/components/log-waste-phone-screen.tsx': 1,
  'features/inventory/waste/reverse/components/reverse-form.tsx': 1,
  'components/app/shell/topbar.tsx': 1, // a comment that mentions the tag
};

describe('input conventions', () => {
  it('no native select or datalist outside the legacy screens', () => {
    const offenders: string[] = [];
    for (const dir of SCAN_SELECT) {
      for (const f of walk(join(root, dir))) {
        const code = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        // A tag, never a word in a comment; `list=` only counts on an input (a `list` prop on a component is something else).
        const hits = (code.match(/<select\b|<datalist\b/g) ?? []).length + (code.match(/<input\b[^>]*?\slist=/g) ?? []).length;
        if (hits === 0) continue;
        const path = rel(f);
        if (LEGACY_SELECT.test(path)) continue;
        offenders.push(`${path} (${hits})`);
      }
    }
    expect(offenders, 'use components/ui2/picker instead of a native select or datalist').toEqual([]);
  });

  it('every input and textarea sets autoComplete (login fields: their own value)', () => {
    const over: string[] = [];
    for (const dir of SCAN_AUTOCOMPLETE) {
      for (const f of walk(join(root, dir))) {
        const n = missingAutoComplete(read(f));
        const path = rel(f);
        if (n > (AUTOCOMPLETE_BASELINE[path] ?? 0)) over.push(`${path}: ${n} without autoComplete (allowed ${AUTOCOMPLETE_BASELINE[path] ?? 0})`);
      }
    }
    expect(over, 'add autoComplete="off" (or use the ui2 Input, SearchInput, Textarea)').toEqual([]);
  });
});

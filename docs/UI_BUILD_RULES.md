# UI Build Rules

Standing rules for building any screen against the Paper designs. They were
learned during Inventory and apply to every feature. Read before building a
screen's loading/error states, a shared shell, or a data table. Tokens and
primitives themselves are in `DESIGN_SYSTEM.md`.

## 1. Where things go

| Thing | Location |
|---|---|
| Design-system primitives (shadcn, restyled onto tokens) | `frontend/components/ui2/` |
| Cross-feature shell (sidebar, topbar, mobile header, nav drawer) | `frontend/components/app/shell/` |
| Generic Empty / Error / Permission-denied / Loading cards | `frontend/components/app/shell/shell-states.tsx` |
| A feature's composites and screens | `frontend/features/<feature>/<sub>/components/` |
| Screen-mirroring skeletons | the feature's `_shared/components/skeletons.tsx` or the sub-module that owns the screen |

The dividing line for states: **does the component need the exact shape of one
screen (column widths, field layout)?** Yes → feature-scoped skeleton. No (a
title + description card) → shared in `shell-states.tsx`.

## 2. Loading, error, empty

- Default loading state is a **screen-mirroring skeleton**: the real shell
  (breadcrumb, title, toolbar, KPI strip) rendered normally, with only the data
  region swapped for skeleton blocks in the real layout's shapes and widths. Build it
  from the `Skeleton` primitive (respects `prefers-reduced-motion`). Use Paper's
  drawn loading artboard if one exists; otherwise follow the same pattern.
- Generic Empty / Error / Permission-denied cards come from `shell-states.tsx`.
- One reusable states kit plus a per-screen copy table in the design; never a
  separate state design per screen.
- Every list/table screen has all three states. Add `(shell)/loading.tsx` next to
  a shell layout so the route-level fallback is the real skeleton, not a spinner.

## 3. Shells and navigation

- Screens that share a sidebar/topbar sit under a Next.js **route group** with one
  `layout.tsx` (e.g. `app/app/<feature>/(shell)/layout.tsx`). Never mount the shell
  per screen: it remounts and flashes on every navigation.
- Standalone task views (a phone-only back-chevron screen) stay outside the group.
- Every nav item uses `next/link` `<Link>`, never a plain `<a href>` (a plain anchor
  forces a full reload and defeats the persistent shell).
- **When an access decision changes, change the page gate and the menu in the same
  change, with a test** (owner decision, 24 Oct 2026, after the Director could not open
  the attendance switch the access table already gave them). The access table (back end)
  says who may do what; `lib/route-access*.ts` says who may open a page; the menu row in
  `nav-table.ts` says who sees the link. Moving one without the other leaves a person
  with a link that bounces, or a page nobody can open. The test lists the roles once in
  the back end's access test and once in the front end's gate test, word for word, so a
  change to one fails until the other follows.
- **One refusal pattern.** A page a role may not use answers with the "Not available for
  your role" screen (the gate redirects to it; it says who the page is for and gives a
  reference). A page never shows its own "you can't open this" message in place of it.

## 4. Tables and list screens (checked before "done")

Matching Paper's mock rows is not done. Every table must:
1. Paginate or load-more past ~20–30 rows, using the endpoint's `limit`/`cursor`.
2. Use deliberate column widths: numeric/money columns right-aligned and fixed;
   text truncates with the full value on hover/title.
3. Scroll horizontally on narrow viewports (or switch to card-per-row), never
   silently squash columns.
4. Sort where the data supports it and the design implies ordering.

Table style: no header fill; 10px Geist Mono uppercase header, letter-spacing
0.06em, one 1px ink rule under it; light row dividers. Never `--color-table-header-bg`.
Long tables get search, filters, and a "Showing x of y" footer.

### 4a. The one table convention (owner decision, 8 Oct 2026)

Applies to every table in every redone feature. Drawn in Paper on the page
"Inventory · Counting redesign (Oct 7)", steps 27 and 28 (pager), 24B and 24C
(type-ahead).

**Scope.** Every table in the product uses one shared table component built to this
convention (in `frontend/components/ui2/`), including tables in approved screens and in
parts of a feature already in production. Existing tables are moved onto it in code;
Paper is **not** redrawn for them, so the older approved Paper pages keep their old
footer and a fidelity check must not "fix" the component back to it. From now on every
new table is designed this way in Paper from the start.

1. **Search and filters first.** Most people should never reach page 2. A table of
   more than ~25 rows has, in one bar above the header: a search box, status chips
   (counts in the chip, e.g. "Low or out 9"), and dropdowns for the columns people
   narrow by (Category, Type, Department, Section and the like, reusing the Catalog's
   filter names). Dropdowns sit at the right and read "Name · All".
2. **Search as you type.** Results update from the first letter, with no Enter key.
   Matching letters are bold, and the list says what matched ("3 matches for 'oat'").
   Each row says where the item is now when that matters. Filters still apply to the
   matches. Clearing the box restores the normal list.
3. **Pagination, never infinite scroll.** The footer is: "Showing 1–50 of 142" on the
   left; "Rows per page" selector (25, 50, 100; default 50) and numbered pages
   (‹ 1 2 3 … 12 ›) on the right. Current page is dark, the arrow that cannot be used
   is grey. Why: the Manager audits, so she needs the size of the list, a page she can
   return to, and a footer that stays in view. Infinite scroll is only for feeds with
   no end that people skim, and nothing in this product is one.
4. **Page state lives in the URL** (page, rows per page, search, filters) so refresh,
   back and a pasted link all land on the same view. Changing a filter or the search
   goes back to page 1.
5. **Exception: lists you drag to reorder** (such as Count setup) show the whole
   section on one scrollable list, with no pager, so an item can be dropped anywhere in
   it.
6. **Mock rows are shorter than the footer says.** Paper shows about 8 rows under a
   "Showing 1–50" footer to keep the sketch short. The footer is the real behaviour.

## 5. Interactive states and failures

- Every interactive element has **hover, focus-visible, active/pressed and
  disabled**, derived from tokens (primary hover gradient, `shadow-wds-ring`,
  further darken for active, `disabled:opacity-60` + `pointer-events-none`). Reuse the
  `ui2/` primitive's state; do not invent per screen.
- Paper-drawn conditional states (active nav item, retired row, selected segment,
  price alert) are verified like the default state.
- **No silent failures:** every write action surfaces 400/403/409 responses (toast,
  inline or field message). Test an actual error response, not only the happy path.
- Pick one of optimistic or pessimistic updates per feature and stay consistent.
  Keep screens keyboard operable.

## 6. Sourcing and fidelity

- Primitives come from the shadcn CLI (`npx shadcn@latest add <component>`), never
  hand-written. Composites are hand-assembled from primitives to match Paper's tree
  via `get_jsx`; shadcn "blocks" are scaffolds only.
- **Never take a value from a screenshot.** Read `get_jsx`, `get_computed_styles`,
  `get_node_info`, `get_fill_image`. Map every value to a token; add a token when
  Paper draws a genuinely new value; a Paper-versus-token mismatch is fixed at the
  token, not hardcoded around.
- A new `fontSize` token must be registered in `lib/cn.ts`'s `customTextScale` in
  the same edit, or `tailwind-merge` silently drops it when a `text-wds-*` colour
  class is on the same element.
- Verify **by eye plus computed styles**: one real-browser screenshot against a
  `get_screenshot` of the Paper node, then `getComputedStyle` for exact px/colour
  values, and zero console errors. **Automated pixel-diff (pixelmatch,
  `pnpm visual-diff`) is permanently banned.**
- Visual fidelity and functional completeness are two separate checks; passing the
  visual check alone is never "done".

## 7. Responsiveness (Paper draws only 1440 and 390)

Build with responsive utilities and spacing tokens, not fixed widths. Verify the
two Paper anchors, then spot-check ~768px and ~1024px: no horizontal page scroll,
no overlap or clipping, wide content scrolls in its own container, sidebar
collapses/drawer goes full-screen at a sensible point. Note the chosen breakpoint
behaviour in the component comment.

### 7a. No fake phone status bar (owner decision, 4 Oct 2026)

The phone's own status bar (clock "9:41", signal, Wi-Fi, battery) belongs to the device, never to the app. **Do not build it, and do not copy it from a Paper phone frame.** Some phone screens in Paper show one as a device-frame decoration, and some front-end sessions built it into real screens with made-up values. A phone screen starts at the app's own header. Clean-up owed: find and remove any fake status bar in `frontend/` (search for hard-coded "9:41" and battery/signal icons in mobile shells and screens), and remove the decoration from the older Paper phone frames the next time each page is touched. New Paper phone frames carry no status bar.

### 7b. Inputs and choice lists (owner decision, 12 Oct 2026, after the Central Store training)

Android and Chrome draw their own lists over our fields (saved entries for a text box, the system list for a `<select>` or `<datalist>`). They cannot be styled, searched or turned off from the page, so:

1. **Every `<input>` and `<textarea>` sets `autoComplete="off"`**, except the login fields (which keep their own value so the phone can fill the saved sign-in). The `ui2` `Input`, `SearchInput` and `Textarea` already do it; a raw tag must say it.
2. **Never use a native `<select>` or `<datalist>` in new code.** Use the app's own `components/ui2/picker`: a field that opens a list right below it (with a search box when there are more than six choices), or chips when there are four or fewer. `components/ui/` (legacy, frozen) and the legacy screens outside Inventory (`app/app/**`, `components/orders/**`) are the only exceptions, and they go as each is redone.
3. **`frontend/lib/input-conventions.test.ts` fails the build** on a native select or datalist in new code, and on any `<input>` or `<textarea>` with no `autoComplete` beyond the numbers it records for existing files. That list only goes down: when you touch a file, fix its tags and lower its number.
4. **Every numeric input on a phone (quantities, prices, amounts, days, account numbers, PINs) uses the in-app number pad** (owner decision, 14 Oct 2026): `QuantityField`, or `PadNumberInput` for any single box (`PAD_INPUT_CLASS` gives it the ui2 `Input` look; `keepZeros` for a code such as an account number), or `PadInputOTP` for PIN boxes, all from `components/ui2/`. A finger opens the pad and never the phone keyboard; a mouse types as before; the pad has a "Use the phone keyboard" switch. 48 px keys, the unit always shown, "same as expected" never on a blind count, errors under the box. Real text (search, names, notes, delivery note numbers, supplier names) uses the phone keyboard. Never write `<input inputMode="decimal">`, `inputMode="numeric"` or `type="number"`. See `docs/features/inventory/training-issues.md`, rows 8 and 12.
5. **The same test fails the build on a raw numeric `inputMode` or `type="number"`** in `features/`, `components/app/` or `components/ui2/` (a baseline that only shrinks; empty today). Legacy screens outside those folders (`components/other-income`, `app/app/other-income`, `app/app/hr/payroll`) are not yet covered.

## 8. Config gotcha

A new top-level source folder must be added in the same commit to every config that
lists source folders: `tailwind.config.ts` `content`, `tsconfig.json` `include`,
`.eslintrc`, and any script with a hardcoded directory list. Missing the Tailwind
glob silently drops every class used only in that folder.

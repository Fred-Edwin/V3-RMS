# Milestone Four — Session A Follow-up (Design Fidelity + Missing Type Picker)

## Handoff note (read this first if you are a fresh session)

Session A (this folder's `session-a-plan.md`) is functionally complete and
verified — backend module, migrations, 6 endpoints, 877/877 backend tests
passing, frontend screens/routing/nav, clean `pnpm build` on both sides.
During live browser verification the prior session found and fixed **six
real bugs beyond the original plan** (see `session-a-plan.md`'s git history
for detail — dead-role fix scope creep into `GET /inventory/items`, a
cross-org validation bug, a stale-closure note-save bug, a fixed-bottom-nav
click-collision layout bug, a resubmit state-machine bug, and a
disabled-trash-icon fix for already-saved lines).

**This file exists because the owner then did a manual walkthrough and found
gaps** the prior session's functional testing didn't catch, and asked to
hand off to a fresh session to fix them with full context budget. Start
here — don't re-read `session-a-plan.md` in full, just the items below and
the "Critical files" list at the bottom.

**The owner's explicit mandate for this follow-up session (verbatim
intent, not paraphrased away):**
1. Eyeball a real screenshot of each implemented screen against its Paper
   design and adjust wherever they don't match — not just the one row the
   prior session already spot-checked structurally.
2. Use the correct design tokens (`wds-*`, per `docs/DESIGN_SYSTEM.md`),
   not approximations.
3. Use the design-system components already in the codebase
   (`components/ui2/`, `components/app/shell/`) instead of hand-rolling raw
   markup where an existing primitive covers it.
4. Confirm every implemented screen actually matches its design before
   calling this done — this is a verification mandate, not optional polish.

Do this pass across **all three Session A screens**
(`department-landing-screen.tsx`, `requisitions-list-screen.tsx`,
`requisition-section-fill-screen.tsx` + `category-grouped-line-grid.tsx`),
not just the fill screen item 2 below focuses on — the prior session built
all three from `get_jsx` output without ever screenshotting any of them
against Paper.

## 1. Missing requisition-type picker (real gap, not a design ambiguity)

**Problem:** `DepartmentLandingScreen.handleRequisitionCardTap` (in
`frontend/features/requisitions/components/screens/department-landing-screen.tsx`)
hardcodes `openRequisition({ type: 'AD_HOC' })` with no UI for the head to
pick `MORNING`/`AFTERNOON`/`EVENING`/`AD_HOC`. The backend's
`POST /requisitions` already accepts any of the four
(`backend/src/modules/requisitions/requisitions-validators.ts`'s
`OpenRequisitionSchema`) — this is a frontend-only gap.

**What to build:** a small picker (bottom sheet or inline choice, matching
this feature's existing `AddItemSheet`-style full-screen mobile sheet idiom)
that appears when the head taps "Start requisition" with **no** existing
open requisition (`mostRecent` is null in `useRequisitionsList`). Four
options, one tap each, immediately calls `openRequisition({ type })` and
navigates to the fill screen — no separate "confirm" step needed. When
`mostRecent` already exists, keep the current behavior (navigate straight to
it, no picker — you don't re-pick a type for an existing requisition).

**Check first:** read the Paper page's guide/label artboard (`p-E-0`'s page
guide, referenced in `milestone-4-plan.md`'s header) and the six fill-screen
states again for whether a type-picker step was actually drawn anywhere and
missed, versus genuinely not specified — the milestone plan's own framing
(`milestone-4-plan.md` §0) treats `type` as chosen "at open time" but doesn't
pin down the UI for it. If nothing in Paper shows a picker, this is a
build-time UI decision, not a re-derivation of settled scope — make the
call, note it, move on.

## 2. Design-fidelity pass — all three screens, by eye, against Paper

**Problem:** the owner did a manual walkthrough and felt the stepper
(−/qty/+) and trash icon on the fill screen don't match the approved
design, even though the previous session read the Paper JSX (`get_jsx` on
`10PT-0`) once and translated its Tailwind classes by hand. The owner then
generalized the concern to the whole feature: **do a real screenshot-vs-
design eyeball pass on every screen, fix using the correct `wds-*` tokens
and existing `components/ui2/`/`components/app/shell/` primitives, and
confirm the match before calling it done** — see the mandate at the top of
this file. Treat the fill-screen detail below as the first, most-scrutinized
instance of that pass, not the whole scope.

**Known raw-markup-instead-of-primitive spots to check first** (the prior
session wrote these by hand rather than reaching for an existing
`components/ui2/` primitive — confirm whether that was actually necessary
or whether a real primitive was skipped):
- **Confirmed, not just suspected:** `department-landing-screen.tsx` and
  `requisitions-list-screen.tsx` both use raw `<button>` elements with
  inline `style={{ backgroundImage: 'linear-gradient(...)' }}`, copy-pasting
  the same gradient string in multiple places — but
  `components/ui2/button.tsx` already has exactly this covered:
  `variant="primary"` → `bg-wds-gradient-primary` +
  `hover:bg-wds-gradient-primary-hover`, `variant="secondary"` →
  `bg-wds-gradient-secondary-btn` (+ hover/active states) with
  `border-wds-border-strong` already built in. Every hand-rolled gradient
  button in this feature should be replaced with `<Button variant="primary">`
  / `<Button variant="secondary">` from `components/ui2/button.tsx` — this
  is not a "check if it applies," it applies, go replace them.
- **Checked — not a gap:** `requisition-section-fill-screen.tsx`'s
  manager-note editor uses a raw `<textarea>`; `components/ui2/` has no
  `Textarea` primitive (only single-line `Input`), so this one is fine as
  built. Still worth checking `components/ui2/card.tsx` for whether the
  note card's warning-tone container duplicates styling that primitive
  already standardizes.
- **Confirmed, not just suspected:** `add-item-sheet.tsx` hand-builds its
  own `fixed inset-0` overlay with no animation, no scrim, no Radix a11y
  wiring — `components/ui2/sheet.tsx` is a real Radix-based `Sheet`
  primitive (`Sheet`/`SheetContent side="bottom"`/`SheetOverlay`, proper
  open/close transitions, focus trapping) already used elsewhere in this
  codebase. `add-item-sheet.tsx` should be rebuilt on top of `Sheet` with
  `side="bottom"`, not the bespoke div — this is not a "check if it
  applies," it applies, go rebuild it.

**What was already checked before handoff for the fill-screen stepper
specifically (don't redo this part):** the stepper container's structural
node (`12E6-0` → `12EA-0`, the −/qty/+ group) was walked node-by-node and
its raw `get_jsx` output confirms the built component's classes match
exactly — `w-8.5 h-9` per segment, `border-wds-border-strong`, `w-8 h-9`
trash container, 15×15 SVG with `strokeWidth="1.75"`. The structural/
numeric spec is not the problem there.

**What is still unverified — start here:**
1. Take a fresh screenshot of the running fill screen at 390px width
   (`mcp__chrome-devtools__take_screenshot`, viewport already ~390 wide by
   default in this harness) against a section with lines that have both an
   unedited and an edited value (to see the accent-border/bold-text/
   "changed from N" treatment together, not just the base state).
2. Get the Paper screenshot of the same state
   (`mcp__plugin_paper-desktop_paper__get_screenshot` on `10PT-0`, already
   fetched once this session — reuse or refetch).
3. Put them side by side and name the actual difference precisely — likely
   candidates worth checking with `get_computed_styles` on the *rendered
   DOM* (not just the Paper node) via
   `mcp__chrome-devtools__evaluate_script` or `get_computed_styles`-style
   inspection: border color/opacity resolving differently than expected
   (check `--wds-border-strong` renders as visibly as Paper's
   `--color-border-strong` — token names matched at build time but the
   computed contrast wasn't independently verified), icon fill/stroke
   rendering faint (check the inline `stroke="#000000"` isn't being
   overridden or antialiased differently), or a real spacing gap between
   the stepper and trash icon (Paper: both in one `gap-2.5` flex row —
   confirm the built row has the same gap, not just correct child widths).
4. Also re-check the trash icon's **disabled** state styling
   (`disabled:opacity-30` in `category-grouped-line-grid.tsx`) — this was
   the prior session's own late addition (already-saved lines can't be
   deleted, see decision log in `session-a-plan.md`'s later git history) and
   was never checked against any Paper reference, because Paper never drew
   a disabled-trash-icon state. This is a genuinely new, un-designed state —
   flag to the owner if the 30%-opacity treatment looks wrong, since there's
   no ground truth to check it against.
5. Do the same eyeball pass for `10J9-0` (editable + note) and `10RO-0`/
   `10TV-0` (read-only/returned states) — the prior session never compared
   screenshots for any of the six fill-screen states, only the base one
   informally during functional testing.

**Do not** reach for pixel-diff tooling — the owner has a standing rule
against automated visual diffing (`feedback_no_automated_pixel_diff`
memory). This is a manual, by-eye comparison plus `get_computed_styles`
spot-checks where the eye isn't enough.

## 3. Recall confirmation (owner request, not a bug)

The owner asked: recalling a submitted section should show a confirmation
dialog first, so a head can't recall by mistake (currently
`handleRecall` in `requisition-section-fill-screen.tsx` and the inline
"Recall" button in `requisitions-list-screen.tsx` both fire immediately on
tap, no confirmation).

**What to build:** a confirm step before the actual `recall()` call fires,
both places recall is reachable:
- `requisition-section-fill-screen.tsx`'s "Recall section" button
- `requisitions-list-screen.tsx`'s inline "Recall" button per row

Check `components/ui2/confirm-dialog.tsx` first (it's imported in this
codebase's `layout.tsx` for the logout confirmation — same "are you sure"
pattern, reuse it rather than building a new one). Copy matching the
logout dialog's tone: something like "Recall this section?" / "It will go
back to Draft and you'll need to resubmit it." — confirm exact wording
isn't specified anywhere in Paper (recall confirmation wasn't drawn), so
this is a build-time UI decision like the type-picker above.

## Critical files

- `frontend/features/requisitions/components/screens/department-landing-screen.tsx` — type-picker gap
- `frontend/features/requisitions/components/screens/requisition-section-fill-screen.tsx` — stepper/trash visual check, recall confirmation
- `frontend/features/requisitions/components/screens/requisitions-list-screen.tsx` — recall confirmation (list-row path)
- `frontend/features/requisitions/components/category-grouped-line-grid.tsx` — stepper/trash icon component, disabled-state styling
- `frontend/features/requisitions/hooks/use-requisitions-list.ts` — `mostRecent` null-check gating the type picker
- `frontend/features/requisitions/services/requisitions-api-service.ts` — `openRequisition` already takes `type`, no backend change needed
- `components/ui2/confirm-dialog.tsx` — reuse for recall confirmation
- Paper file `01M1ZZJ6S3FZGF5C7PPBGTKY89`, page `p-E-0`, nodes `10PT-0`/`10J9-0`/`10LE-0`/`10NJ-0`/`10RO-0`/`10TV-0` — the six fill-screen states to re-check

## Local dev state at handoff

Both dev servers were running at handoff (backend `:4000`, frontend
`:3000`, started via `pnpm dev` in each directory, `.next` freshly cleared
in `frontend/`). A test requisition exists:
`requisitionId=14f106d8-0c86-4998-99d0-0c3d702906f6`, Kitchen section has 3
lines (Grilled Chicken Portion qty 2, Royal Cling Film qty 1, S/Steel
Strainer qty 2) and a manager note, section status `DRAFT` as of handoff.
Test account: `chef1.kingongo@dev.test` / `password123` (Kitchen department
head on King'ong'o branch, set up via the Manager's assign-head flow during
Session A's own verification).

Un-committed changes from Session A (backend + frontend + docs) are still
sitting in the working tree — nothing has been committed yet. Check
`git status` before starting; don't assume a clean tree.

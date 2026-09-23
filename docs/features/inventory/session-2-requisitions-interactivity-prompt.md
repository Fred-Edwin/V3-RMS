# Session 2 — Requisitions Interactivity Pass (+ #8 toast component) — Handoff Prompt

Paste this whole file as your opening prompt.

---

You are fixing 9 findings across two related pieces of work:

1. **A new shared `ui2` toast/inline-confirmation component** (design +
   build) — currently blocking finding #8, and the only reason it was
   pulled out of Session 1.
2. **8 interactivity/polish findings on one screen** — the Branch Manager's
   "Requisitions (today)" master-detail approval screen (#28-#35). These
   came from a dedicated audit run against the `emil-design-eng`,
   `web-design-guidelines`, and `vercel-composition-patterns` skills, after
   the owner manually tested this screen and found it "very static."

Do the toast component first — it's a prerequisite for #8, and worth having
available in case any of #28-#35's fixes also want a lightweight success
confirmation (e.g. #31's "Nudge head" needs one per the findings doc).

**Read `docs/features/inventory/WALKTHROUGH_FINDINGS.md` in full first** —
§3.5 has #8's full context, §2's "Requisitions approval screen" subsection
has all 8 findings (#28-#35) with the original audit's reasoning. This
prompt summarizes and sequences them; the doc is the source of truth if
anything here seems short on detail. Also read `CLAUDE.md` (project root)
before starting — non-negotiable rules and mandatory pre-push checks apply
as always. Note the **Frontend Hook Stability Rules** section specifically,
since this session touches `useEffect`/async-state-driven UI.

**Context you need:** this is "Session 2" of a multi-session fix plan.
Session 1 (14 quick wins, unrelated screens plus one fix on this same file —
the master-detail divider, #25) already landed and is verified. One of
Session 1's fixes touched `requisition-approval-screen.tsx` directly, so
**do not trust any line numbers cited below or in the findings doc without
re-checking the current file** — read the file fresh before editing.

## Part A — Design and build a minimal `ui2` toast component

**Why this exists:** the codebase's only toast pattern
(`frontend/hooks/useToast.ts` + `ToastContainer.tsx`) is built on the legacy
`components/ui` design system and was never ported to `ui2`, which the
Inventory/Requisitions features are built on. #8 (Goods Receipt "Save
draft" gives no visible confirmation) was pulled out of Session 1 for
exactly this reason — no `ui2`-native way to show a lightweight success
confirmation exists yet.

**Keep this small.** This is not a general notification-system redesign —
it's one component: a brief, auto-dismissing success confirmation (e.g.
"Saved" or "Nudge sent to Grace W."), shown near the triggering action, not
a global notification center. Load the `artifact-design`-adjacent design
instincts from `emil-design-eng` for how a lightweight confirmation like
this should feel (duration, easing, dismissal) — this is exactly the kind
of "invisible detail" that skill is about.

1. Check `docs/DESIGN_SYSTEM.md` for any existing token/pattern for this
   before inventing new tokens — reuse `wds-` tokens already defined in
   `frontend/app/tokens.wds.css` / `frontend/tailwind.wds.preset.ts` rather
   than adding new ones unless genuinely nothing fits.
2. If a Paper design step is warranted (check whether the owner has Paper
   MCP access active in this session — if not, use good design judgment
   informed by `emil-design-eng` and the existing `ui2` primitives'
   visual language instead of blocking on Paper access), get it approved
   before building. If Paper isn't available this session, build a
   reasonable version now and flag it clearly for a later visual-fidelity
   check rather than stalling the whole session.
3. Build the component in `frontend/components/ui2/` alongside the other 8
   primitives already there, following their existing conventions (check
   `frontend/components/ui2/` for how other components are structured —
   props, variants, token usage).
4. Wire it into the Goods Receipt draft-save flow to close #8:
   `frontend/features/inventory/components/screens/new-goods-receipt-screen.tsx`'s
   `handleSaveDraft` should trigger a "Saved" confirmation after a
   successful save.
5. Verify live: save a draft, confirm the toast appears and auto-dismisses
   correctly.

## Part B — 8 Requisitions interactivity findings

### Working method

1. Read `WALKTHROUGH_FINDINGS.md` §2 (Requisitions subsection) fully.
2. Read the target file(s) fresh — do not assume line numbers are current.
3. Re-load the three skills named above before making styling/interaction
   decisions (`emil-design-eng` for polish/animation judgment,
   `web-design-guidelines` for accessibility/interaction baseline,
   `vercel-composition-patterns` for how to compose fixes through the
   existing `Button`/shared component variants rather than ad hoc styling).
4. Use a todo list (TodoWrite), one item per finding — mark done as you go.
5. Fix in the priority order the original audit gave (see below) — the
   blocking items first, since they're user-facing correctness/accessibility
   gaps, not just cosmetic.
6. Verify each fix live in a real browser as you go, not batched at the end.
7. After Part A and all 8 of Part B: `cd backend && pnpm build && pnpm
   test`, `cd frontend && pnpm build` — both clean.
8. Update `WALKTHROUGH_FINDINGS.md` — mark #8 and each of #28-#35 ✅ fixed in
   place, following the same format Session 1 used for its items (see §1.1-
   1.4 in the doc for the pattern: a "Fixed <date>:" note explaining what
   was actually done, kept alongside the original finding text, not
   replacing it).

## The 8 findings, in fix-priority order

### 1. #28 [Blocking] — Save/return errors silently swallowed
The hook (`use-requisition-approval.ts` — verify exact filename/path, it may
have moved) already returns `saveError` and a `returningSection` flag, but
the screen's own destructuring never reads them. If `saveSection` or
`returnSection` fails, the manager gets zero feedback — the button just
stops looking busy. Surface `saveError` as an inline banner near the
affected section (not a global top-of-page banner — see finding #40's
critique of that pattern on the Dispatch screen, avoid repeating it here).

### 2. #29 — No in-flight state on "Return section" confirm
`ReturnNotePanel`'s "Return section" button only disables on an empty note,
never while the request is actually in flight — a slow network lets a user
double-click and submit a duplicate return. Wire the existing
`returningSection === departmentTag` state into the button's `disabled`
prop (or add if it doesn't exist as described — verify first).

### 3. #37-equivalent for this screen — verify: does `saveEdit`'s line-edit
save path (the `EditReasonPopover`) have any in-flight indicator? The
original audit flagged this as unconfirmed from the main screen file alone
("worth checking that component directly"). Check
`EditReasonPopover`/wherever `saveEdit` wires to it, and add a pending state
if genuinely missing.

### 4. #30 — Section expand/collapse has no discoverable affordance
A submitted section that's "as requested" (nothing changed from what the
department head submitted) collapses to a one-line summary by default. The
only way to expand it is clicking the plain-text department name — no
chevron icon, no hover state, no `cursor-pointer` signal, no transition.
This is exactly what made a section's line items look "missing" during the
owner's manual walkthrough (see finding #19's live repro in the doc — data
was never missing, just hidden behind an undiscoverable click target).
Fix: add a chevron icon that rotates on expand
(`transition-transform duration-150 ease-out`, per `emil-design-eng`'s
entering/exiting-state guidance), a hover state (`hover:text-wds-primary`
or underline-on-hover) on the clickable department name, and a height/
opacity transition on the expand/collapse itself (currently an
unconditional re-render with no transition — content just pops in).

### 5. #31 — "Fill it myself" / "Nudge head" — no confirmation, no feedback
Both fire immediately on click. Per the original audit's own risk
assessment: "Nudge head" is low-stakes/reversible (just a notification) —
it doesn't need a confirm dialog, but it currently has **zero success
acknowledgment**, so a manager can't tell if it worked or accidentally
double-fires it. "Fill it myself" is higher-stakes (takes over authorship of
someone else's section) — add a lightweight inline confirm (an "Are you
sure? [Confirm] [Cancel]" swap in place, reusing the same interaction
pattern `ReturnNotePanel` already establishes elsewhere on this screen —
do not use a native `confirm()`). For "Nudge head," use the new Part A
toast component for a success acknowledgment ("Nudge sent to <name>")
instead of a confirm step.

### 6. #32 — List rail rows and section headers have no hover state
The requisition list rail (left column) and the `NOT_STARTED`/`DRAFT`/
`RETURNED` section header rows have no `hover:` classes at all. The audit
flagged this as likely the single biggest contributor to the screen
"feeling static," since the list is the most-interacted element on the
page. Add `hover:bg-wds-neutral-50` (or the project's equivalent token) at
minimum to both.

### 7. #33 — Ad hoc text buttons instead of the shared `Button` component
"+ Add a line" and "Return this section" are hand-rolled `<button>`s with
inline text/underline styling and no hover state, while the shared `Button`
component (`components/ui2/button.tsx`) already has a `variant="link"` with
proper hover/focus/active states built in. Route these through
`Button variant="link"` instead of bespoke styling — this is a
`vercel-composition-patterns` violation (ad hoc styling duplicating what a
shared primitive already solves), fix by composition, not by adding more
one-off CSS.

### 8. #34 — PIN sign sheet focus/keyboard behavior — verify and fix if needed
Lives in a separate shared component (`components/app/shell/sign-sheet.tsx`
— confirm exact path), not the main screen file. This is the
highest-consequence interaction on the whole screen (it commits an
approval). Check: does opening the sheet trap focus inside it, does Escape
close it, does focus return to the triggering element on close? If any of
these are missing, fix them — this component is likely shared with other
sign flows elsewhere in the app (Goods Receipt signing, Dispatch signing),
so check call sites before changing its behavior, and prefer building on
whatever dialog/overlay primitive it's already built on (check if it's
Radix-based, matching the pattern used in
`frontend/features/inventory/components/inventory-shell.tsx`'s mobile nav
drawer, which already gets focus trapping for free from Radix Dialog).

### 9. #35 [Low, do last if time permits] — KPI numbers update with no acknowledgment
The stat tiles at the top of the screen change value silently after an
approval action completes. Low priority per the original audit — a brief
highlight-on-change would reinforce that the action had an effect, but this
is explicitly a nice-to-have, not a blocker. Skip if the session is running
long; note it as still open in the findings doc if skipped rather than
marking it done.

## Definition of done

- [ ] Part A: new `ui2` toast component built, wired into Goods Receipt
      draft-save, #8 verified live
- [ ] Part B: all 8 findings (#28-#35) addressed — #35 may be explicitly
      deferred if time-constrained, note that clearly rather than silently
      skipping
- [ ] Each fix verified live in a real browser
- [ ] `backend`: `pnpm build && pnpm test` clean
- [ ] `frontend`: `pnpm build` clean
- [ ] `WALKTHROUGH_FINDINGS.md` updated — #8 and each of #28-#35 marked ✅
      (or left open with a note, for #35 if deferred), same format Session 1
      used
- [ ] Do not touch Session 3+ items (#36-#45 Dispatch screen findings, or
      any §5 product-decision item) — different screen, different session

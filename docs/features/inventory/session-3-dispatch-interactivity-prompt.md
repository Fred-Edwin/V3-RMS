# Session 3 — Dispatch Interactivity Pass — Handoff Prompt

Paste this whole file as your opening prompt.

---

You are fixing 7 interactivity/polish findings on one screen: the Store
Manager/Store Attendant's "Dispatch queue + Fulfil" master-detail screen at
Central Store. These came from a dedicated audit run against the
`emil-design-eng`, `web-design-guidelines`, and `vercel-composition-patterns`
skills, after the owner manually tested this screen and specifically
flagged that editable rows give no visual signal they're editable.

**Read `docs/features/inventory/WALKTHROUGH_FINDINGS.md` in full first** —
§2's "Dispatch queue + Fulfil screen" subsection has all the findings
(#36-#45) with the original audit's reasoning; #43 and #45 are already fixed
(Session 1) — skip those, this session covers #36, #37, #38, #39, #40, #41,
#42, #44 (7 items — #38 needs a verification step first, see below, it may
turn out partially already fixed). This prompt summarizes and sequences
them; the doc is the source of truth if anything here seems short on
detail. Also read `CLAUDE.md` (project root) before starting — non-
negotiable rules and mandatory pre-push checks apply as always. Note the
**Frontend Hook Stability Rules** section specifically, since this session
touches `useEffect`/async-state-driven UI.

**Context you need:** this is "Session 3" of a multi-session fix plan.
Sessions 1 and 2 already landed and are verified — both are relevant here:

- **Session 1** fixed #25 (a master-detail divider `overflow-visible` bug)
  on the Requisitions screen and audited `dispatch-queue-fulfil-screen.tsx`
  for the same pattern, confirming it was already correct
  (`overflow-y-auto`) — no action needed here, just don't re-flag it.
- **Session 2** built a new shared `ui2` toast component
  (`components/ui2/toast.tsx` + `store/wdsToastStore.ts` +
  `hooks/useWdsToast.ts`) and used it for success feedback (e.g. "Nudge sent
  to <name>" on the Requisitions screen). **Use this same component for
  #39** (dispatch success confirmation) rather than building a new one.
  Session 2 also added a loading spinner to the shared `SignSheetDialog`
  component (`components/app/shell/sign-sheet.tsx`), which benefits **all**
  its call sites — **the Dispatch screen already uses `SignSheetDialog`**
  (`dispatch-queue-fulfil-screen.tsx:9,388`), so part of #38 (in-flight
  feedback during the PIN-sign step itself) may already be fixed as a side
  effect. **Verify this live before doing any work on #38** — open the sign
  sheet, submit, and check whether it already shows a spinner/pending state.
  If it does, #38 narrows to just the *outer* "Sign & dispatch" trigger
  button (before the sheet even opens) needing its own in-flight state,
  which is a smaller fix than originally scoped.

Do not trust any line numbers cited below without re-checking the current
file — two prior sessions have touched shared components this screen
depends on.

## Working method

1. Read `WALKTHROUGH_FINDINGS.md` §2 (Dispatch subsection) fully.
2. Read the target file(s) fresh.
3. Re-load the three skills named above before making styling/interaction
   decisions.
4. Use a todo list (TodoWrite), one item per finding.
5. **Verify #38's actual current state first** (see above) before scoping
   work on it.
6. Fix in the priority order the original audit gave — blocking items
   first.
7. Verify each fix live in a real browser as you go, not batched at the
   end. This screen's most consequential action (signing a dispatch) moves
   real stock — confirm the ledger write still happens correctly after any
   change near the sign flow, via the Postgres MCP.
8. After all items: `cd backend && pnpm build && pnpm test`, `cd frontend
   && pnpm build` (and `pnpm typecheck`/`pnpm lint` if Session 2's pattern
   of running those separately is still the convention — check recent
   commits).
9. Update `WALKTHROUGH_FINDINGS.md` — mark each finding ✅ fixed in place,
   following the format Sessions 1-2 used (a "Fixed <date>:" note explaining
   what was actually done, kept alongside the original finding text).

## The 7-8 findings, in fix-priority order

### 1. #36 [Blocking] — Editable quantity input indistinguishable from read-only text
This was the owner's original complaint, confirmed directly in code:
`DispatchLineRow`'s editable `<input>` uses `border-transparent` by default
— it only gets a visible border when the line is already short. A correctly
-filled editable cell renders pixel-identical to read-only text elsewhere on
the screen (the Requested/On-hand columns, and a signed section's read-only
view). No `cursor-text`, no hover affordance, no focus state. Fix: give the
input a persistent neutral border + subtle background tint at rest (e.g.
`border-wds-border bg-wds-surface`), a `hover:border-wds-border-strong`.
Check `wds-` tokens already in use elsewhere in this file/feature before
inventing new ones.

### 2. #37 [Blocking] — No focus-visible replacement after `outline-none`
Same input as #36 has `outline-none` with nothing replacing it — a keyboard
user tabbing through dispatch quantities has no way to see which field is
focused. Combined with #36, keyboard-only use of this screen is currently
unusable. Fix: add `focus-visible:shadow-wds-ring focus-visible:border-
wds-primary` (the token the shared `Button` already uses — reuse for
consistency, per `vercel-composition-patterns`).

### 3. #38 [Blocking, verify scope first] — Signing a department has no in-flight feedback
**Verify current state first** (see Context section above) — Session 2's
`SignSheetDialog` spinner fix may have already closed part of this. What
remains to check/fix: the outer "Sign & dispatch" trigger button (the one
that opens the sign sheet) — does it show any pending state of its own, or
only the inner sheet? If the outer button has no loading state while
`dispatching` is true, add one (label change to "Dispatching…" + spinner,
consistent with whatever pattern Session 2 used inside `SignSheetDialog` —
check that component's diff/current state for the established pattern
rather than inventing a new one).

### 4. #39 [High] — No success confirmation after a department is signed
The only current signal that a sign succeeded is the section silently
collapsing into its read-only summary — no toast, no explicit
confirmation. **Use the Session 2 `ui2` toast component**
(`hooks/useWdsToast.ts` or equivalent — check its current API) to show a
success message after a department is dispatched (e.g. "Kitchen dispatched
— 6 lines, 2 short" per the original audit's suggested copy, adjust to
match real data available on success).

### 5. #40 [High] — Dispatch-error banner not scoped to the failing section
`dispatchError` currently renders as one banner above *all* sections, not
scoped to whichever department actually failed — if a manager is working
through multiple departments and one fails, the banner appears at the top
of a long scrollable list while their eye/scroll position is elsewhere.
**Follow the pattern Session 2 already established for the equivalent
problem on the Requisitions screen (#28's fix)** — it scoped the error
banner per-section via a screen-local "last failed section" state, not a
hook change. Read how that was done in
`requisition-approval-screen.tsx` and mirror the same approach here rather
than inventing a new pattern. Also add `role="alert"` for screen readers,
which the original audit flagged as missing.

### 6. #41 [Medium] — "Sign & dispatch" stays clickable at zero units
No client-side guard prevents clicking "Sign & dispatch" when every line's
quantity is zero — the only rejection currently happens after the PIN
prompt (if at all — verify whether the backend even rejects an empty
dispatch, don't assume). Add a disabled state on the button when total
dispatched units across all lines is 0, with a `title` explaining why
(matching the established pattern from Session 2's "+ Add a line" fix — a
self-documenting disabled state, not a silent one).

### 7. #42 [Medium] — Section collapse-on-sign has no transition
When a department section flips from editable to its signed read-only
summary, the swap is an unconditional hard re-render with no height/opacity
transition — reads as jarring, especially right after a user-initiated
action they're watching closely. Add a transition
(`transition-[height,opacity] duration-200 ease-out` or similar, per
`emil-design-eng`'s duration guidance for state changes like this).

### 8. #44 [Low, do last if time permits] — Two different "done"-status indicator implementations
Desktop uses a plain `●` text glyph with an inline color class; mobile uses
a proper `<span>` rounded-dot element for the same "done" signifier. Not
wrong on its own, but two different implementations of the same status
concept within one feature. Unify into one shared status-dot primitive
(check if `components/ui2/` already has something like this from another
screen — the mobile version may already be the right building block to
extract and share) per `vercel-composition-patterns`' composition-over-
duplication guidance. Skip if the session is running long — this is
genuinely low priority, note it as still open if skipped.

## Definition of done

- [ ] #38's actual current scope verified live before any code change
- [ ] All applicable findings (#36, #37, #38 [as scoped], #39, #40, #41,
      #42) fixed — #44 may be explicitly deferred if time-constrained, note
      clearly rather than silently skipping
- [ ] Each fix verified live in a real browser
- [ ] Dispatch signing still correctly writes to the ledger after any
      change near the sign flow — confirm via Postgres MCP on at least one
      real test dispatch
- [ ] `backend`: `pnpm build && pnpm test` clean
- [ ] `frontend`: `pnpm build` clean (and `pnpm typecheck`/`pnpm lint` if
      that's the established convention from recent sessions)
- [ ] `WALKTHROUGH_FINDINGS.md` updated — each finding marked ✅ (or left
      open with a note for #44 if deferred), same format Sessions 1-2 used
- [ ] Do not touch any §5 product-decision item or #1/#7 — different scope,
      different sessions

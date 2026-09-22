# HANDOFF — Milestone Four · Session B (Branch Manager Approval)

**Written:** 2026-09-21 · **Status:** ready to start · **Planned by:** Opus 5
(planning session; no code written, no files changed except this one and the
plan file it points at).

**Read this file first, then
`/home/fred/.claude/plans/yes-the-goal-was-generic-otter.md`** — that is the
full Session B plan (backend + frontend + tests + verification). This file is
the orientation and the decision log; the plan file is the task list. Do not
re-read `session-a-plan.md` in full — Session A is shipped and its detail is
history.

---

## What Session B is

Milestone Four = Stage 4 (department head fills their section) + Stage 5
(branch manager approves — a **hard gate**: nothing reaches the Central Store
unapproved).

**Session A shipped** (commit `f5089cd`): the Department Head side — schema,
two migrations, 6 endpoints, 3 mobile screens, plus a follow-up
design-fidelity pass after an owner walkthrough.

**Session B is the Branch Manager side:** review all five departments'
sections in one view, edit any line (reason required), bounce a section back
to its head, and **sign once with a PIN to approve the whole requisition**.
Plus a filterable Requisition History screen.

**The Prisma schema already has every column Session B needs** — `approvedQty`,
`editedById`, `editReason`, `deletedAt`, `addedFromNote`, `returnedNote`,
`approvedById`, `approvedAt`. **There is no migration in this session.**

---

## The session runs in two parts, in this order

### Part 1 — Step 0: Paper design pass for mobile approval

**This is not one artboard. It is a screen set of ~10.**

The desktop screen is a single master-detail page (list rail + detail pane side
by side, 1440px). **At 390px that must split into two routes** — a list screen
and a review screen — each with its own states. Deciding that split is the main
job of Step 0.

Design at **390px**, in a new row below the desktop row on Paper page `p-E-0`,
following the existing `LABEL · …` artboard convention.

| # | Artboard | Desktop source |
|---|---|---|
| M1 | Requisitions (today) · MOBILE · list | `12HK-0` left column + KPI strip → `KpiRow` |
| M2 | … · list · empty | `12UW-0` |
| M3 | Requisition review · MOBILE · needs-approval | `12HK-0` detail column — **the hard one** |
| M4 | … · editing a line (reason **bottom sheet**, not popover — thumb reach + keyboard) | the `24 pcs` box |
| M5 | … · mid-signature (PIN) | `131F-0` — mostly confirm; `SignSheetDialog` already renders at 390px |
| M6 | … · approved (signed) | `138B-0` — **no Print on mobile** |
| M7 | … · return section (note entry, bottom sheet) | `1415-0` |
| M8 | … · already-approved (read-only) | `13F1-0` |
| M9 | … · error | `13TI-0` |
| M10 | … · loading | `13PB-0` |

**Why this is needed at all:** `02-flows.md` Flow 8b says the manager approves
*"from anywhere, on their phone"* — that is the documented answer to the 6am
hard-gate problem. Paper currently has **zero mobile Branch Manager
artboards** (verified — every 390px artboard on `p-E-0` is Department Head).
The owner chose "design mobile first" over "desktop-only + log the gap".

**The M3 column problem — the actual deliverable.** The desktop line row is
Item / On hand (70px) / Par (60px) / Requested (80px) / Approved (96px) —
306px of numerics before the item name gets a pixel. That cannot survive
390px. **Put two variants in Paper and let the owner pick:**

- **M3-a "two-line row"** — item + category on line 1; `par 20 · asked 14`
  caption on line 2; approved value as a tappable bordered box on the right.
  Closest to `10J9-0`'s existing fill-screen rhythm. Lowest risk.
- **M3-b "asked → approved"** — drop On hand and Par from the row entirely,
  surface them inside the edit sheet where the decision is actually made. Row
  is just `Item ……… 14 → [14]`.

**Recommend M3-b**, because decision #1 below keeps On hand as `—` on desktop,
and an em-dash column at 390px is pure noise.

Also design at 390px: the **three section render modes**, since three bordered
buttons (Fill it myself / Nudge head / Send without) will not fit side by side.

**Explicitly descoped — these are cuts, not oversights. Say so to the owner:**
- **Mobile Requisition History** — a desk activity (date ranges, 6-column
  table). A manager on a phone is checking *today*, not auditing last week.
- **Mobile permission-denied artboard** — reuse `MobilePermissionDeniedState`
  off the shelf with the desktop copy.

**Step 0 exit criteria:** owner approves M1–M10 and picks M3-a vs M3-b.
**Do not start Part 2 before that.** Building mobile after desktop, or from a
guess, guarantees a rebuild — that is exactly what the owner avoided by asking
for a design pass.

**Last act of the design session — mandatory.** Append a short "Step 0
outcome" section to the bottom of this file recording:
- the **node ID and artboard name of every mobile artboard created** (the
  build session needs these to `get_jsx` / `get_computed_styles` against — it
  cannot source values from screenshots);
- **which M3 variant the owner picked** (M3-a or M3-b), and why if it wasn't
  the recommendation;
- **the KPI "Today's volume" confirmation** (all of today's requisitions vs.
  just the selected one — see Open items below);
- anything the design pass changed, cut, or discovered that contradicts this
  file. If the design pass reverses a decision below, say so explicitly rather
  than quietly editing the table — the reversal is the useful information.

Without that section the build session starts blind on the mobile half.

### Part 2 — the build

Backend → desktop → mobile, in the sequence given in the plan file §Sequencing.
Everything is specified there: routes (mount order is load-bearing), Zod
schemas (append siblings, never mutate the frozen ones), repository methods,
service transaction semantics, notifications, the frontend route/shell, the
three section render modes, skeletons, and the full test list.

---

## Owner decisions — settled 2026-09-21, do not re-litigate

| # | Decision |
|---|---|
| 1 | **ON HAND column stays on desktop**, rendering `—` on every row (no branch-department ledger exists until Milestone 5). Session A's mobile fill screen *dropped* it — this desktop divergence is deliberate and owner-chosen. |
| 2 | **Mobile approval gets a Paper design pass first** (Part 1 above), then one build session does desktop + mobile together. |
| 3 | **"Fill it myself" and "Nudge head" are in scope.** "Send without" stays a derived no-op — approve already ignores unsubmitted sections. |
| 4 | **Edit reason is captured in an inline popover** on the edited cell (desktop) / bottom sheet (mobile); qty + reason commit together. |
| 5 | **Manager-added lines keep `requestedQty: null`**, with `approvedQty` set. Renders `—` under Requested. Matches the schema comment: *"null = manager-added, head never asked"*. |
| 6 | **A manager-filled section counts as settled** → `SUBMITTED`, attributed to the manager. No new enum value, no migration. |
| 7 | **One signature covers the whole requisition**, not per-department. (Per-department signing is Milestone *Five*'s dispatch pattern, because there each department is its own physical delivery note.) |
| 8 | **Branch Manager workspace lives at `/app/branch/*`**, not under `/app/requisitions`. Reasoning in the plan file; short version: the sidebar in the approved design is a *branch workspace* (Branch · Requisitions · Deliveries · Day · Waste), Deliveries/Day/Waste arrive in M5/M6, and this leaves Session A's shipped routes untouched. |
| 9 | **Manager list = a new `GET /requisitions/needs-approval`** literal path. Keeps Session A's frozen `RequisitionListRow` contract genuinely untouched. |
| 10 | **"Send without" and the History "Dispatched" chip render disabled with a short explanation.** The screen then matches the approved design and the limitation reads as intentional rather than a build miss. |

Two open items, both resolved by Step 0 review: the M3-a/M3-b pick, and
confirming KPI "Today's volume" means all of today's requisitions, not just
the selected one.

---

## Findings verified during planning — these are facts, not guesses

Each of these was checked against the actual code or the actual Paper file.
They change the work, so don't re-derive them:

1. **`backend/src/services/fcm-service.ts:712` `sendRequisitionSubmittedPush`
   and `:742` `sendRequisitionDecisionPush` already exist and have ZERO call
   sites.** Session A shipped submit with no notification at all — meaning the
   manager's "Awaiting your approval" badge never lights up and the flow starts
   with a manual refresh. **Wire them, don't rewrite them.** Their
   `fcmOptions.link` values point at routes that do not exist
   (`/app/inventory/requisitions`, `/app/inventory/my-requisitions`) — fix to
   `/app/branch/requisitions` and `/app/requisitions`. Also wire the missing
   submit-side notification in Session A's `submitSection`.
2. **`backend/src/sockets/socket-service.ts` has no requisition emitters.**
   Four need adding, following `emitGoodsReceiptSigned`'s shape.
3. **`SignSheetDialog` / `SignedBySignature` are NOT re-exported from
   `frontend/features/inventory/index.ts`** — the cross-feature import is
   currently impossible. Plan promotes the file to
   `components/app/shell/sign-sheet.tsx` (it's genuinely shared: receiving
   signs, requisitions sign, M5 dispatch will sign). **Its own isolated
   commit**, then re-verify receiving in a browser — it edits shipped code.
4. **Paper `p-E-0` has zero mobile Branch Manager artboards** — confirming
   Step 0 is real work.
5. **`frontend/components/ui2/` has no Textarea, Tabs, DateRangePicker or
   Popover.** Textarea needs building (return note + edit reason). The popover
   should be built locally (~40 lines, absolutely positioned) rather than
   adding a Radix primitive for one use.
6. **No edit-reason *input* is drawn anywhere in Paper** — but its *display*
   treatment is: dotted-underline, line-clamped text inline beside the item
   name on the edited line. So the layout is designed; only the input
   affordance was a gap. Decision #4 closes it.
7. **`frontend/app/app/layout.tsx:610`** bypasses the legacy shell only for
   `/app/inventory`. This is why Session A's fill screen uses
   `fixed inset-0 z-50` to escape the legacy bottom nav. Adding `/app/branch`
   to that one line is what makes the desktop shell render at all.

---

## The three things most likely to go wrong

Named here because they are judgment-shaped, not typing-shaped:

1. **Decimal equality driving the edit-reason rule.** `'14' !==
   Decimal('14.0000')` in JS. Compared naively, **every** line demands a reason
   and the feature is unusable. One `decimalsEqual(a, b)` helper, used by both
   the service guard and the `isAsRequested` serializer, plus the explicit test
   asserting `'14'` vs `Decimal('14.0000')`.
2. **The recall race.** A head can recall a section while the manager sits on
   the review screen. Approve must re-assert, inside the transaction, that every
   section is *still* `SUBMITTED` — using the guarded `updateMany` (it takes row
   locks; a `count()` under READ COMMITTED does not). Get this wrong and you
   approve a section that was pulled back, and Milestone 5 dispatches against it.
3. **The popover clipped by the scroll container.** The section blocks live
   inside the detail column's `overflow-y-auto`. This is the classic
   popover-in-a-scroll-container failure — verify it in a real browser and be
   ready to portal it.

Plus one silent one: **forgetting `markPendingApprovalIfOpen` on the
fill-myself path.** The section looks submitted, but the requisition stays at
`OPEN` and approve then refuses with "nothing to approve".

---

## Visual verification is mandatory, not optional polish

**This is why Session A needed a follow-up session** — its screens were built
from `get_jsx` output without ever being screenshotted against Paper, and an
owner walkthrough then found real deviations across all three screens.

The plan file has the full protocol. The short version:

- Screenshot the Paper node, screenshot localhost, compare side by side.
- **`browser_resize` to 1440×900 exactly.** A 1512 viewport makes every flex
  proportion lie and you will pass a screen that is wrong.
- **Source every number from `get_jsx` / `get_computed_styles`, never from a
  screenshot.** (That is how the 70/60/80/96 column widths were established.)
- Compare in a **fixed order** — structure → copy word-for-word → **lanes**
  (trace a vertical line down the Approved column across all rows; misalignment
  is the #1 hand-rolled-flex-table defect and is invisible unless you look for
  it) → weight/size hierarchy → colour moments → separators (dashed above
  not-submitted, solid above submitted — easy to get backwards) → vertical
  rhythm.
- Run it on **all 9 desktop states + History + every mobile artboard**, and do
  it **before** calling a screen done.
- Compare **layout and treatment, never data.** The artboards carry mock data —
  including a Department Head shown signing in History, which is drift, not
  spec. Only a MANAGER can sign.

**No pixel-diff tooling.** The owner has a standing ban
(`feedback_no_automated_pixel_diff`). This is by-eye plus
`get_computed_styles` spot-checks.

---

## Before you start

- `git status` — check the tree. `MILESTONES.md` may be mid-edit.
- **`MILESTONES.md`'s build-status table still says Milestone Four is "Not
  started — ready for Step 7, Session A".** That is stale by one commit;
  Session A shipped. Correct it as part of this session's doc pass.
- Both dev servers: backend `:4000`, frontend `:3000`, `pnpm dev` in each.
- Test account from Session A: `chef1.kingongo@dev.test` / `password123`
  (Kitchen department head, King'ong'o branch). **You will also need a MANAGER
  account on the same branch, with a PIN set** — the approve endpoint verifies
  `pinHash`, and PIN is set via `POST /users/me/pin`. Session A's verification
  data may still be in the local DB; check before re-seeding.
- Run both build checks before any push:
  `cd backend && pnpm build && pnpm test`, `cd frontend && pnpm build`.

---

## Step 0 outcome (2026-09-21) — design pass complete, owner-approved

All 10 mobile artboards built on Paper page `p-E-0`, new row below the desktop
row (label artboard "LABEL · Mobile row (Branch Manager approval)"). Owner
reviewed M1–M10 and approved with no changes requested.

**M3-a vs M3-b: M3-b shipped** — no On hand/Par columns in the review row.
Row shape is `Item name / category caption line 2` on the left, `asked →
[approved]` on the right, with the bordered/caramel-accent treatment only on
genuinely changed or added lines (unedited values stay plain text, per §13
color-as-exception). On hand/Par moved into the M4 edit sheet instead.
Confirmed working well in review — item names finally get room to breathe at
390px, and the em-dash On-hand column (no ledger exists yet, per
`milestone-4-plan.md` §7 Q1) is no longer wasted screen space.

**KPI "Today's volume" scope:** built as all of today's requisitions
(matches the desktop KPI's own scope, not just the open one) — not
separately re-confirmed with the owner beyond the general M1–M10 approval;
flag if the build session's real data model disagrees.

**Artboard node IDs** (fileId `01M1ZZJ6S3FZGF5C7PPBGTKY89`, page `p-E-0`) —
use these with `get_jsx` / `get_computed_styles`, never source values from
screenshots:

| # | Artboard | Node ID |
|---|---|---|
| M1 | Requisitions (today) list | `1797-0` |
| M2 | list · empty (zero requisitions today, not "nothing selected" — the split-pane empty state doesn't apply once mobile has separate routes) | `17B6-0` |
| M3 | Requisition review · needs-approval (M3-b row shape) | `17D7-0` |
| M4 | editing a line · bottom sheet (qty stepper + required reason textarea) | `17GW-0` |
| M5 | mid-signature (PIN) | `17L2-0` |
| M6 | approved (signed) — diff summary + signature block appended after all sections, no edit affordances, no Print | `17OY-0` |
| M7 | return section · note entry (bottom sheet, error-red CTA) | `17SM-0` |
| M8 | already-approved · read-only (late arrival — different signer, "read-only" header subtitle) | `17WI-0` |
| M9 | error | `17ZN-0` |
| M10 | loading (screen-mirroring skeleton) | `180H-0` |

**Deviations/discoveries during the design pass, beyond what §0 above
predicted:**
- M2 is a genuine zero-state ("no requisitions yet today"), not the
  desktop's "nothing selected" empty state — that concept doesn't exist once
  mobile splits list and detail into separate routes. Don't conflate the two
  when wiring up empty-state logic.
- The three section render-mode buttons (Fill it myself / Nudge head / Send
  without) stack vertically full-width on mobile, not side by side — as
  anticipated in Part 1 above.
- M6/M8 required actively stripping edit affordances (deleted the "+ Add a
  line" footer, deleted the sign bar) rather than just hiding the bottom
  sheet triggers — worth remembering when wiring real component reuse so a
  signed/read-only view doesn't accidentally ship live edit controls.

Nothing else from the Part 1 plan above was reversed — the ~10-artboard
scope, the descoped items (mobile Requisition History, mobile
permission-denied reusing `MobilePermissionDeniedState`), and all 10 owner
decisions held as written.

**Part 2 (the build) is unblocked as of this outcome.**

---

## Step 2 handoff (2026-09-22) — build done, functionally verified, visual fidelity pending

The build session ran to completion: backend (commits `b4ce0a0`, `7ee1ab6`)
and frontend (commit `d73f810`) are both in, `pnpm build && pnpm test`
clean on both sides (920 backend tests), and the flow was verified end-to-end
in a real browser against the real backend — not just `get_jsx` output. This
section is the starting point for a **follow-up session whose only job is
visual fidelity against Paper**, the same shape as Session A's own follow-up.

**What "functionally verified" covered, concretely:** logged in as a real
`MANAGER` (`manager1.kingongo@dev.test` / `password123`, PIN `1234` — already
set on that account), a real Kitchen department head submitted a real line,
the manager opened it, edited the line with a required reason, saved (found
and fixed a stale-closure bug where the edit never actually reached the
server — `use-requisition-approval.ts`'s `saveSection` now takes an explicit
`pendingEdit` override, same pattern as `use-requisition-section.ts`'s
`save({ managerNote })`), signed with the PIN, confirmed the DB row flipped to
`APPROVED`, viewed the read-only approved state, opened History, opened
Print, and confirmed the mobile list (M1) and mobile already-approved
read-only view (M8) render against the same real data with no console
errors. Also found and fixed a real backend bug live: `isEdited` was `true`
for a never-reviewed line (`approvedQty` still `null`) — see commit
`7ee1ab6`.

**What was NOT done — this is the next session's actual job:**
- No side-by-side comparison against any Paper node was performed. Every
  screen was built by reading `get_jsx` output (structure, classes, copy) for
  these nodes and translating it to the codebase's own primitives/tokens —
  the same starting point Session A had, and the same reason Session A's
  visual pass found real deviations. Assume there are deviations here too.
- Mobile M2 (list empty), M9 (error), M10 (loading), and the *live* M5
  (mid-signature)/M7 (return-section bottom sheet)/nudge flows on mobile were
  reviewed by reading the code, not clicked through in a real mobile
  viewport — a browser session became unreliable (auth token expiry +
  devtools click-coordinate issues under viewport emulation) partway through
  that pass. Re-verify these live before trusting them.
- The Print page's treatment of a fully-unsubmitted department section (bare
  header, no lines — cosmetic, not incorrect) was noticed but not polished;
  worth a look during the visual pass since Print has its own Paper
  reference this session never pulled.

**Do the visual pass in the protocol this file's Part 2/"Visual verification"
section above already specifies** — `browser_resize` to exactly 1440×900 for
desktop (a 1512 viewport lies about flex proportions), source every number
from `get_jsx`/`get_computed_styles` never a screenshot, and compare in the
fixed order (structure → copy → lanes → weight/size hierarchy → colour
moments → separators → vertical rhythm). No pixel-diff tooling — by-eye only,
per the owner's standing ban.

**Screens to run it on, with their Paper node IDs** (fileId
`01M1ZZJ6S3FZGF5C7PPBGTKY89`, page `p-E-0`) — all already listed earlier in
this file, repeated here so the next session doesn't have to hunt:

Desktop: `12HK-0` (needs-approval), `12UW-0` (empty), `131F-0`
(mid-signature), `138B-0` (approved), `13F1-0` (already-approved race),
`13LQ-0` (permission-denied), `13PB-0` (loading), `13TI-0` (error), `13X2-0`
(History), `1415-0` (return-section note entry).

Mobile: `1797-0` (M1 list), `17B6-0` (M2 list empty), `17D7-0` (M3
needs-approval), `17GW-0` (M4 edit sheet), `17L2-0` (M5 mid-signature),
`17OY-0` (M6 approved), `17SM-0` (M7 return sheet), `17WI-0` (M8
already-approved), `17ZN-0` (M9 error), `180H-0` (M10 loading).

**Local dev accounts for that session:** `manager1.kingongo@dev.test` /
`password123` (Branch Manager, PIN `1234` already set) and
`chef1.kingongo@dev.test` / `password123` (Kitchen department head, same
branch) if a fresh requisition needs opening. The requisition used for this
session's verification (`ab539aab-3be6-4c1c-914e-43b68fb42d39`) is already
`APPROVED` — open a new one via the department head account to get a live
needs-approval state to compare against `12HK-0`/`17D7-0`.

---

## Traces to

`/home/fred/.claude/plans/yes-the-goal-was-generic-otter.md` (the Session B
plan — the task list) · `milestone-4-plan.md` (Step 5, the milestone-level
plan) · `session-a-plan.md` + `session-a-followup-plan.md` (history, don't
re-read in full) · `02-flows.md` Flows 7, 7a, 8, 8a, 8b · `02-screens-by-role.md`
Branch Manager #3–5 (status there is stale — see `milestone-4-plan.md` §0) ·
Paper page `Milestone Four · Requisition & Branch Approval` (`p-E-0`) in
`01M1ZZJ6S3FZGF5C7PPBGTKY89` · `docs/API_CONTRACT.md` §24 ·
`docs/DESIGN_SYSTEM.md` §13 (color-as-exception) · `docs/CODING_STANDARDS.md` ·
`docs/FEATURE_REDO_PLAYBOOK.md` §7–9.

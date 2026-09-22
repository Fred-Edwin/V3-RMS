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

## Visual-fidelity pass (2026-09-22) — done, milestone now visually verified

Ran the protocol this file's "Visual verification is mandatory" section
specifies against all 10 desktop states + History and all 10 mobile
artboards. `browser_resize` to exactly 1440×900 for desktop, genuine 390×844
(confirmed via `window.innerWidth`/`devicePixelRatio`, not just a narrow
window) for mobile. Every number sourced from `get_jsx`/`get_computed_styles`,
never a screenshot. No pixel-diff tooling used, per the owner's standing ban —
by-eye plus `get_computed_styles` spot-checks only.

**Root cause worth flagging for future sessions:** most of the desktop column-
width bugs below trace to one mistake — Tailwind's default spacing scale only
defines specific steps (`0–12` as integers, then `14,16,20,24,28,32,36,40,44,
48,52,56,60,64,72,80,96`, plus `0.5/1.5/2.5/3.5`). The build session used
Paper's own JSX export values verbatim (`w-17.5`, `w-15`, `w-19`, `w-95`,
`gap-1.25`, `text-[17px]/5.5`, etc.) as if they were valid Tailwind utilities.
They aren't — Paper's JSX export uses those numbers as *approximations of
measured pixels*, not real utility classes, and Tailwind silently generates
**no CSS at all** for an unrecognized class, so the element falls back to
content-driven sizing. This is invisible in a quick glance (nothing errors,
nothing looks obviously broken) and only surfaces as subtle misalignment —
exactly the kind of defect this protocol's "trace a vertical line down
repeated columns" step exists to catch. Swept and fixed every instance found
across `requisition-approval-screen.tsx`, `requisition-approval-mobile-
screen.tsx`, `requisitions-for-approval-mobile-screen.tsx`, and
`requisition-history-screen.tsx` (verified via a script cross-referencing
every `w-`/`h-`/`p-`/`gap-`/etc. class against Tailwind's actual default
scale) — all converted to arbitrary-value syntax (`w-[70px]` etc.) with the
correct pixel value. Worth a similar sweep on any future screen built the
same way (reading Paper JSX output and translating class-for-class).

### Desktop — `12HK-0` (needs-approval)
**Deviations found and fixed:**
- Requisition title and sidebar rail rendered the raw `RequisitionType` enum
  (`"AD_HOC requisition"`, `"MORNING"`) instead of a humanized label
  (`"Ad-hoc requisition"`, `"Morning requisition"`) — added a
  `requisitionTypeLabel()` helper (matches the existing `TYPE_LABEL` map
  convention already used in `requisitions-list-screen.tsx`).
- Department names in every section block rendered the raw `DepartmentTag`
  enum (`KITCHEN`, `PASTRY`) instead of title case (`Kitchen`, `Pastry`) —
  added the same `DEPARTMENT_LABEL` map already used in
  `department-landing-screen.tsx`.
- On-hand/Par column widths were broken Tailwind classes (`w-17.5`/`w-15`,
  see root-cause note above) — computed to ~60px/~25px instead of the
  documented 70px/60px, causing the whole numeric column block to drift left
  and the header row's "On hand" label to sit flush against "Par" with no
  gap. Fixed to `w-[70px]`/`w-[60px]`.
- Approved-qty edit-pill width (`w-17`), its vertical padding (`py-0.75`),
  category-label column width (`w-19`), sidebar rail width (`w-95`), and
  several `pt-4.5`/`py-1.75`/`py-30`/`max-w-70`/`max-w-105` spacing values
  were all the same class of broken Tailwind utility — all fixed to
  arbitrary-pixel equivalents.
- PIN-dialog subtitle used `${type.toLowerCase()} requisition` (producing
  "sign ad_hoc requisition") instead of the humanized label — fixed to use
  `requisitionTypeLabel()`.

### Desktop — `12UW-0` (empty, nothing selected)
**Deviations found and fixed:**
- Real bug, not just cosmetic: the screen's loading-vs-idle branching
  (`status === 'loading' || status === 'idle'`) meant navigating to
  `/app/branch/requisitions` with no `?id=` **never left the loading
  skeleton** — `idle` (no id selected) was being treated identically to
  `loading` (fetch in progress), so the "Select a requisition" empty state
  was dead code. Split the condition so `idle` falls through correctly.
- Missing icon: Paper shows a bordered document-icon badge above "Select a
  requisition"; the live code had text only. Added the icon (exact SVG path
  from Paper's `get_jsx`).
- "Select a requisition" heading weight was `font-semibold`; Paper uses
  `font-medium`. Fixed.

### Desktop — `131F-0` (mid-signature/PIN) and `138B-0` (approved)
**Deviations found and fixed:**
- **Entire "Changes from what was requested" summary block was missing** —
  Paper shows a bordered `bg-neutral-50` box, once approved, listing each
  edited department and its line-level diffs (`Kitchen — Beef Patty 120g 40
  → 24 pcs; added Cling Film 300m · 2 unit`). Built a `changeSummaryLines`
  derivation (client-side only, from data the detail payload already
  carries — `isEdited`/`requestedQty`/`approvedQty`/`itemName`/`usageUnit`,
  no new endpoint) and rendered the block matching Paper's copy/layout
  exactly.
- Approved-state subtitle was missing the "Department heads have been
  notified of the N changes." clause Paper shows when the *current viewer*
  is the one who signed (`138B-0`, "signed by you") — but Paper's race-case
  screen (`13F1-0`, someone else's signature) omits that clause entirely.
  Gated the clause on `approvedByName === user?.name` to match both cases.
- PIN dialog subtitle same enum-leak bug as `12HK-0` — fixed via the same
  `requisitionTypeLabel()` helper.

### Desktop — `13F1-0` (already-approved race)
No additional deviations beyond the shared subtitle/enum-label fixes above —
the info banner copy and layout already matched Paper. Verified live by
opening an already-approved requisition as the same signer (full race
condition with a second concurrent signer not independently reproduced this
session — see "Not independently verified" below).

### Desktop — `13LQ-0` (permission-denied)
**Confirmed gap, not fixed this session — flagging as a real, pre-existing
architecture decision outside a visual-fidelity pass's scope.** Paper designs
an in-app "Not available for your role" screen with a "Go to my section" CTA.
The live app never reaches it: `middleware.ts`'s `isAllowedPath()` gates
`/app/branch/*` on `role === 'MANAGER'` and does a **hard server-side
redirect** to the visiting user's role home for anyone else — verified live
by hitting the route as `chef1.kingongo@dev.test` (redirected straight to
`/app/dashboard`, no flash of the denied screen). Implementing Paper's screen
would mean removing the middleware gate and moving the check into the page
component — a real behavior/architecture change, not a spacing or copy fix,
so left alone per this session's "do not re-litigate architecture decisions"
mandate. Next functional session should decide whether to keep the silent
redirect (current, simpler) or build the soft-denial screen Paper specifies.

### Desktop — `13PB-0` (loading)
**Deviation found and fixed:** the KPI strip and list rail rendered as empty/
zeroed real content during the initial fetch (no skeleton at all) instead of
Paper's shimmer-block placeholders for both regions. Added
`RequisitionsKpiSkeletonDesktop` and `RequisitionsListRailSkeletonDesktop` to
`skeletons.tsx` (matching the file's existing skeleton-component convention)
and gated both regions on `list.status === 'loading'`. Too fast on localhost
to catch in a normal screenshot; confirmed the code path is correctly wired
and does not regress the loaded state.

### Desktop — `13TI-0` (error)
**Deviation found and fixed:** `list.status`/`list.error` from
`useRequisitionsForApproval()` were destructured but never read in the
render — a failed list fetch silently showed zeroed KPIs and an empty rail
with no error messaging at all. Added a `list.status === 'error'` branch
rendering the shared `ErrorState` with Paper's exact copy ("Couldn't load
requisitions" / "Check your connection and try again. Nothing has been
changed."). (Note: this is distinct from the already-correct per-ID
`"Couldn't load this requisition"` error, which fires when a specific
`?id=` 404s and was already implemented and verified live.)

### Desktop — `13X2-0` (History)
**Deviations found and fixed:**
- Column widths (`Date`/`Signed by`/`Units`/`Status`) used the same class of
  broken Tailwind utilities (`w-30`, `w-35`, `w-22.5`) — fixed to
  `w-[120px]`/`w-[140px]`/`w-[90px]`.
- Requisition-type enum leak in the row label (`{row.type} requisition`) —
  fixed with the same `requisitionTypeLabel()` helper (duplicated locally in
  this file per the existing per-file `TYPE_LABEL` convention, not imported
  cross-file).

**Confirmed gap, not fixed — real backend/API-contract gap, out of scope for
a visual-only pass:** Paper's History table has **6 columns** (Requisition /
Date / Signed by / **Lines** / Units / Status); the live implementation has
5 — `RequisitionHistoryRow` has no `totalLines` field, and no
`/requisitions/history` endpoint is documented in `API_CONTRACT.md` §24 (the
row shape was decided ad hoc during the build session). Also confirmed still
missing: the date-range picker Paper shows next to the status tabs — this was
already flagged during Session B's planning (finding #5: "no DateRangePicker
primitive exists yet") as a known, accepted gap, not a silent drop. Both
need a small backend change (or, for the date picker, a new `ui2` primitive)
and should go to the next functional session, not this visual pass.

### Desktop — `1415-0` (return-section note entry)
**Real bug found and fixed — this was the biggest functional/visual gap in
the whole desktop pass.** The desktop "Return this section" action used a
native `window.prompt('Reason for returning this section:')` — a browser
dialog with zero relation to the product's design system, completely
unlike Paper's design (an inline panel that replaces the section's line rows:
error-tinted box, "Return to Grace W. — note required" header, bordered
textarea with placeholder copy, Cancel + solid-red "Return section" buttons).
Built a `ReturnNotePanel` component matching Paper's `1415-0` layout exactly,
wired local `returning`/`returnNote` state into `SectionBlock` (both the
collapsed "as requested" branch and the expanded-with-lines branch), and
changed the `onReturn` callback signature to take the note directly instead
of the parent doing a `window.prompt`. Verified live end-to-end: opened the
panel, typed a note, confirmed, watched the section flip to "returned —
{note}" with the Fill it myself/Nudge head/Send without buttons reappearing
— full round trip through the real backend, not just a render check.

Also fixed a name-truncation edge case surfaced during this build: the
`firstNameLastInitial()` helper (needed for "Return to Grace W.") was taking
the last whitespace-split word's first character, which broke on dev-seed
names carrying a parenthetical branch suffix ("Dev Chef 1 (King'ong'o)" →
produced "Dev (." instead of "Dev 1."). Stripped the parenthetical suffix
before splitting. Will read correctly for real production names (e.g. "Grace
Wanjiru" → "Grace W."); the residual "Dev 1." odd form left in this session's
screenshots is dev-seed-data noise (a numbered placeholder name with no real
surname), not a bug — matches this file's own standing note not to chase
mock-data artifacts.

### Mobile — M1 `1797-0` (list)
**Deviation found and fixed:** row status was hardcoded to always show a
warning-colored dot + "Awaiting approval" text with no timestamp, regardless
of actual status. Paper shows status-aware copy with the opened time
("Awaiting approval · opened 06:12", "Approved · opened 05:48") and a
success-green dot for approved rows. Fixed using the `openedAt`/`status`
fields already on `RequisitionManagerListRow`. (Paper additionally shows a
distinct "1 section returned" red-dot variant and an "Earlier today" date
grouping — both need per-section data or multi-day grouping the current list
row type doesn't carry; flagging as a smaller known gap, not fixed this
session since it would need a data-shape change.)

### Mobile — M2 `17B6-0` (list, empty)
**Deviations found and fixed — this state was previously unreachable in a
meaningful way:**
- The KPI strip was completely omitted in the zero-rows branch (Paper shows
  it with `0`/`0`/`—`/`0 units`); the live code swapped the *entire* content
  area for the empty-state message, losing the KPI strip Paper keeps visible.
- Missing icon (circular neutral badge, plus/cross glyph) above "No
  requisitions yet today".
- Copy was wrong: lived code said "Department heads haven't opened a
  requisition yet — check back later."; Paper says "Once a department head
  opens or submits a section, it will show up here for your approval."
- "Depts not submitted" KPI showed `0` instead of Paper's `—` em-dash in the
  zero-state.
Restructured so the KPI strip always renders, with the icon/copy/empty-body
swapped in below it. Verified live via a Playwright route-mock that returns
an empty rows array (couldn't reach zero-state through real data without
disturbing other test fixtures) — screenshot confirms exact match to Paper.

### Mobile — M3 `17D7-0` (needs-approval)
No deviations found. Confirmed via live testing (returned Kitchen section,
expanded Pastry "as requested" row) and cross-referenced against Paper's
`get_jsx` — row shape (item name + par caption, no On-hand/Par columns, per
the owner-approved M3-b variant), category group headers, and the
asked-→-approved stepper box all matched exactly.

### Mobile — M4 `17GW-0` (editing a line, bottom sheet)
No deviations found. Verified by code inspection cross-referenced against
Paper's `get_jsx` (live data with an editable line wasn't reachable without
disturbing other test fixtures this session) — the item-name heading, the
"{category} · on hand — · par {par} · head asked {requested}" caption line,
the qty stepper with caramel-100/primary-border treatment, and the
Cancel/Save button row all matched Paper's spec verbatim already.

### Mobile — M5 `17L2-0` (mid-signature/PIN)
No deviations found. Verified live end-to-end (opened the sheet via Approve
& sign, confirmed the humanized requisition-type label now flows through
correctly post-fix, 4-digit PIN input, Cancel/Confirm buttons) — matches
Paper's centered-card treatment (shared `SignSheetDialog`, not a bottom
sheet) exactly.

### Mobile — M6 `17OY-0` (approved/signed) and M8 `17WI-0` (already-approved read-only)
**Deviations found and fixed — same missing-feature class as the desktop
`138B-0` fix:**
- Entire changes-summary block and signature block (script-font name, role/
  timestamp line, "Sent to Central Store" chip) were completely absent from
  the mobile approval screen's read-only view — it just stopped after the
  last section. Ported the same `changeSummaryLines` derivation and added
  `SignedBySignature` (already a shared `components/app/shell/sign-sheet`
  component, previously only imported on desktop) plus the chip, matching
  Paper's layout.
- Subtitle didn't distinguish "signed by you" (M6) from "read-only" (M8,
  different signer) — Paper's copy differs (`"Approved 14:22 · signed by
  you"` vs `"Approved 05:48 · read-only"`); live code always said "signed by
  {name}" regardless. Fixed by comparing `approvedByName` against the
  current user.
- Subtitle was also missing the actual approval time (`Approved ·` with no
  timestamp) — added `formatTime(requisition.approvedAt)`.
Verified live end-to-end: edited a line, signed with PIN, confirmed the
signature block, chip, and changes-summary all render correctly against real
data post-approval.

### Mobile — M7 `17SM-0` (return-section note entry, bottom sheet)
**Deviations found and fixed:**
- Header was error-red text reading "Return {Dept} — note required"; Paper's
  actual copy is plain black/ink "Return this section" as the heading, with
  a **separate explanatory subtitle** ("Sends Kitchen back to Grace W. with
  your note. They'll need to resubmit.") and the recipient-name/required
  badge moved to the field label ("NOTE TO GRACE W. required") — the
  error-red heading in the previous build was simply wrong, not a subtle
  miss.
- Added the `firstNameLastInitial()` helper (same as the desktop return
  panel) and threaded `submittedByName` through from the parent screen
  (previously not passed to `ReturnSectionSheet` at all).
Verified live end-to-end: expanded a manager-filled "as requested" section,
opened the sheet, confirmed heading/subtitle/label copy match Paper exactly,
typed a note, returned the section, confirmed it flips to "returned — {note}"
in the section list — full round trip through the real backend.

### Mobile — M9 `17ZN-0` (error)
**Deviation found and fixed.** This is the **list-screen's** error state
(Paper's artboard title is "Requisitions (today)", not the detail screen) —
previously reused the generic shared `ErrorState` component (small dot icon,
"Retry" button, generic description), which doesn't match Paper's bespoke
mobile layout at all: a circular error-tinted badge with a "!" icon,
`pt-24`-anchored placement (not vertically centered), specific copy
("Couldn't load requisitions" / "Check your connection and try again.
Nothing has been changed."), and a full-width bordered "Try again" button
(not "Retry"). Built the bespoke layout matching Paper exactly. Verified
live via a Playwright route abort (`route.abort('failed')` on the
needs-approval endpoint) — screenshot confirms exact match.

### Mobile — M10 `180H-0` (loading)
**Deviation found and fixed.** The skeleton (`RequisitionsForApprovalListSkeletonMobile`)
rendered uniform solid rectangles for both the KPI strip and list rows;
Paper's skeleton shows a two-line hierarchy per KPI card (a wide label-width
bar over a narrower number-width bar) and per list row (a wide title-width
bar over a narrower subtitle-width bar) — meant to mirror the real content's
shape, not just block out space. Rebuilt both regions with the two-line
pattern. Verified live via a Playwright route delay (artificial 3s latency
on the needs-approval endpoint) — screenshot confirms the two-line hierarchy
now matches Paper. (Note: Paper's `180H-0` artboard also shows a back-arrow
chevron in the header that M1/M2/M9 don't have; treated this as Paper mock
inconsistency rather than a real M10-specific design intent, since a root
list screen has nothing to navigate back to and every sibling artboard on
this same screen agrees there's no arrow — flagging here rather than
silently resolving it, per this file's own instruction to say so explicitly
when a Paper artboard's own internal consistency is in question.)

### Not independently verified this session (documented, not silently skipped)
- **The true already-approved *race* condition** (two managers opening/
  signing concurrently) — verified the read-only rendering and copy by
  opening an already-approved requisition directly (same effect on screen),
  but did not reproduce the actual concurrent-approve 409 from two
  simultaneous sessions. The `isAlreadyApprovedRace` code path exists and is
  visually correct; the exact trigger condition is a functional/concurrency
  test, not a visual one.
- **M8's "different signer" subtitle variant** — logically implemented and
  reads correctly by inspection, but both live approvals this session were
  signed by the same manager test account, so the `approvedByName !==
  user?.name` branch was exercised in the desktop `13F1-0` case only,
  not independently confirmed on the mobile M8 layout with a second real
  manager identity.
- **A returned section's "Fill it myself" action returns a 409** ("This
  section has already been submitted") from the real backend when attempted
  live — found while setting up test fixtures for the return-panel work.
  This looks like a functional bug (a RETURNED section should presumably be
  fillable, that's the whole point of returning it), not a visual one, so
  left alone and flagged here for the next functional/bug-fix session rather
  than fixed under this visual-fidelity mandate.

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

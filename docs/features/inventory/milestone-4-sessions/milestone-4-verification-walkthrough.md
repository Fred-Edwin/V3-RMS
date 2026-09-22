# Milestone Four — Manual Verification Walkthrough

**Purpose:** walk every screen in Milestone Four (Requisition & Branch
Approval) yourself, on localhost, and confirm the visual-fidelity pass
actually holds up against the approved Paper designs. This is the owner's
own pass, separate from and after the two agent sessions (build + visual
fidelity) that already ran.

**How to use this doc:** for each screen, open the listed Paper node
alongside the listed localhost URL/action, and check off each item. Where a
screen has a **known gap** (already found, documented, and deliberately not
fixed), it's called out so you don't re-report it as new. Where something
was **not independently verified** by the agent sessions, it's flagged so
you know to look closer there.

Paper file: `01M1ZZJ6S3FZGF5C7PPBGTKY89`, page `p-E-0`
(`https://app.paper.design/file/01M1ZZJ6S3FZGF5C7PPBGTKY89/p-E-0/<node-id>`)

---

## Before you start

**Accounts:**
- Branch Manager: `manager1.kingongo@dev.test` / `password123`, PIN `1234`
- Kitchen dept head (same branch): `chef1.kingongo@dev.test` / `password123`

**Current DB state (as of 2026-09-22):**
| Requisition | Status | Type | Use for |
|---|---|---|---|
| `12c1a177-29a0-427e-a27c-d40a11818545` | APPROVED | AD_HOC | already-approved / read-only states |
| `ab539aab-3be6-4c1c-914e-43b68fb42d39` | APPROVED | MORNING | already-approved / read-only states |
| `2c423e23-90d3-429b-8879-e9e6fcc8d119` | PENDING_APPROVAL | AD_HOC | **needs-approval flow — use this one** |

If you burn through the one `PENDING_APPROVAL` requisition (e.g. by
approving it while testing), log in as `chef1.kingongo@dev.test` and open a
new requisition to get a fresh needs-approval state.

**Desktop viewport:** resize your browser window to exactly **1440×900**
before comparing desktop screens — a wider window changes flex proportions
and will make correct layouts look wrong.

**Mobile viewport:** use your browser devtools' device toolbar at exactly
**390×844** (iPhone 12/13 size) for mobile screens — don't just shrink the
window, use real device-width emulation.

**Compare in this order, every screen:** structure → copy (word-for-word) →
lane/column alignment (trace a vertical line down repeated rows) →
weight/size hierarchy → colour → separators (dashed vs solid) → vertical
rhythm. Ignore data differences — Paper's mock data won't match your real
data (e.g. names, quantities). You're checking layout and treatment, not
numbers.

---

## Desktop screens

### 1. Needs-approval — Paper `12HK-0`
**URL:** `/app/branch/requisitions?id=2c423e23-90d3-429b-8879-e9e6fcc8d119`

- [ ] Requisition title reads "Ad-hoc requisition" (humanized), not raw `AD_HOC`
- [ ] Department names in each section block are title case ("Kitchen"), not raw enum (`KITCHEN`)
- [ ] On-hand column ≈70px wide, Par column ≈60px — header labels aren't crammed together
- [ ] Approved-qty edit pills, category labels, sidebar rail widths look proportioned like Paper (not narrower/misaligned)
- [ ] Trace a vertical line down the "Approved" column across all rows — do the boxes line up?
- [ ] Open the PIN/sign dialog — subtitle should read "sign ad-hoc requisition" (humanized), not "sign ad_hoc requisition"

### 2. Empty / nothing selected — Paper `12UW-0`
**URL:** `/app/branch/requisitions` (no `?id=`)

- [ ] You should land directly on "Select a requisition" — **do not** get stuck on a loading skeleton (this was a real bug: `idle` and `loading` states were conflated)
- [ ] A bordered document-icon badge appears above the "Select a requisition" text
- [ ] Heading weight is medium, not bold/semibold

### 3. Mid-signature (PIN dialog) — Paper `131F-0`
**Action:** on the needs-approval screen, click "Approve & sign"

- [ ] Dialog matches Paper's centered-card treatment
- [ ] Subtitle uses the humanized requisition type
- [ ] 4-digit PIN input, Cancel/Confirm buttons present

### 4. Approved (signed by you) — Paper `138B-0`
**Action:** complete the PIN sign on requisition `2c423e23...` (PIN `1234`)

- [ ] A "Changes from what was requested" summary box appears (bordered, light-grey background) — **this was entirely missing before the fix**, confirm it's really there now
- [ ] It lists each edited department with line-level diffs, e.g. "Kitchen — Beef Patty 120g 40 → 24 pcs"
- [ ] Subtitle includes "Department heads have been notified of the N changes." (only appears because you are the signer)
- [ ] Signature block renders (name, role/timestamp, "Sent to Central Store" chip)

### 5. Already-approved (race / viewed by non-signer) — Paper `13F1-0`
**URL:** `/app/branch/requisitions?id=12c1a177-29a0-427e-a27c-d40a11818545` or `ab539aab-...`

- [ ] Info banner explains this was already approved
- [ ] The "notified of N changes" clause should be **absent** here (only shows for the actual signer — different from screen 4)
- [ ] ⚠️ **Not independently verified by the agent session**: the true concurrent-approval race (two managers signing at once, triggering a 409) was not reproduced live — only the resulting read-only render was checked. If you want to test the real race, you'd need two browser sessions signing the same requisition near-simultaneously.

### 6. Permission-denied — Paper `13LQ-0`
**Action:** log in as `chef1.kingongo@dev.test` and try to visit `/app/branch/requisitions`

- [ ] **Known gap, not a new bug:** you will be **hard-redirected** to `/app/dashboard` — Paper's in-app "Not available for your role" screen with a "Go to my section" CTA is never shown. This is a middleware architecture decision (`middleware.ts`'s `isAllowedPath()`), left alone deliberately by the visual-fidelity pass. Confirm the redirect happens cleanly (no flash of broken content) — if it does, this is working as currently decided, not broken. Flag for a future session if you want the soft-denial screen built instead.

### 7. Loading — Paper `13PB-0`
**Action:** hard-refresh `/app/branch/requisitions?id=2c423e23-...` and watch closely (it's fast on localhost)

- [ ] KPI strip and list rail show shimmer/skeleton blocks, not zeroed real content, during the brief load
- [ ] You may need to throttle network in devtools to actually see this — it was "too fast on localhost" for the agent to screenshot normally, so eyeballing may require throttling

### 8. Error — Paper `13TI-0`
**Action:** in devtools, block/fail the requisitions list network request (Network tab → block request URL, or offline mode), then reload `/app/branch/requisitions`

- [ ] "Couldn't load requisitions" heading + "Check your connection and try again. Nothing has been changed." copy appears
- [ ] This is distinct from the per-ID 404 error (a specific `?id=` that doesn't exist) — that one was already correct before this pass

### 9. History — Paper `13X2-0`
**URL:** `/app/branch/requisitions/history` (or the "History →" link from the list)

- [ ] Column widths for Date/Signed by/Units/Status look proportioned, not cramped
- [ ] Requisition type in each row is humanized ("Morning requisition"), not raw enum
- [ ] ⚠️ **Known gaps, not fixed (backend/API work needed):**
  - Paper's table has a **6th "Lines" column** — the live table only has 5 columns (no `totalLines` field exists yet)
  - Paper's date-range picker next to the status tabs is **missing** — no `DateRangePicker` UI primitive exists yet
  - Don't report these as new findings — they're already logged for a future functional session

### 10. Return-section note entry — Paper `1415-0`
**Action:** on a needs-approval requisition, find an "as requested" section and click "Return this section"

- [ ] **This was the biggest fix of the pass** — confirm it's a proper inline panel now, NOT a browser `window.prompt()` popup
- [ ] Panel is error-tinted, header reads "Return to {Name} — note required"
- [ ] Bordered textarea with placeholder copy, Cancel + solid-red "Return section" buttons
- [ ] Type a note and confirm — section should flip to "returned — {your note}" and Fill it myself/Nudge head/Send without buttons reappear
- [ ] Check the recipient name renders correctly (e.g. "Grace W.") — a name-truncation bug was fixed here too (dev-seed names with parenthetical branch suffixes like "Dev Chef 1 (King'ong'o)" used to truncate oddly)

---

## Mobile screens (390×844 viewport)

### M1 — Requisitions list — Paper `1797-0`
**URL:** `/app/branch/requisitions` on mobile viewport

- [ ] Each row's status dot color and copy matches its actual status (not always the same warning-colored "Awaiting approval" regardless of real state)
- [ ] Approved rows show a success-green dot; awaiting rows show the opened time ("Awaiting approval · opened 06:12")
- [ ] ⚠️ **Known smaller gap, not fixed:** Paper also shows a distinct red-dot "1 section returned" variant and an "Earlier today" date grouping — the current list row data doesn't carry what's needed for these yet. Don't re-report.

### M2 — List, empty — Paper `17B6-0`
**Action:** hardest to reach with real data (needs zero requisitions today) — may need to check via devtools network mocking, or just review by eye if you can't easily force this state

- [ ] KPI strip is still visible (was previously entirely dropped in the empty state)
- [ ] "Depts not submitted" KPI shows `—` not `0`
- [ ] Icon + copy: "Once a department head opens or submits a section, it will show up here for your approval."

### M3 — Needs-approval review — Paper `17D7-0`
**Action:** open requisition `2c423e23-...` on mobile viewport

- [ ] Row shape is item name + category caption on line 2, NO On-hand/Par columns (this is the approved M3-b variant — confirmed correct already, just re-check it hasn't regressed)
- [ ] Asked → approved shown as a tappable stepper box on the right

### M4 — Edit line, bottom sheet — Paper `17GW-0`
**Action:** tap a line to edit its approved quantity

- [ ] Bottom sheet (not popover) — item name heading, caption "{category} · on hand — · par {par} · head asked {requested}"
- [ ] Qty stepper with caramel-accent border treatment
- [ ] Cancel/Save buttons
- [ ] ⚠️ **Not independently verified live** — the agent checked this by code inspection against Paper's JSX, not by actually reaching a live editable line on mobile. Worth being the first live check.

### M5 — Mid-signature (PIN) — Paper `17L2-0`
**Action:** tap "Approve & sign" on mobile

- [ ] Centered card (same `SignSheetDialog` as desktop, not a bottom sheet)
- [ ] Humanized requisition type in the subtitle

### M6 — Approved (signed by you) — Paper `17OY-0`
**Action:** complete a PIN sign on mobile

- [ ] Changes-summary block + signature block appear (previously entirely absent on mobile)
- [ ] "Sent to Central Store" chip renders
- [ ] Subtitle reads "Approved {time} · signed by you"

### M7 — Return-section sheet — Paper `17SM-0`
**Action:** return a section on mobile

- [ ] Heading is plain black "Return this section" — **NOT** error-red "Return {Dept} — note required" (that was the bug)
- [ ] Separate subtitle: "Sends {Dept} back to {Name} with your note. They'll need to resubmit."
- [ ] Field label reads "NOTE TO {NAME} required"

### M8 — Already-approved, read-only — Paper `17WI-0`
**Action:** open an APPROVED requisition (e.g. `12c1a177-...`) on mobile, signed by someone other than you

- [ ] Subtitle reads "Approved {time} · read-only" (not "signed by {name}")
- [ ] ⚠️ **Not independently verified with a genuinely different signer** — both live tests this session used the same manager account, so the "different signer" branch was only confirmed on desktop (`13F1-0`), not mobile specifically. Worth checking directly if you have a second manager account, or trust the shared logic if not.

### M9 — Error — Paper `17ZN-0`
**Action:** block the network request for the mobile requisitions list, then load `/app/branch/requisitions` on mobile

- [ ] Circular error-tinted badge with "!" icon (not the generic small-dot error state)
- [ ] Copy: "Couldn't load requisitions" / "Check your connection and try again. Nothing has been changed."
- [ ] Full-width bordered "Try again" button (not "Retry")

### M10 — Loading — Paper `180H-0`
**Action:** throttle network and reload the mobile list

- [ ] Skeleton shows two-line hierarchy per KPI card and per list row (wide bar over narrow bar), not uniform solid blocks
- [ ] Note: Paper's artboard shows a back-arrow chevron in the header that other mobile list states don't have — this was judged to be a Paper mock inconsistency, not a real requirement. Don't chase adding a chevron here.

---

## Known functional bug (not visual, found during this pass — separate from the checklist above)

**Returning a section, then trying "Fill it myself" on it, returns a 409
error** ("This section has already been submitted") instead of letting you
fill it. A RETURNED section should presumably be fillable — that's the
whole point of returning it. This needs a backend/functional fix, not a
visual one. Worth reproducing and confirming during your walkthrough:

1. Return a section (as in screen 10 or M7 above)
2. Try "Fill it myself" on that now-returned section
3. Confirm you hit the 409

If confirmed, this should go on the list for the next functional session.

---

## After your walkthrough

If you find anything beyond what's flagged here as a known gap, note:
- The screen/Paper node
- What you expected (from Paper) vs. what you saw
- Whether it's a visual miss or a functional bug

Then decide whether it needs its own quick fix session or can wait for the
next milestone's functional work.

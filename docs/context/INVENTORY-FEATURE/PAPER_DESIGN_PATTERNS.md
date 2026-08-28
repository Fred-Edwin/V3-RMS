# Paper Design Patterns — Inventory Feature (Living Reference)

This file captures conventions and hard-won lessons from designing Phase 2's
Flows A, B, and C in Paper.design (file "Wendo RMS"), so a fresh agent
picking up Flow D, E, or any later flow doesn't have to rediscover them or
have them re-explained. Read this **before** opening Paper for a new flow.

This is a companion to `docs/DESIGN_FIRST_WORKFLOW.md` (the general
stage-by-stage procedure) and `INVENTORY_PHASE2_DESIGN_FIRST_PLAN.md` (the
screen list and status per flow). This file is neither of those — it's the
*how*, not the *what* or the *when*.

---

## 1. Canvas organization

- **One labeled band per flow.** A "Label — Flow X" artboard (title +
  one-line subtitle) sits above the flow's screens; "Sublabel — ..."
  artboards sit above each device/journey sub-row within the flow (e.g.
  "Sublabel — Mobile Journey", "Sublabel — Desktop Journey").
- **Artboard naming**: `"Screen Name (Role, Device)"` exactly — e.g. `D1.5
  — Log Market Purchase (Dept Head, Mobile)`. Keep the `D#.#` spec code
  prefix when the screen has one; drop it for screens that never had one
  (e.g. "Request Market Items" has no spec code — that's fine, don't
  invent one).
- **Journey order, left to right.** Screens are placed in the order a user
  actually encounters them, not grouped by role. Mobile and desktop are
  separate sub-rows (mobile above or below desktop, consistently within a
  flow), each with its own sublabel.
- **Vertical spacing between flows**: leave enough Y-room that a flow's
  band can grow (more screens added later) without needing to shove the
  next flow's band further down and re-touch its label positions. Flow C
  needed exactly this kind of reshuffle mid-session — avoid it by spacing
  generously up front.
- **Print/document artboards** get their own row, separate from the
  mobile/desktop UI rows, since they're a different artifact type (a
  generated PDF, not a screen).

---

## 2. Section-level navigation: tab-on-existing-screen vs. new page

**The question to ask before designing a new sub-area:** does this new
capability belong *inside* an existing screen (as a tab or mode switch) or
does it deserve its **own page** with its own sidebar entry?

This came up directly: Market Purchase Orders could have been a standalone
desktop screen (cloning the Store Manager "Requisitions" pattern wholesale,
with its own full sidebar) or a second tab inside the existing Branch Stock
screen. **Both were prototyped side by side** before picking — that's the
right process when it's a live question, not a guess:

1. Build both options as separate artboards (label them `OPTION A — ...`
   / `OPTION B — ...` while comparing).
2. Ask the user to pick with a side-by-side visual, not a text description.
3. Delete the rejected option's artboards once a choice is made — don't
   leave dead options cluttering the canvas.

**What was decided here, as the default going forward:** if the new
capability is another view onto the *same* underlying object the existing
screen already manages (Branch Stock manages branch-level stock movement;
Market Purchase Orders are also branch-level stock movement, just via the
market instead of Central Store), it's a **section tab on the existing
screen** — a small tab pair in the header switches the whole content area.
The sidebar gets an **indented sub-item** nested under the parent screen's
nav entry (matching the existing collapsible "Inventory" group pattern),
active only when that tab is selected. Reach for a wholly separate page
only when the new capability has a meaningfully different audience or
doesn't share the parent screen's core object.

---

## 3. Consolidated vs. per-actor objects

**The mistake made and corrected twice in this session:** designing a
multi-actor flow as if each actor's contribution is its own approvable
object, when in reality multiple actors' input needs to merge into **one**
object before anyone acts on it.

Concretely: Market Purchase Order was first designed as "each department's
market request is reviewed and approved separately" (mirroring Flow A's
Requisition model too literally). The actual operational shape is: every
department's request lands inside **one shared active draft** (grouped by
department inside it, never a separate document per department), and the
Branch Manager approves and sends *the whole draft* in one action. One
delivery run buys everything for every department at once — so the
approvable unit has to be the whole trip, not a department's slice.

**Before building a multi-actor flow, ask explicitly:**
- Does each actor's input need independent approval, or does it need to
  be merged with others' input before anyone acts on it?
- Is there one active "bucket" collecting input until someone closes it
  (a draft model), or does each submission stand alone?
- If input merges, does the UI still need to show *whose* piece is whose
  (department-grouping inside the merged view), or does attribution stop
  mattering once merged?

Getting this wrong costs a full rebuild of the drawer, the table's row
unit, the stat strip, and the document — it's a structural decision, not
a styling one. Ask before designing forward on an assumption here.

---

## 4. Drawer patterns

- **Section/department grouping**: a group header (name, left-aligned,
  small-caps or bold caption size) with the responsible person + item
  count on the right, followed by that group's rows, then a **visible gap
  (margin-top, ~8px) before the next group's header** — don't let groups
  run together with just a border.
- **Editable quantity rows**: item name + caption (requested qty/unit) on
  the left; a **stepper** (minus button / number box / plus button) on the
  right — never a bare number, and never split across two lines. When a
  second field is needed (e.g. price paid), it sits to the right of the
  stepper as its own labeled mini-field (small uppercase label above,
  bordered box below), not inline text.
- **Read-only summary drawers** (post-fulfilment, post-reconciliation):
  Item / Requested / Actual columns (plus Paid where money is involved), a
  **variance banner** at the top when anything doesn't match (name the
  specific item and the shortfall in the banner text, don't just say
  "variance exists"), and the mismatched row itself highlighted (tinted
  background, bold+colored actual-value cell) — never a silent mismatch
  the user has to spot by eye.
- **Footer actions** describe the actual transition, not a generic verb:
  "Approve Order" vs. "Confirm & Complete Order" vs. "Reject" — match the
  footer's verb to the specific stage transition it causes.

---

## 5. Document + Viewer conventions

- **Document anatomy, in order**: Letterhead (logo, business name/branch,
  document title + code, status stamp(s)) → Metadata row (who/what/when,
  3 columns) → Line items (grouped by department/section when the
  document spans multiple contributors, with the same header+divider
  convention as drawers) → Totals band → Parties/signature block → Footer
  (doc ID + generation timestamp, one line of disclaimer text).
- **Stamps represent finalization events, one per signer.** Dispatch Note
  legitimately has two stamps (dispatched by Store Manager, received by
  Dept Head — two different actors at two different times). Don't copy
  the two-stamp pattern onto a document that only has one finalization
  event — Market Purchase Order's reconciliation-and-signoff is a single
  event by a single actor, so it gets **one** stamp ("RECONCILED"), not two.
- **Parties block shows only what the metadata doesn't already say.** If
  the letterhead's metadata row already states "Prepared By: X", the
  parties block at the bottom shouldn't repeat "Submitted by X" — it
  should show only the final signer's block (name, role, timestamp,
  signature line).
- **Design and test documents at realistic scale, not a 5-6 row mock.**
  A real Market Purchase Order spans multiple departments with many items
  each (built and verified at 22 items / 3 departments in this session,
  not the smaller placeholder it started as). This changes real decisions:
  section dividers become necessary, stamps can't be positioned as a fixed
  pixel offset near the top (they'll land over the first two rows instead
  of near the actual sign-off point), and the viewer's document pane must
  scroll.
- **Desktop modal document pane**: `overflow: auto` on the scrollable
  container, not `overflow: clip` — a fixed-height clipping container was
  the default on the cloned pattern and silently cut off any document
  longer than the original mock. Always check this when cloning a Viewer
  for a new document type.
- **Mobile viewer is a native full-screen layout**, laid out for mobile
  width from scratch (own top bar, own stacked metadata, own row shape) —
  never a scaled-down screenshot or shrunk clone of the desktop modal.

---

## 6. Known Paper-tool gotcha: `display:none` clones can lose `flexDirection`

Duplicating a node that is currently `display:none` (or is a descendant of
one) has, more than once in this session, silently dropped an explicit
`flexDirection: column` from the clone — the clone keeps `display:flex`
but reverts to the row default, and content that should stack vertically
renders as a single squashed row (or, inversely, text meant to sit on one
line wraps letter-by-letter because its container collapsed to near-zero
width).

**Always check a cloned drawer/panel's computed styles
(`get_computed_styles`) or take a screenshot immediately after unhiding
it**, before doing any further text/content edits on top of a layout
that might already be broken. Don't assume a clone of a working pattern
is itself working.

---

## 7. Process note: ask before building when the model is ambiguous

The single biggest time-cost in the Flow C session was building forward on
an assumed operational model (who does what, one object or many) and
having to substantially rebuild after the user corrected it — twice. When
a flow involves more than one human actor and it isn't already obvious
from the plan doc exactly who does what and whether their contributions
merge or stay separate, **stop and ask with concrete options** (see the
Option A/B prototyping approach in §2) before writing HTML into Paper.
Getting the plan doc's brief read correctly the first time is cheaper than
any amount of good Paper technique applied to the wrong model.

---

## 8. Badges never have a fill

The real Badge component (see Components — Data Display, "Badge Family") is
**dot + colored text only** — no background pill, no border. It was built
correctly the first time in Flow C, but got reinvented as a filled pill
(colored background, colored text) twice in Flow D (D1.6's stock-card status
pills, the Waste Log's "SELECTED" tag) before being caught and fixed. Check
every new status/state badge against the real component before styling it —
don't assume a pill-with-fill "looks about right."

---

## 9. Use the real component, not a plausible-looking reinvention

Flow D's first pass at D4.1 (All Locations Overview) built a generic
dashboard aesthetic from scratch — boxed StatCards with borders, a
segmented-pill TabBar — that looked reasonable in isolation but didn't match
anything else in the file. The actual, already-established pattern for this
exact situation (a desktop screen with a stat row + tabs) already existed on
Branch Stock's own screen: a flat `bg-gray-100` divider-bar stat strip with
dramatic hero-number scale contrast (56px primary metric, 28px secondary
ones, first label in accent color) and **underline-style tabs that carry a
secondary metric inline** (e.g. "Kitchen · 3 low stock"), not a pill/segmented
control. Primary buttons were also built in black (`gray-900`) instead of the
real primary color (`accent-600`) in two places before being caught.

**Before styling any recurring UI shape (stat strip, tabs, buttons, cards,
badges), search the file for the closest existing screen that already solved
this same problem** (`find_nodes`, or ask the user which screen to match) —
don't design it fresh from general UI instinct, even if the result looks
clean. "Looks plausible" and "matches the system" are different bars, and
this file's whole point is to hold the line on the second one.

---

## 10. `duplicate_nodes` appends to the end, not beside the source

Duplicating a node to create a sibling row (a table row, a card, a document
group) places the clone at the **end of the parent's children list**, not
adjacent to the node it was cloned from. This silently breaks visual order
in flex/column layouts whenever more than one duplicate is made in sequence,
or when duplicating into a container that already has later siblings (e.g.
cloning a "Chicken" line-item group after "Beef" and "Fish" groups already
exist appends the new rows after Fish, not after Chicken).

This bug recurred at least three times in the Flow D session (the Count
Session's row list, the Stock Sheet document's category groups, twice) and
was only caught by screenshotting and noticing items in the wrong section.

**After any `duplicate_nodes` call that creates more than one clone, or
clones into a non-empty container, immediately call `get_node_info` on the
parent to check `childIds` order — don't assume append position matches
visual intent.** Fix with `move_nodes` (`before`/`after` a specific sibling)
before doing any further text/style edits on the duplicates, since it's much
harder to spot the reorder once every row has been individually retextured.

---

## 11. Don't clone across a large width change — build native instead

Cloning a component designed at one width into a container of a meaningfully
different width (here: cloning a 794px A4 print document into a 640px
desktop-viewer modal) does not "just scale" — gaps, font sizes, and column
widths that fit comfortably at the source width can overflow the destination
container, and the overflow is often **not visible in `get_screenshot`**
(see §12) which makes it look fixed when it isn't.

This cost a long, multi-round debugging cycle in Flow D: incremental style
patches on the clone (`gap`, `fontSize`, `width`) kept "not working" because
the screenshots looked identical before and after each fix, and it was only
resolved by deleting the clone entirely and **building the document natively
for the 640px container** (own gap values, own type scale, own column
widths — same visual language, different numbers).

**When a pattern needs to appear at a container width meaningfully different
from its source (roughly >15–20% narrower/wider), don't clone-and-patch —
rebuild it natively for the target width from the start.** Cloning is still
correct and fast when the destination width is close to the source's.

---

## 12. `get_screenshot` can visually misrepresent true layout bounds — verify with coordinates

At least one extended debugging session in Flow D was caused by trusting
`get_screenshot` over real numbers: a document appeared to clip past its
modal's right edge across several consecutive screenshots, surviving
multiple genuine style fixes (narrower columns, smaller fonts, tighter
gaps) that should have visibly changed the clipping if it were real. It
wasn't — `get_node_info`/`get_computed_styles` on every node in the chain
(document → pane → modal → artboard) showed correct widths and right-edges
well within bounds at every level, math that added up cleanly
(`x + width < parent's x + width`, checked at each nesting level).

**When a screenshot appears to show clipping, an overflow, or a layout bug
that a plausible style fix doesn't visibly resolve after one or two
attempts, stop trusting the screenshot and verify the actual box model
with `get_node_info`/`get_computed_styles` instead** — compute real
worldX/width right-edges up the parent chain by hand. If the numbers say it
fits, it fits, regardless of what the screenshot appears to show; don't
keep iterating style patches against a possibly-misleading visual. This
doesn't mean stop screenshotting generally — screenshots remain the right
tool for genuine visual/spacing/hierarchy review (see the mandatory review
checkpoints) — it means when screenshot and coordinate math disagree,
trust the math.

---

## 13. Print artboards belong on their own row from the moment they're created

Flow D's Stock Sheet print document was initially built inline with the
mobile screen row (to keep it near the mobile viewer that generates it)
and had to be moved to its own dedicated row later, during a canvas
cleanup pass. Per §1's own rule, this should have been placed on a
separate print/document row **the moment the artboard was created**, not
patched in afterward — the interim state made the canvas briefly
inconsistent with the file's own convention for no real benefit (proximity
to the generating screen doesn't require same-row placement; the label
band already establishes the connection).

---

*Created 2026-08-23, after Flow C (Market Purchase Order) design. Updated
2026-08-23 after Flow D (Stock Visibility & History) design — added
badge-fill, real-component-matching, duplicate-ordering, clone-width, and
screenshot-verification lessons. Update this file when a later flow's
design surfaces a new reusable pattern or a new gotcha — it's meant to
accumulate, not to be rewritten per flow.*

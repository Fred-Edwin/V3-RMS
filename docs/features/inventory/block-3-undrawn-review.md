# Block 3 (Branch waste): what was built beyond Paper

For the owner. Written 9 Oct 2026 by the integration session (branch `feat/block3-integration`). Paper is direction; where it did not draw a screen, button or state, the sessions built it in the same style rather than leave it out. Each piece below says who sees it and the exact steps to open it, so you can approve it or ask for a change. Logins are the lane test users (password `password123`); on production use the real ones. The gap numbers (G1 to G22) are the sections of `branch-waste-paper-spec.md` §6.

Wherever Paper and this list disagree, Paper wins.

## 1. The entry drawer (G10). Branch Manager, Director, Accountant, Store Manager, System Admin, desktop

- **What:** a right drawer, 480 wide, opened from a row. It lists Entry, Department, Logged by, Reason, Value (only with the money capability), Note, the reversal (who, when, why) and the **Ledger entries** (the log, then the linked reversal, signed as stored). No photo (owner decision, 9 Oct).
- **Open it:** `bm.town@wendo.test` › Branch › Waste, click any row (or Tab to it and press Enter). Escape closes it and focus goes back to the row.
- **Not built:** the link from the ledger rows to the item's stock card. The department ledger screen is the head's own and these roles cannot reach it.

## 2. The note field for "Other, add a note" (G14). Reverse dialog (desktop) and reverse sheet (phone)

- **What:** choosing "Other, add a note" shows a required one-line note; Reverse stays disabled until it has text. The server refuses "Other" without a note (400).
- **Open it:** Branch Manager › Waste › Reverse on a row › "Other, add a note" (arrow keys work on the choices, Tab goes to the note). On the phone: `barista.member1.town@wendo.test` › Waste › Reverse on your own entry logged today.

## 3. Loading, empty, error and permission states (G8, G12)

- **What:** one shared kit: a skeleton that mirrors the screen while loading, "Nothing here yet / No waste logged in this period." when empty, a filtered-empty line, and "That did not work / Could not load waste. Try again." with a Retry button. Copy is in `waste/_shared/lib/branch-waste-copy.ts`.
- **Open it:** phone: `/app/waste?from=2026-01-01&to=2026-01-02` for empty; stop the API and press the date or reload for the error, then start it and press Retry. Desktop: Branch Manager › Waste with a date range that has no entries.

## 4. Reversed-entry sheet on the phone (G9)

- **What:** the grey "Reversed 21:50" chip on a reversed row is a button. It opens a small sheet with who reversed it, when and why.
- **Open it:** any department head or member › Waste › tap a "Reversed …" chip.

## 5. The phone log flow gaps (G1, G2, G3, G5, G6, G19, G20, G22)

- **G1** the Review button is disabled ("Add an item first") until a line is added. **G2** "Review 2 items" (plural) and a "Discard these items?" dialog when you go back with lines. **G3** the Add key waits for a quantity above zero and a reason; "Could not read that number" for a lone ".". **G5** tapping a line edits it; "Remove {item}" appears in the sheet when editing. **G6** "Logging waste" while saving; on failure a note at the top and every line kept; one idempotency key per open form, so a double tap logs once. **G19** the note grows to a cap. **G20** the buttons stick at the foot, content scrolls. **G22** search results are plain rows with the matching letters bold.
- **Open it:** `barista.member1.town@wendo.test` › Menu › Waste › Log more waste.
- **Not applicable:** G4 ("Below zero after this"): a head or member never sees stock, so the chip would show nothing they may know.

## 6. The department list is the whole department (step 55). Phone, head or member

- **What:** Paper step 55 shows every entry of the department, not only your own; your rows say "you", others "Joseph M."; Reverse shows only on your own entries logged today. Fifty a page with the numbered pager.
- **Open it:** `barista.member1.town@wendo.test` and `barista.head.town@wendo.test` both open Waste and see the same list.

## 7. Nav rows (G17)

- **What:** Branch Manager: Branch › Waste. Director: Branches › Waste. Accountant, Store Manager, System Admin: Branches › Waste. A department head and a member: Waste in the phone menu (member only gets Waste when they are a member). All come from `nav-table.ts` and the server's capabilities.
- **Open it:** sign in as each role and look at the sidebar or the menu.

## 8. Desktop table and filter choices (G11, G15, G16, G21)

- **What:** Status options read "Active" and "Reversed"; the Branch picker (W8) is a select that keeps its choice in the URL (`?branch=`); under about 1100 px the table scrolls sideways in its own box and the figures wrap 2 by 2 below 1024; the subtitle follows the date range ("1 to 9 October").
- **Department filter on W8 (owner ruling, this session):** each department name is listed once, and choosing "Kitchen" shows the Kitchen of every branch (`?departmentName=Kitchen`). Choosing a branch first still lists that branch's departments.
- **Open it:** `director@wendo.test` › Branches › Waste.

## 9. Hover, press and focus states (G7, this session)

- **What:** every Branch waste control now reacts to the pointer: the phone Reverse button, the grey Reversed chip, Edit, Remove, the reason choices, search-result rows and added-item rows go a shade darker on hover (only on a real mouse; never on a touch screen) and shrink a hair on press (97 to 99 percent, off under reduced motion). The desktop Reverse link and the shared chips use the same rule. Keyboard focus rings were already on every control.
- **Open it:** on a laptop, hover over the controls named above; on a phone nothing sticks after a tap.

## 10. Wording the server phrases

- The fourth figure's caption ("Each by its own department", "2 by their own department · 3 by Faith T.") is written by the server from the data; Paper's sample text was fixed.
- A person's name that has no space in it (test data like "Member1 (…)") shows as typed. Real names show as "Grace W.".

## Known limits

- **Item search is not grouped by category.** The contract carries no category on an item, so the W1 results are one list (G22 asked for category labels).
- **No photo** on any entry (owner decision, 9 Oct).
- **No link from the entry drawer to the ledger** (see §1).
- **Negative stock has no screen of its own yet (owner decision needed).** The rule works: a department member can log more than is on hand (tried: 20 L of Milk with 12 L on hand), the ledger gets a WASTE row of −20 and the department's on-hand reads −8, nothing is blocked. The head and member never see a stock figure (by design). The API tells a caller who may see stock (`wentNegative`), but nobody who may see stock can log, and no rebuilt screen shows a branch department's on-hand (the Central Store Stock screens flag negatives for the Central Store only; the branch screens are Block 4, Branch day). The entry drawer shows the ledger row (−20) but no "below zero" flag. Say where you want the flag (the drawer, the list, Branch day) and whether BW6 should carry the on-hand figure; that is a contract change.
- **Measured against Paper (integration, 9 Oct):** phone W1, W2, W3, W5 and step 55 at 390, desktop W6, W7, W8 at 1440, numeric from Paper's own values. Known differences kept on purpose: the primary button gradient starts at the token `#B0610F` (owner ruling D1, Paper W1 to W5 draw `#7A4217`), rows are 46 high on W6 and W8 (Paper draws 42 on W8), reversed rows use `#635E57` text for contrast (Paper `#8D8982`), and the table header rule is the shared kit's (ink line under the header row, Paper draws it above). The entry drawer is not drawn in Paper; it follows the W7 facts-table rhythm.
- **First-load failure wording:** the panel reads "Could not load waste" as the title and again in the line under it; that is the shared states wording and is left for your call.
- **BW4 for the System Admin** needs a branch; the admin reads every branch through the W8 screen instead.
- **Local development only:** the lane's API must be restarted after pulling back-end changes (the watcher missed a change in this session).

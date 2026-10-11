# Block 6 (Purchasing, Store Attendant phone): what was built beyond Paper

For the owner. Written 11 Oct 2026 by the Block 6 front-end session (branch `feat/block6-contract`). Paper chapter 9 (28A to 28Q) is direction; where it did not draw a screen, button or state, the session built it in the same style rather than leave it out. Each piece says who sees it and how to open it. Wherever Paper and this list disagree, Paper wins. Values and open questions: `block-6-paper-spec.md`; API: `purchasing-attendant-api.md`.

Log in as `store.attendant@wendo.test` (password `password123`) unless a line says otherwise. The screens are one phone-width column at every window width.

## 1. Built beyond Paper

| # | What | Who sees it, how to open it |
|---|---|---|
| 1 | **Review and send, the undrawn cases (Q-06).** A supplier that already has an open order gets a warning on its card ("… already has LPO-0004 open, so this one is not sent. Open it") and is left out; items with no supplier get one warning card and are left out; if one supplier fails the others still send and each card shows "Sent for approval" or the server's words; success goes to My orders with a toast. | Attendant › Restock list › add Tomatoes and Sugar, white › Review list (both suppliers had open orders on the lane). |
| 2 | **Staff picker sheet and "Mark as sent" rules (Q-04).** "A staff member › Search" opens a bottom sheet with a search field and name plus role; "Mark as sent" is disabled until a collector is chosen (or the Store Manager already set one); a refused send shows a red toast with the server's words and the screen is kept in sync. | Attendant › an approved order (LPO-0006 on the lane). |
| 3 | **Share PDF.** Uses the phone's share sheet with the LPO message and the print link; with no share sheet it opens WhatsApp to the supplier's number; with no number it says so. **Print LPO** opens the existing printed LPO in a new tab. | Same order. |
| 4 | **Sent order, not late (Q-11).** Info banner "Delivery expected today" or "Delivery expected Tue 13 Oct"; the call buttons show only when overdue; the GETTING IT card is hidden when nobody was recorded. | Attendant › a sent order. |
| 5 | **Returned order has no per-line flag (owner ruling).** Every line has the stepper (never below 1); the banner carries the Store Manager's note only. A draft order opens the same screen with "draft, not yet sent" and no banner. | Attendant › My orders › Edit and resend. |
| 6 | **Withdraw confirmation (Q-21).** "Withdraw LPO-0005? It will be cancelled." with Keep and Withdraw; no PIN, no reason. | Attendant › an order that is waiting or returned. |
| 7 | **Remind states (Q-20).** After a remind the button reads "Reminded at 12:49" and is disabled; a "too soon" refusal from the server shows the same label from `lastRemindedAt`. | Attendant › a waiting order. |
| 8 | **Home and My orders rows the server can return that Paper never drew (Q-15).** Returned: warning pill "Sent back" and "Edit and resend"; sent and late: "Call supplier" as on 28F (a number-less supplier opens the order, which says so). | Attendant › Home, My orders. |
| 9 | **Supplier page: "Add N low items to my list" (Q-18).** Adds items not already on an open order, toasts, stays on the page, and the bar becomes "Review list (n)". One entry per item even if a supplier lists an item twice. | Attendant › Search › a supplier. |
| 10 | **States.** Loading, empty and error-with-"Try again" on every list screen; the error card stays above whatever was on screen. Empty copy per screen is the 28Q table; Restock levels uses "No restock levels set" (Q-13). | Stop the API and reload a screen for the error. |
| 11 | **Search with nothing typed** shows "Search Purchasing / Type an item, a supplier or an LPO number." | Attendant › Home › the search field. |
| 12 | **Failure toast on writes that can change the screen under the person** (withdraw, mark as sent, send again). A refused write reloads the order; the toast keeps the server's reason. | Withdraw an order the Store Manager just approved: "This order is approved, so you cannot do that." |
| 13 | **Negative stock** shows as 0 on the Restock list and Restock levels (Tomatoes is -4 in the lane data). | Restock list, Restock levels. |

## 2. Defaults used for the spec's open questions

Everything the prompt did not rule on took the spec's default.

| Q | Default used |
|---|---|
| Q-01 header padding | Owner ruling: the shell's real header (`B2Header`), not 8 or 21. Home's bottom padding is the shell's too (not 18). The row gap is the shell's 10. |
| Q-02 drawer rail | Owner ruling: the existing curved connector-rail sub-links (Prep pattern). |
| Q-03 bell | Home only, as drawn. |
| Q-05 restock list | Browser store per signed-in person (`wendo-purchasing-restock-list`), emptied after a fully successful send. After a partly successful send the list stays whole so each card keeps its result; sent suppliers then show as "already has an order open" on a later review. |
| Q-07 rows per page | Fixed 20, no control (Paper wins). |
| Q-08 pager | One pager at the 28G values (white bar, 13 px numbers, gap 6), used on History and Restock levels. |
| Q-09 tracker on 28H | Unlabelled strip, as drawn. |
| Q-12 pronoun | Owner ruling: never infer one. The banner says "We will tell you as soon as it is decided." |
| Q-14 level order | Server order as it comes (the screen does not re-sort; on the lane it came Out, Low, then Fine). |
| Q-16 date sheet | Owner ruling: the last pickable day is today (Nairobi). |
| Q-17 times | "H:mm" in sentences, "HH:mm" in lists and activity. |
| Q-19 "See all orders with …" | History with the search set to the supplier's name. |

## 3. Owner rulings received while building

- **People are written Name.Role** ("Grace Wanjiku.Store Manager"), not "(Store Manager)". One helper in the front end (`withRole` in `components/phone/phone-kit.tsx`) and one in each of the two back-end files that word notifications (`orders-service.ts`, `attendant-logic.ts`); change all three to change the form. The lane's seeded Store Manager is literally named "Grace Wanjiku (Store Manager)"; the helper drops a trailing bracket from a name so it does not print twice.
- The Paper spec file still says "Joseph (Store Manager)" in its examples; the Paper designs themselves were not edited.

## 4. Known limits

- **Restock list prices.** "about KES …" counts only lines with a last price; a line without one is left out of the total, and an item added from Search has no price until the supplier page or list adds it.
- **No drag-to-reorder, no editing of a restock level** (the Store Manager sets levels in Catalog).
- **The date sheet is the shared date picker in a `sheet` mode;** the desktop panel is unchanged.
- **Tracker.** The shared tracker now draws the 16 px check circles everywhere it is used: the phone pages, the Store Manager's approve drawer, the invoice and payment drawers, and Receive. They were checked by eye on the approve drawer and the desktop purchase file; Receive was not opened.
- **Not walked:** Receive (steps 30 and 31) after the tracker change, a carrier as collector (the lane has no carriers) and "Supplier delivers" (the staff and "someone else" collectors were walked), the Store Manager's PIN approval (a seeded approved order was used), Share PDF (needs a device share sheet), WhatsApp and Call links (they open other apps).
- **Role words.** The orders and Attendant API send a person's role already as words; the front end also accepts a role code (`roleText`), in case another list sends one.

## 5. Contract notes for the next session

- `Person.role` on orders and the Attendant API is already a display word, not a code.
- An approved order's `collectedBy.setBy` is shown as "Set by …" until the Attendant changes the choice.
- The notification titles are built on the server and now read Name.Role.

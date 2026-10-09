# Paper design session 5: Block 2 gaps (Dispatch, deliveries, discrepancies)

Paste this whole file as the first message of a new agent session. You are the **Paper designer**. Only one agent edits the Paper file at a time; you are that agent. File "Wendo RMS · Approved designs" (`01M3TP8J54R83RHC9FJ7RAHGKG`). Never show raw node ids. Load the Paper guide first (`get_guide`, topic `paper-mcp-instructions`), call `get_font_family_info` before typographic styling, use the file's design tokens, the approved sidebar standard and the States kit. No phone status bar, ever. Finish every edit with `finish_working_on_nodes`. Docs edits go in the worktree you were started in; Edit and Write only, a one-line `Why:` before each; commit footer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; no push or merge without the owner's word. Follow the completion rule: do the work, do not hand back a list of what you did not do; stop only for an owner decision, missing access, or an unmerged dependency.

**Owner rule:** Paper is the design direction. Draw each undrawn piece in the same style as the approved chapters. Show each batch to the owner for approval before the next. Do not change an approved screen except for the listed fixes, and say exactly what you changed.

## Read first
`docs/features/inventory/dispatch-amendment-1.md` (§2 is your list), `dispatch-flow.md` (design log), `discrepancies.md`, `dispatch-contract.md`, and the two front-end gap reports `docs/sessions/block-2-fe-phone-gaps.md` and `block-2-fe-desktop-gaps.md` (parts B and C are what each build session needs). Page "Inventory · Requisition and dispatch", chapters 5 to 8 and Group R step 7c; page "Inventory · Requisition and dispatch: gap fixes (8 Oct)", G2 and G3; page "Inventory · Final design pass: map".

## Batch 1, the new screens (draw, then wait for approval)
1. **Phone dispatch file, read only** (Store Attendant; opened from the `DSP-` links on D6 and G3): tracker, packed, signed and carried by, Items with Sent (no money), after the count Counted and Gap per line and the finding in words, Documents (print store copy, branch copy), Activity, a Cancelled banner with its reason.
2. **The Attendant's On the way tab** (G3's second tab): one card per requisition with a row per department (On the way, Counted, Waiting for the branch, Gap found), empty state.
3. **The department's delivery file, phone** (opened from G2's rows, D7 "Earlier today", D12): tracker, each line with what was counted, what was sent and the gap, the reason and photos added, the discrepancy `DSC-` with the finding or "still open", who recorded it, and a reversal if there was one.
4. **Leave out** on D4, D5, D5b and D6: the control, the greyed "Left out · ships later" row with "Put back", "Not ready · stays in To pack", the recalculated button text, "4 of 5 departments sent. Pastry is still to pack."
5. **Desktop discrepancy file after a finding and after a reversal** (the recorded finding with who, when, note, stock effect and ledger link, "Reverse this finding", both entries shown, the gap held again), and **a closed dispatch with no gap**.
6. **Delivery note page 2 (D17c)**: compact header, repeated headings, "Page n of m", signature block, received-by line and QR on the last page only.

## Batch 2, the Block 2 states and wording sheet (one reference sheet like D21, not an artboard per state)
Chips and status words for every state (dispatch, delivery, discrepancy, department rows on D1 and D4, G2 and G3 results), empty, loading and error copy per list, the voided delivery note band, the Carriers add and rename dialogs and the "Courier company" kind, the D19 drawer walk-through variants (flag, recount, reason and photos, summary, PIN), the Extra-line wording, the "…" menu with Cancel this dispatch, "No carrier is set up" and the cancel and stale-stock messages. Wording follows the front-end gap reports' proposals; where one conflicts with another, pick one and say so.

## Batch 3, fixes to approved screens (list each one for the owner)
D15 title typo ("2milk"); D18 still shows the old sidebar (Settings under Procurement); the 7c sidebar badge says 1 while the tab says 2; D19 and D20 are drawn over the Branch Manager's file but only the Store Manager cancels (redraw over the Store Manager's dispatch file or state it); D19 arrival wording ("It left at 3:05 pm. Nobody in Pastry has counted it yet."); the Carriers sidebar; the notification map: add rows for the Director informed of every discrepancy and finding, the Accountant told of a write-off with its value, the Store Manager's 24-hour reminder then daily, "Waiting for the branch" to the Branch Manager, and the department told when a dispatch is cancelled.

## Report
List what you drew (by chapter and step name), what the owner must review, and update the Paper screens index for Dispatch. Then tell the owner the front-end sessions may start Stage 2.

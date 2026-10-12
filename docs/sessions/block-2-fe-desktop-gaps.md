# Block 2, desktop front end: Stage 1 gap report (9 Oct 2026)

Branch `feat/dispatch-fe-desktop` (from the Block 1 integration branch). Read: `CLAUDE.md`, `final-pass-session-common.md`, `dispatch-contract.md` (frozen), `dispatch-flow.md`, `discrepancies.md`, `block-1-undrawn-review.md`, Block 1's requisitions README and list screen. Opened in Paper at scale 2: D13, D14, D15, D16, D17, D17b, D18, D19, D20, D21, Group R steps 7 (list), 7c and 13 (the file that follows its dispatches, which D19 and D20 are drawn over), and the notification map. Exact values (`get_computed_styles`, `get_jsx`) are pulled screen by screen in Stage 2, not here. No code written. The contract code (`feat/dispatch-contract`) has no commits of its own yet, so I compared against the contract text.

Nothing below is decided. Every item has a default I will build if you say "defaults".

---

## A. Gaps between Paper and the contract

### A1. Dispatch file fields the contract's P6 does not list (D13, D14, D19, step 13)
- **Paper shows:** "Packed by … 3:01 pm", "Signed by … 3:03 pm", "Counted by Barista Department Head · 3:35 pm", "Counted at the branch" in the tracker, and a delivery that "arrived at 3:31 pm".
- **Contract says:** `Dispatch` has `packedById`, `signedById`, `signedAt`, `carrierId`; `DispatchLine` has `countedQty`, `countReason`. There is no `packedAt`, no `countedById` or `countedAt`, no "confirmed on behalf of" flag, and no `arrivedAt`.
- **Need decided:** add `packedAt` (when the department was marked done), `countedById`, `countedAt`, `onBehalf`, and decide how "arrival" is known. D19 says "It arrived at 3:31 pm" and the 2-hour timer runs "since arrival", but no screen has an "it has arrived" action.
- **Default:** arrival = the final-sign time (the moment it is On the way). D19 reads "It left at 3:05 pm. Nobody in Pastry has counted it yet." (a small Paper wording change, reported). Add the other four fields to P6.

### A2. What "To confirm" means in the list tabs (Group R step 7, contract §4 last paragraph)
- **Paper shows:** five tabs Collecting, To approve, To pack, On the way, To confirm, counts only; no rows for the last three.
- **Contract says:** one function over the new statuses; no definition of the tabs.
- **Need decided:** On the way and To confirm overlap unless one is defined as the narrower one.
- **Default:** To pack = approved and not every department signed. On the way = signed, nobody has yet had to be chased. To confirm = at least one department is Waiting for the branch (2 hours, unconfirmed), which is what the Branch Manager acts on. Closed or counted requisitions with a gap sit under Discrepancies; the rest under History.

### A3. Discrepancies list endpoint (7c) versus what Block 1 already built
- **Paper shows:** tabs Open 2 and Settled 14; search "by number or item"; Branch and Department filters; columns Discrepancy, Branch, Delivery, Gap, Open for; row button Record a finding. The sidebar badge in Paper shows 1 while the tab says 2 (a Paper slip; code shows the real open count).
- **Contract says:** Q1 `GET /discrepancies?tab=&branchId=&search=&from=&to=&…`. No `departmentId`, no tab names, no tab counts. Block 1's list currently calls R1 with `tab=discrepancies`.
- **Need decided:** add `departmentId`; tab values; a `counts: { open, settled }` field.
- **Default:** tabs `open|settled`; `departmentId` added; `counts` added; the screen switches from R1 to Q1 at integration. A discrepancy whose finding was reversed counts as Open (see A6). The date range filter appears on Settled only (§4a convention), nothing in Paper contradicts it.

### A4. Findings after a reversal (D16, contract §2 and Q4)
- **Contract says:** `status` is `OPEN, RECORDED, REVERSED`; Q4 errors with `FINDING_ALREADY_RECORDED`. It does not say whether a reversed discrepancy accepts a new finding.
- **Paper:** D16's reasons include "The item turned up" and "Recorded in error", which only make sense if a new finding can follow.
- **Default:** after a reversal the gap is held as unaccounted again and Record a finding returns; both entries stay in Activity. Needs your word because the back end must allow it.

### A5. Carrier kind (D18)
- **Paper shows:** kinds "Vehicle", "Courier company", "Person".
- **Contract says:** `kind` is PERSON or VEHICLE.
- **Default:** add a third kind COMPANY labelled "Courier company". Needs a contract amendment.

### A6. Carriers list data and access (D18, P10, §3, §11)
- Paper's column "Deliveries this month" (46, 11, 3, 0) is not in P10: add `deliveriesThisMonth`.
- `carriers.read` is held by Director, Accountant and Branch Manager (read only) but no nav row or page is defined for them. The Store Manager's row is "Settings under Procurement"; the existing Settings page is the old Settings screen, not a Carriers page. D18 itself still shows the old Requisitions-active sidebar (design log says so).
- **Default:** a Carriers page at `/app/inventory/settings/carriers`, linked from a Carriers row in the Procurement group right under Settings (capability `carriers.read`); read-only for the three roles (no Add button, no row menu). Breadcrumb "Procurement / Settings / Carriers" as drawn, sidebar corrected to Paper's Settings state.

### A7. Cancel a dispatch: scope, reasons, entry point (D20, P8, D21)
- **Contract:** "only before any department member has signed"; reason is one string. Design log: "blocked once any department member has signed". D20 text: "The Kitchen has not counted this delivery yet. Once it has, a dispatch cannot be cancelled."
- **Need decided:** is the lock per department (that dispatch) or on the whole requisition once any department has counted? D20 reads per department.
- **Default:** per dispatch. The other four dispatches of the requisition are untouched.
- **Reasons:** chips are Packed the wrong lines, Branch asked us to stop, Vehicle did not leave, Other. Default: send "preset — note" as in Block 1's R20 (Other needs a note field, not drawn).
- **Entry point:** D20 is drawn over the Branch Manager's step 13 file (who cannot cancel). The Store Manager's own dispatch file (D13) has only "Print delivery note". **Default:** a "…" menu beside Print on the file with "Cancel this dispatch", shown only to holders of `dispatch.cancel` and only while On the way and uncounted; and the same item in the requisition file's department panel.
- **Cancelled → "Pack again"** (D21 main button): see A12.

### A8. Reverse reasons (D16)
- Chips The item turned up, Recorded in error, Other; contract has a single `reason`. Default: "preset — note", Other needs a note. Same convention as A7.

### A9. Error codes and idempotency the contract does not name
- **Codes missing:** cancel after the branch counted (`DISPATCH_ALREADY_COUNTED`), carrier name taken (`CARRIER_NAME_TAKEN`), carrier already in that state, reverse a finding that is not recorded or already reversed (`FINDING_NOT_REVERSIBLE`), discrepancy not found for this role. Contract lists codes only for P5 and Q4.
- **Idempotency:** the common rules require a key on every signing write; the contract gives one to P5 and V6 only. P8, Q4 and Q5 (all PIN-signed) have none.
- **Default:** I send an `idempotencyKey` on P8, Q4, Q5 and show wording for the codes above; the back end session adds them at integration. Wording for each goes into a Block 2 wording table in the README.

### A10. Requisition file: where the dispatches come from (step 13, D19, D20)
- Step 13's "Items and dispatches" tab shows one row per department (reference, status, lines), the packed by / signed by / carried by strip, lines with Approved and Sent, an "Open the dispatch" button. Block 1 greyed these rows.
- **Contract:** "a requisition's tracker rolls up its dispatches"; no field list on the requisition file response (R4) and no list of department rows.
- **Default:** the requisition file response gains `dispatches: [{ id, reference, departmentId, departmentName, status, derivedState, lineCount, signedAt, carrierName }]` and the tracker facts (n of 5 sent, n counted); the right panel loads P6 for the selected department. This is the screen D19 and D20 sit on, so I need it.

### A11. The Branch Manager's "Confirm for the department" (D19, V2 to V6, §3)
- **Paper draws:** the drawer with the count rows only ("4 of 9 counted", "Check and confirm" disabled, PIN). Nothing for a mismatch flag, the recount, reason chips and photo, or the summary.
- **Contract:** V3 check returns differing lines, the second count is final, V4 reason and photos, V5 summary reveals the sent figure, V6 signs with `onBehalf`.
- **Default (small, part B):** the same drawer walks through the phone steps D9 to D11 in place (flag, recount, reason chips and photos, summary with "counted 22, 24 were sent" revealed only there, then PIN). Wording from the phone chapters.
- **Who owns the blind-count pieces?** The phone lane builds them under `deliveries/`. **Default:** I import the count list, flag, reason sheet and summary from `features/inventory/deliveries` (its `index.ts`) once they exist, and build against the mock until then. Confirm the split in A16.
- **When can the Branch Manager open it?** Contract has no time gate. Default: the button appears only in "Waiting for the branch" (over 2 hours), as D21 describes.

### A12. "Pack again" and packing on a desktop (D21, D1 to D6, flow doc)
- To pack tab rows (A2) and the cancelled file's "Pack again" need somewhere to go. Paper's pack screens are phone only; the flow says the Store Manager "shares the same screens".
- **Default:** the Pack and Pack again buttons open the phone lane's pack route, rendered in the shell at desktop width (a centred column, no new drawing). If you want a drawn desktop packing view, this goes to part C.

### A13. Names or titles on records (D13, D14, D17, §9)
- Paper writes titles in every "packed by / signed by / counted by" slot ("Store Attendant", "Barista Department Head") and signs the note in cursive with the title. Contract §9: titles, not names, "except where a record states who did something (packed by, signed by, counted by)".
- **Default:** follow Block 1's print: "Name · Title" on files and notes, the signature in cursive uses the signer's name, the title shows beneath or beside. If Paper's titles are intended literally, say so.

### A14. Photos (D14 "Photo: None added", V4)
- Contract stores up to 3 photos as documents but gives no read endpoint or URL shape on P6/Q2.
- **Default:** P6 and Q2 return `photos: [{ id, url }]` signed or authenticated URLs through the existing documents route the Purchasing delivery-note photo uses.

### A15. Several gaps in one delivery (D13 Next step card)
- V6 opens one `DSC-` per differing line. D13 writes a card for one line: "Milk 1L is short by 2: record what happened". Paper does not show two or more.
- **Default:** one gap: as drawn. Several: title "3 lines differ: record what happened to each", the card button opens the oldest open one, each differing row in Items carries its own "Record a finding" link and its `DSC-` number, and the list of findings is visible in Activity.

### A16. Two lanes in one sub-module (process)
- The phone lane (`feat/dispatch-fe-phone`) and I both write under `features/inventory/dispatch/` and both need a mock service and the contract mirror.
- **Proposed split:** the contract session owns `dispatch/_shared` (types, fixtures); I write `dispatch/components/desktop`, `discrepancies/` and carriers; the phone lane writes `dispatch/components/phone` and `deliveries/`; mock files are per lane (`dispatch-mock-desktop.ts`, `dispatch-mock-phone.ts`) so we never edit the same file; the orchestrator wires `nav-table.ts`, routes and `features/inventory/index.ts`. Old dispatch files (the old screens, `dispatch-print`, the old hooks) are deleted by whoever replaces their last user at integration. Please confirm.

### A17. Notifications and badges (map page, §7)
- The map draws rows 5, 6 and 14 for this block. The contract also promises: Director informed of every discrepancy and finding, Accountant told of a write-off with its value, 24-hour reminder then daily, "Waiting for the branch" nudge, a badge on the Branch Manager when a dispatch is signed, and (my addition) the department told if a signed dispatch is cancelled. None of these is on the map, and contract §7 says "no Inbox rows" while map row 10 (the Director's count alert) decided an Inbox row.
- For the desktop front end only the badges and on-page lines matter; pushes are back end. **Default:** build badges for Queue (existing `inventory:badges` nudge), Discrepancies (open count) and the Branch Manager's To confirm; no Inbox rows from this block. Map rows for the unlisted moments are for the next Paper session.
- **Sockets:** the contract names none. **Default:** reuse the existing `inventory:badges` nudge to refresh counts and add one `dispatch:changed` / `discrepancy:changed` event pair per record (list and file refetch). Back end to confirm names.

### A18. Delivery note details (D17, D17b, P7)
- The P7 response needs: reference, date, branch and department, requisition ref and cycle, packed by / signed by with times, carrier, lines (store copy: asked and sent), QR target. **Default QR:** the dispatch file link, drawn with the same QR code helper Block 1's print uses.
- Branch copy omits packed-by time and the sent column, as drawn.
- **Multi-page:** the rule is words only. **Default:** I paginate in the browser by fixed row height (the first page carries the full header, later pages the compact header with the column headings repeated, "Page n of m" in the footer, a line never split). The signature block, received-by line and QR sit on the last page; if they do not fit under the last row they go to a new last page. This works in every browser (CSS page counters do not).
- **Voided notes:** a cancelled dispatch's note prints with a "VOID · cancelled {date}" band; not drawn (B).
- **Which copy prints from the desktop:** Print delivery note on the file opens a small menu: Store copy, Branch copy.

### A19. Money for the holders of `requisitions.see_value` (§1.6, §9)
- Paper draws no money anywhere in D13 to D21. **Default:** for holders only (Store Manager, Director, Accountant, System Admin; the Attendant never): a "Cost" column and line value on the Items tab, "Written off at cost KES x" in the D15 summary (only for Lost or damaged, Can't tell and Extra "unexplained"), "Loss value" in the D14 gap table and a Value column in the list. Without the capability the rows and columns do not exist in the DOM.

### A20. Wording gaps
- **Extra findings (accepted as mirror):** Packed more than recorded (store stock down, an error, recorded against the packer), Branch counted wrong (department corrected down, the receiver), Can't tell (taken in, unexplained). I will write the descriptions in D15's voice and list them in the README for your read.
- **Paper typo:** D15's title reads "What happened to the 2milk?" (missing space); built as "the 2 milk".
- **Status chip words for the eight D21 states** and the next-step cards for each (see B1, B2).

---

## B. Small undrawn pieces I will build directly (same style, existing components)

| # | Piece | How |
|---|---|---|
| B1 | Dispatch status chips for every state | D21's eight states in the warning, info and success chips of Block 1: To pack, Packing, On the way, Waiting for the branch, Gap held · needs a finding, Counted (no gap, closes at once), Closed, Cancelled. "Ready to send" is phone only. |
| B2 | Next-step cards for every state | One card, same layout as D13: To pack (Pack), Packing (Continue packing), On the way (nothing to do, or Cancel for the Store Manager), Waiting for the branch (Confirm for the department, Branch Manager only), Gap held (Record a finding), Closed (Print), Cancelled (reason, Pack again). Read-only roles get the text without the button. |
| B3 | Tracker variants | D13's five dots; after Cancel it stops with the reason; for several departments the requisition's own tracker shows "4 of 5 sent", "3 of 5 counted"; with a department left out at the final review: "4 of 5 sent, Pastry is still at the store". |
| B4 | D13 Documents tab | Rows like Block 1's: delivery note store and branch copy (voided ones struck through), count photos, finding record link, each with a link to open or print. |
| B5 | D13 Activity tab | Sentences with `DSP-`, `DSC-` links and times, newest first, built like Block 1's Activity; never a PIN. |
| B6 | D13 Items tab before the count | Sent column filled, Counted and Gap show "—" until the branch counts; Cost column for value holders; "Show the other n lines" as drawn. |
| B7 | The "…" menu on the file | Print delivery note (Store copy, Branch copy), Cancel this dispatch (rules in A7); the existing button stays. |
| B8 | Cancel dialog extras | The Other note field, wrong-PIN message in place (field kept), and a refusal message when the branch counted meanwhile. |
| B9 | D14 after a finding, and after a reversal | Status chip "Recorded · {finding}" or "Reversed", the Next step card replaced by a Finding block (what, who recorded by title and name, when, note, stock effect, the linked ledger entry link, value for holders) with "Reverse this finding" (Store Manager, System Admin); after a reversal both entries listed and Record a finding back. Flagged for an optional redraw (see C1). |
| B10 | Photo viewer | Thumbnails in D14 open a simple dialog with next and previous, focus trapped, Escape closes. |
| B11 | Discrepancies list: Settled tab rows | Discrepancy, Branch, Delivery, Gap, Finding (words), Recorded (date); action Open. Open tab as drawn; Record a finding only for holders of the capability, others see Open. Date range filter on Settled. |
| B12 | Dispatch tabs of the Requisitions list | To pack: requisition, branch, departments packed n of 5, lines, waiting since approval, action Pack or Continue. On the way: requisition, branch, departments counted n of 5, left at, carrier, action Open. To confirm: requisition, branch, departments waiting, waiting since, action Confirm (Branch Manager) or Open. Same toolbar, pager and URL state as Block 1. |
| B13 | Carriers dialogs | Add a carrier: name field, kind chips (Person, Vehicle, Courier company), Add. Rename: name only, kind stays. Retire: confirm dialog with "stays on the deliveries it carried". Restore in a retired row's menu. Duplicate-name message in the field. Row menu items by state. All in the Departments dialogs' style from Block 1. |
| B14 | Empty states | Discrepancies Open "Nothing is waiting for a finding" with a line; Settled "No settled discrepancies yet"; To pack "Nothing to pack"; On the way, To confirm similar; Carriers "No carriers yet. Add the first one." Through the States kit. |
| B15 | Loading and error | A skeleton that mirrors each screen (file, discrepancy file, lists, carriers), error with Retry; write errors show in place, keeping what was typed. Wording table kept in the sub-module READMEs. |
| B16 | Voided delivery note | A "VOID · cancelled {date}" band across the top of the note; still printable. |
| B17 | Branch Manager read-only views | The file and discrepancy file without write buttons; the list without the Branch filter (own branch only). |
| B18 | D19 drawer states | The phone steps in place (A11), progress "4 of 9 counted", a clear "Confirmed on behalf of Pastry" success toast. |
| B19 | The "Waiting for the branch" line | On the requisition file panel and on the list row, derived from the 2-hour constant. |

---

## C. New screens that need a Paper drawing first

Nothing here blocks the drawn screens. I build A and B first and wait for your word on these.

| # | Screen | Must show | Role | How a user gets there |
|---|---|---|---|---|
| C1 | Discrepancy file, after a finding (and after a reversal) | The recorded finding with who, when, note, stock effect and ledger link; the closed tracker; "Reverse this finding"; and a reversed state with both entries and the gap held again. D16 was drawn over the open file for lack of this (the design log says to redraw if wanted). | Store Manager, System Admin write; every desktop role reads; Branch Manager (own branch) reads | Discrepancies › Settled tab › a row; or the finding link in a dispatch file. I will build it from B9 meanwhile and report. |
| C2 | Packing on a desktop (only if you want it) | Pack one department, the packed list, the final review and sign, as D1 to D6 but for a desk | Store Manager, System Admin | To pack tab › Pack. Default is to reuse the phone screens (A12), so this stays undrawn unless you say otherwise. |
| C3 | Delivery note page 2 (D17c, optional) | A long note's second page: compact header, repeated headings, Page n of m, signature block on the last page | print for any role with `dispatch.read` | Print on the dispatch file. The rule is plain and I will build it; a drawing is a courtesy. |
| C4 | A closed dispatch with no gap | The dispatch file when the branch counted everything right and nothing is held (Counted, no discrepancy, Closed at once) | every desktop role | Open any confirmed dispatch. I will build it from B1 to B3 and report; no drawing needed unless you prefer one. |

---

## Questions that need an answer before Stage 2 (one line each, default in brackets)

1. Arrival time: use the final-sign time as the start of the 2-hour clock? [yes] (A1)
2. Can a reversed discrepancy take a new finding? [yes] (A4)
3. Cancel locks per department, not per requisition? [per department] (A7)
4. A third carrier kind "Courier company"? [yes] (A5)
5. Where do Store Manager and Director see Carriers (a row under Settings)? [yes, read only for the three roles] (A6)
6. "To confirm" means a department waiting over 2 hours? [yes] (A2)
7. Names with titles, not titles alone, on every record? [name · title] (A13)
8. Pack and Pack again reuse the phone screens at desktop width? [yes] (A12)
9. The lane split and merge order in A16? [as proposed]
10. Contract additions in A1, A3, A5, A6, A9, A14 as one amendment ("Amendment 1 for this block")? [yes]

Also for the record: the contract session has not merged. When you tell me it has, I `git fetch` and merge `origin/feat/final-pass-block-1`, then build against the contract fixtures and a hand-written mock, wiring the real API at integration.

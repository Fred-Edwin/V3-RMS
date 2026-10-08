# Block 1: Requisitions contract, Amendment 2 (owner approved 8 Oct 2026)

Source: the two Stage 1 gap reports (`docs/sessions/block-1-fe-phone-gaps.md`, `block-1-fe-desktop-gaps.md`, on the front-end branches) and back end A's summary. Applies on top of `requisitions-contract.md` (with Amendment 1). Paper wins. **Standing rule from the owner:** Paper is the design direction; a button, menu item or state whose screen is not drawn is built in the same style and reported, never omitted.

## 1. Wire changes (contract Zod, fixtures, both mirrors, README, contract tests)

| Where | Change |
|---|---|
| R1 query | add `cycle`, `departmentId`, `urgent` (boolean). Tabs stay as the contract lists; the desktop screen draws five and calls `tab=discrepancies` and `tab=closed` for the sub-link pages |
| R1 rows and R9 history rows | add `allInAt`, `urgentAt`, `sentAt`, `closedAt`, `cancelledAt`, `cancelReason`, `urgentNote` (all nullable). "Waiting" runs from `allInAt`; "Unapproved for" from the same start the 1-hour Director alert uses (§7) |
| R7 Home | add `suggestedLineCount`, `openedAt`, `openByCycle` (per cycle: requisition id and status, or none); `earlierToday` rows gain `sentAt` |
| R8 SectionEdit | add `openedAt` |
| R11 start and R15 urgent | optional `urgentNote` (max 200 characters) |
| R8, R12, R13 on behalf | Paper's "Fill it myself": the Branch Manager (`requisitions.approve`) may open, edit and send a section that is Not started or Draft, with their own PIN. Recorded as sent by the Branch Manager for that department; the head is told; audit event. New access rows |
| R18 skip | body `{ departmentIds: string[] }`, one transaction, one audit event per section |
| R20 cancel | `reason` is "preset — note". Presets: Asked for the wrong cycle, Asked twice by mistake, No longer needed, Other (note required) |
| R6 print | add per department "asked by" (role label and name as recorded) and time, started time, the addition approver's signature block and time, "Deliver to", generated time. One QR as today |
| Next step card | back end returns the action key and facts only; `text` is dropped. Front ends write title and body from Paper |
| Tracker | back end returns facts (`at`, `by`, counts); front ends own the labels and second lines from Paper |
| Departments retire (R25) | refused while any section is open: new code `DEPARTMENT_HAS_OPEN_SECTIONS`. Restore stays (R26) and appears in a retired row's menu |

## 2. Error codes added to the contract and both mirrors

`SECTION_NOT_SENT`, `SECTION_ALREADY_SENT`, `NOT_APPROVED`, `SECTION_NOT_OPEN`, `ADDITION_NOT_PENDING`, `BRANCH_CODE_MISSING`, `DEPARTMENT_HAS_OPEN_SECTIONS`. Wording by audience (heads on the phone: "Your list…"; managers on the desktop: "That section…") lives in the wording tables, written by the front-end sessions from their gap-report proposals, which the owner approved. `INVALID_PIN`, "already open for this cycle" and `DEPARTMENT_PACKED` get wording too.

## 3. Behaviour decisions

- **Recall and resend:** the head's quantities replace the manager's changes; the manager reviews again and the "head is told" banner clears.
- **Approved, not yet packed (phone):** banner "Approved, with the store" and the line "The Central Store will pack it."; the tracker shows the Approved row, Block 2 rows greyed without dates.
- **Removed lines:** "changed" means quantity differs or the line was added; removed lines are counted on the device before sending only.
- **Home headlines:** Morning "Nothing asked for yet this morning"; Extra with no Afternoon "Need something extra?"; no evening headline.
- **Cards and rail:** Cancelled, Closed, Collecting (nothing missing) and the rail words "Drafting", "Skipped", "{Department} hasn't started" with Nudge, as the owner approved.
- **Departments you add:** Block 1 only adds, renames, retires and restores them. Tagging items, a head and staff to an added department waits for a Paper design (list for the next Paper session).
- **Branch code correction:** endpoint (System Admin only) in back end B, no screen in Block 1.
- **Desktop Start dialog:** cycle chips, Urgent switch and note; hidden for the System Admin.
- **Left out on purpose:** top-bar search, the Deliveries tab (Block 2).

## 4. Navigation (§12)

Store Manager and Director: a Requisitions row with sub-links Queue, Discrepancies, History (as Paper). Branch Manager: a Departments row under Manage. Director: Departments under Operations › Branch Settings (the desktop session checks whether Branch Settings already exists as a page and reports).

## 5. Back end B scope added by this amendment

R1 filters and new row fields; R7, R8 additions; urgent note; on-behalf rows; R18 list; R6 print fields; retire check; the branch-code endpoint; `inventory:badges` emitted; audit scope; delete the stub `requisitions-routes.ts`, rename `requisitions-rebuild-routes.ts` to `requisitions-routes.ts`, and drop the old import and `apiRouter.use` line in `routes/index.ts`; branch codes in production fixed by name (Nyeri Town NYR, King'ong'o KNG, Wendo Nyahururu NYH) in the migration or a follow-up migration, whichever is still unreleased.

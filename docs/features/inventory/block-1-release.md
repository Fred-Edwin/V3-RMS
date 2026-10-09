# Release plan: Blocks 1 and 2 (Requisitions, then Dispatch, deliveries and discrepancies)

For the owner. Block 1 written 8 Oct 2026; Block 2 added 9 Oct 2026 by the integration session. Branches `feat/req-integration` (Block 1) and `feat/dispatch-integration` (Block 2, built on Block 1). Nothing is pushed or merged yet; this is the plan for when you say go. (The file keeps its old name so older links still work.)

The two blocks ship together or one after the other, in this order only: **Block 1 first, then Block 2.** Block 2's migration needs Block 1's departments and branch codes.

## 1. Order of work

1. **The week of release: re-run the two Block 2 counts on production** (read-only, section 4): `SELECT count(*) FROM dispatches;` and `SELECT count(*) FROM discrepancies;`. When this was written (8 Oct 2026) both were **0**. If either is above 0, stop and tell the session; the Block 2 migration refuses to run if any discrepancy exists (section 2).
2. **Before the day closes:** run the "before" queries (section 4) and keep the output. Take a fresh database backup (DigitalOcean snapshot or `pg_dump`). Nothing changes yet.
3. **Test on a restored copy first.** Restore last night's backup somewhere safe, run `prisma migrate deploy` there, run the "after" queries, and open the app against it. Only go on if every "after" check is clean.
4. **Cut-over late in the evening, after every branch has closed its day** (so no head is in the middle of a requisition or a count, and no dispatch is half packed). One merge per block into `main`, Block 1 first. The deploy pipeline then validates, builds, migrates and restarts by itself (`docs/DEPLOYMENT.md` §7). Never merge a block's front-end and back-end halves at different times: the new screens need the new API and the old screens do not work with it.
5. Watch the Actions run to the end. Then run the "after" queries and the per-role check (section 6), starting with the System Admin and the Branch Manager of Nyeri Town.
6. **Add the carriers** before the first send: Store Manager, Carriers (a name and a kind, vehicle or person). Packing cannot be signed without one.
7. Block 2 reads departments from the `departments` table (by id), not from the old key, so a department added after release should flow through packing and counting. That path was not exercised with a brand-new department during integration, so add one only after the "after" checks are clean and send one test requisition through it first.

## 2. The migration files and what each does

All are in `backend/prisma/schema/migrations/`.

**Block 1 (additive; nothing old is dropped)**

| File | What it does |
|---|---|
| `20261008140000_requisitions_enum_values` | Adds the new status and cycle values: Section `SKIPPED`, Requisition `CANCELLED` and `CLOSED`, cycle `EXTRA`. Its own file because PostgreSQL cannot use a new enum value in the transaction that adds it. |
| `20261008140100_requisitions_departments_expand` | The big one. Adds `departments` (five per branch: Kitchen, Barista, Pastry, Service, Housekeeping), `item_departments`, `requisition_additions`, `requisition_events` (the append-only history), the branch `code`, and the new requisition columns. Back-fills department ids on staff, locations and sections, the item-to-department links, and a `REQ-{code}-{nnnn}` reference for every old requisition in opened order (the `REQ` counter is set to match). Old `EVENING` and `AD_HOC` requisitions become `EXTRA`. |
| `20261008150000_requisitions_urgent_note` | Adds the short note that goes with Urgent. Sets the branch codes **by name**: Nyeri Town **NYR**, King'ong'o **KNG**, Wendo Nyahururu **NYH**, and renames references to match. A branch not named is left alone. |

**Block 2 (this one REPLACES; it is not expand-only)**

| File | What it does |
|---|---|
| `20261009100000_block2_dispatch_replace` | Replaces the old dispatch and discrepancy structures. Dispatch status becomes To pack, Packing, On the way, Confirmed, Closed, Cancelled (an old row converts in place and keeps its id, so every stock-ledger link holds; a signed old dispatch gets a `DSP-<code>-nnnn` number and the `DSP` counter moves past it). Discrepancy status becomes Open, Recorded, Reversed and the old outcome list is dropped. Adds `carriers`, `dispatch_photos`, `dispatch_events`, `discrepancy_events` and a database rule that allows one live dispatch per department per requisition. **It refuses to run (raises an error, changes nothing) if any discrepancy exists, or if a dispatch has no matching department.** Rollback note: `ROLLBACK.md` beside it. |
| `20261009150000_block2_back_end_d_counters` | Additive. Adds `dispatch_lines.check_count` (how many times a line has been through the count check), `dispatches.waiting_notified_at` and `discrepancies.reminder_sent_at` (so the two reminder jobs never tell anyone twice). |

## 3. Things to know before you cut over

- **Branch codes.** Production is Nyeri Town `NYR`, King'ong'o `KNG`, Wendo Nyahururu `NYH`. (Paper still draws KRT for Karatina; the real code is KNG.) A wrong code can be corrected by the System Admin with `PATCH /inventory/requisitions/branches/:branchId/code` (no screen yet). References already issued keep their code.
- **The open Afternoon requisition stays Afternoon.** Checked on production (8 Oct 2026): the only requisition is one `AFTERNOON` row in status `OPEN`. It keeps its cycle and gets a `REQ-` reference. Re-run the `type`/`status` query on the day.
- **Block 2 needs two background jobs, both in the existing worker container.** One tells the Branch Manager once if a dispatch has waited two hours for the branch to count it; one reminds the Store Manager at 24 hours, then daily, about an open discrepancy. Both check every five minutes. Block 1 added the urgent-escalation job (every minute). The worker and API containers must share the same Redis (they already do in `docker-compose.yml`); live updates reach every screen through it.
- **Old links keep working.** Push notifications and bookmarks that point at the old branch deliveries or discrepancies pages now land on the new screens (the old routes are gone and the notification links were rewritten).
- **The old pack page is gone.** The desktop Pack buttons open the new pack screen. Nothing links to the old one.
- **Rollback.**
  - Block 1: prefer rolling the **application** back (deploy the previous image): the old code ignores every new column and table. The database undo is only for a failed migration, before the new code has written anything (`20261008140100_requisitions_departments_expand/ROLLBACK.md`).
  - Block 2: **restore the backup you took in step 2 of section 1 and deploy the previous image.** The old code cannot run on the new columns, so an application-only rollback is not possible once the Block 2 migration has run. The hand-written undo in its `ROLLBACK.md` is long and error-prone; the restore is the safe way.
- **Never** run `prisma migrate dev` on production. The pipeline runs `migrate deploy`.

## 4. Read-only queries (SELECT only, change nothing)

**Before (and again after, to compare):**

```sql
SELECT type, status, count(*) FROM requisitions GROUP BY type, status ORDER BY 1, 2;
SELECT id, name, type, is_hub FROM organizations ORDER BY type, name;
SELECT prefix, last_number FROM reference_counters WHERE prefix IN ('REQ','DSP','DSC','DAY');
SELECT department_tag, count(*) FROM users WHERE department_tag IS NOT NULL GROUP BY department_tag;
SELECT count(*) AS requisitions FROM requisitions;
SELECT count(*) AS sections FROM requisition_sections;
SELECT count(*) AS lines FROM requisition_lines;
-- Block 2: the week of release, and again just before the cut-over (both must be 0)
SELECT count(*) AS dispatches FROM dispatches;
SELECT count(*) AS discrepancies FROM discrepancies;
-- Block 2: what the stock ledger holds for dispatches (must be the same after)
SELECT type, count(*) FROM inventory_transactions WHERE type::text ILIKE '%DISPATCH%' GROUP BY 1;
```

**After the Block 1 migration:**

```sql
-- 1. Branch codes are the three agreed ones (hub has none)
SELECT name, code FROM organizations WHERE type = 'BRANCH' ORDER BY name;
-- 2. Five departments per branch, each keyed
SELECT o.name, count(*) AS departments, count(d.key) AS keyed FROM departments d JOIN organizations o ON o.id = d.organization_id GROUP BY o.name ORDER BY o.name;
-- 3. Nothing is left in the old cycle labels
SELECT type, count(*) FROM requisitions GROUP BY type ORDER BY 1;
-- 4. Every requisition has a reference of the right shape, and no two share one
SELECT count(*) AS bad_refs FROM requisitions r JOIN organizations o ON o.id = r.organization_id WHERE r.reference !~ ('^REQ-' || o.code || '-[0-9]{4}$');
SELECT organization_id, reference, count(*) FROM requisitions GROUP BY 1, 2 HAVING count(*) > 1;
-- 5. Every person, location and section that had a department now has its id (all three must be 0)
SELECT count(*) FROM users WHERE department_tag IS NOT NULL AND department_id IS NULL;
SELECT count(*) FROM locations WHERE department_tag IS NOT NULL AND department_id IS NULL;
SELECT count(*) FROM requisition_sections WHERE department_tag IS NOT NULL AND department_id IS NULL;
-- 6. Item-to-department links exist, and the counts of requisitions, sections and lines match the "before" numbers exactly
SELECT count(*) FROM item_departments;
SELECT count(*) FROM requisitions; SELECT count(*) FROM requisition_sections; SELECT count(*) FROM requisition_lines;
-- 7. The counter is at least the highest number issued, per branch
SELECT c.organization_id, c.last_number, max(substring(r.reference from '[0-9]{4}$')::int) AS highest FROM reference_counters c JOIN requisitions r ON r.organization_id = c.organization_id WHERE c.prefix = 'REQ' GROUP BY 1, 2;
```

Expected: step 1 shows `NYR`, `KNG`, `NYH` (and no blank branch code); step 3 shows no `EVENING` or `AD_HOC`; the three step-5 counts are 0; step 6 counts equal the "before" counts; step 7 `last_number` is not below `highest`.

**After the Block 2 migration:**

```sql
-- 8. Both tables are still empty (production shape), and the ledger rows are untouched
SELECT count(*) FROM dispatches; SELECT count(*) FROM discrepancies;
SELECT type, count(*) FROM inventory_transactions WHERE type::text ILIKE '%DISPATCH%' GROUP BY 1;
-- 9. The new tables exist and are empty
SELECT (SELECT count(*) FROM carriers) AS carriers, (SELECT count(*) FROM dispatch_events) AS dispatch_events, (SELECT count(*) FROM discrepancy_events) AS discrepancy_events, (SELECT count(*) FROM dispatch_photos) AS dispatch_photos;
-- 10. The one-live-dispatch-per-department rule is in place (one row)
SELECT indexname FROM pg_indexes WHERE indexname = 'dispatches_one_live_per_department';
-- 11. The new columns are there (three rows)
SELECT table_name, column_name FROM information_schema.columns WHERE (table_name, column_name) IN (('dispatch_lines','check_count'),('dispatches','waiting_notified_at'),('discrepancies','reminder_sent_at'));
-- 12. The migration history shows both Block 2 files applied
SELECT migration_name, finished_at IS NOT NULL AS done FROM _prisma_migrations WHERE migration_name LIKE '20261009%' ORDER BY 1;
```

Expected: step 8 counts equal the "before" counts (0, 0, and the same ledger numbers); step 9 shows zeros; step 10 returns its one row; step 11 returns three rows; step 12 shows both files with `done = true`.

## 5. What is new in production after release

**Block 1.** Heads: a new Requisitions home on the phone. Branch Manager: Requisitions (Queue, Discrepancies, History), Departments under Manage, Fill it myself, Send without this section, Nudge, change a quantity with a reason, cancel with a reason, urgent. Director and hub roles: one Requisitions row with the same list across branches. A Requisition printout with no money. Sidebar counts and live updates.

**Block 2.**
- **Store Attendant (phone):** Dispatch with To pack, On the way and Done tabs; pack one department at a time with a tick per line and a short reason; a final review that can leave a department out; sign with a PIN, choose the carrier; delivery notes to print.
- **Department head and members (phone):** Deliveries (Waiting, Done) and History in the one shell. Count what arrived **without seeing what was sent**; a gap needs a reason (and a photo where asked); a second count of a flagged line is final; confirm with a PIN. Members count for their own department.
- **Branch Manager:** the same delivery file with money; confirm on behalf of a department; the waiting-two-hours alert.
- **Store Manager:** Carriers, the Dispatch queue on desktop, the dispatch file, Discrepancies (record what happened with a finding, one DSC- number each; several differing lines get one card and one Record a finding link per line); the 24-hour reminder.
- **Director, Accountant, System Admin:** read the same files and the Discrepancies list; money for those who hold the value permission.
- **Blind and money rules.** The branch side never sees the sent figure before the count is signed (the API refuses to send it, not just the screen). The Attendant and department members never see money.

## 6. The owner's production check, by role

Do these in order, with real logins, on a quiet evening requisition (use a test cycle, then cancel it).

**System Admin**
1. Sign in. Open Requisitions: the list loads for every branch, no errors.
2. Confirm the three branch codes in the list references.

**Branch Manager (start with Nyeri Town)**
1. Requisitions opens on the tab holding what waits for you; the tab counts add up.
2. Start a requisition (Extra), mark it urgent with a note. A head is told.
3. Open the file: Nudge a department, then Fill it myself for one (PIN), then Send without this section for the rest.
4. Change one approved quantity with a reason; the head's phone shows the change.
5. Approve and sign (PIN). Add to it as the head (next role), then approve the addition.
6. Start another and Cancel it with a reason. It appears in History as Cancelled.
7. Manage › Departments: rename one and rename it back. Retire is refused while a section is open.
8. Print the requisition: no money on the page.
9. (Block 2) Open the requisition's Dispatch file once the store has sent it: you see money and the sent figure only after the department has counted. Open Deliveries and confirm the 2-hour waiting alert reaches you if a delivery is left uncounted.

**Department head (Kitchen at Nyeri Town)**
1. Requisitions: start the cycle, see the suggested lines, change one, add an item, Review and send with your PIN. A wrong PIN says so.
2. After the manager changes a line, the phone shows what changed, with the reason, without reloading.
3. After approval: "Approved, with the store". Add to this requisition, send with your PIN.
4. History lists your past requisitions with no money.
5. (Block 2) Deliveries › Waiting: open the delivery. No sent figure is shown. Count each line, give a reason for a gap, Review, confirm with your PIN. Confirmed shows the gap and its DSC- number. The delivery moves to Done.

**Department member (for example a barista member)**
1. Deliveries and History are in the menu; the delivery opens, counts and confirms exactly as the head's does, signed as a member.
2. No sent figure and no money anywhere.

**Store Attendant**
1. Dispatch › To pack: pack a department (tick each line, a reason for a short line), Review all, leave one department out with its tick, sign with your PIN, choose a carrier.
2. On the way shows the sent dispatch; Print the delivery notes (one per department; a long one runs onto a second page with "continued").
3. No money and no sent figures from other branches anywhere.

**Store Manager**
1. Carriers: add one (vehicle), retire it, restore it.
2. Dispatch (desktop): the queue, a file, a Pack button that opens the pack screen, Cancel a dispatch (reason and PIN).
3. Discrepancies: open a gap, Record a finding (cause, what was done, PIN). With several differing lines, the card at the top opens the oldest, and each line has its own Record a finding link.

**Director and Accountant**
1. Requisitions, Dispatch files and Discrepancies open read only: no Approve, no Pack, no Record. Money is visible.
2. Director: an urgent requisition that has waited over an hour shows in red; approve with your own PIN.

**Everyone:** the browser console shows no red errors on the list, a file, History, the delivery count screens and the print pages.

**Look closely at these (not measured against Paper before release):** the printed delivery notes (store and branch copy, and a long one on a second page), Carriers (Store Manager), the Discrepancies list and a settled or reopened discrepancy file, and every drawer and dialog by keyboard (Tab stays inside, Escape closes, focus returns to the button). Also try one screen on a tablet width.

## 7. If something is wrong

Stop, do not run anything by hand on production. Block 1: roll the application back to the previous image. Block 2: restore the backup and deploy the previous image. Tell the session what the "after" queries printed.

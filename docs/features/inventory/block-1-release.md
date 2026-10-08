# Block 1 release: Requisitions and the foundations

For the owner. Written 8 Oct 2026 by the integration session. Branch `feat/req-integration` (built on `feat/final-pass-block-1`). Nothing is pushed or merged yet; this is the plan for when you say go.

## 1. Order of work

1. **Before the day closes:** run the "before" queries (section 4) on production and keep the output. Take a fresh database backup (DigitalOcean snapshot or `pg_dump`). Nothing changes yet.
2. **Test on a restored copy first.** Restore last night's backup somewhere safe, run `prisma migrate deploy` there, run the "after" queries, and open the app against it. Only go on if every "after" check is clean.
3. **Cut-over late in the evening, after every branch has closed its day** (so no head is in the middle of a requisition or a count). One merge only: the integration branch into `main`, once. The deploy pipeline then validates, builds, migrates and restarts by itself (`docs/DEPLOYMENT.md` §7). Do not merge the front-end and back-end halves at different times: the new screens need the new API and the old screens do not work with it.
4. Watch the Actions run to the end. Then run the "after" queries and the per-role check (section 6), starting with the System Admin and the Branch Manager of Nyeri Town.
5. **Do not add a department in production** until Block 2 ships. A department you add has no old-code key, so the old dispatch screens cannot see it. Renaming, retiring and restoring the five original departments is safe.

## 2. The migration files and what each does

All three are in `backend/prisma/schema/migrations/`. They only **add**; nothing old is dropped, so the old dispatch and branch-day code keeps working.

| File | What it does |
|---|---|
| `20261008140000_requisitions_enum_values` | Adds the new status and cycle values: Section `SKIPPED`, Requisition `CANCELLED` and `CLOSED`, cycle `EXTRA`. It is its own file because PostgreSQL cannot use a new enum value in the transaction that adds it. |
| `20261008140100_requisitions_departments_expand` | The big one. Adds `departments` (five per branch: Kitchen, Barista, Pastry, Service, Housekeeping), `item_departments`, `requisition_additions`, `requisition_events` (the append-only history), the branch `code`, and the new requisition columns (reference, urgent, cancel, idempotency and so on). Back-fills: department ids on staff, locations and sections; the item-to-department links; every old requisition gets a `REQ-{code}-{nnnn}` reference in opened order, and the `REQ` counter is set to match. Old `EVENING` and `AD_HOC` requisitions become `EXTRA`. |
| `20261008150000_requisitions_urgent_note` | Adds the short note that goes with Urgent. Sets the production branch codes **by name**: Nyeri Town **NYR**, King'ong'o **KNG**, Wendo Nyahururu **NYH**, and renames the references the previous file issued to match (`REQ-NYR-0003` stays, a `REQ-KRT-…` becomes `REQ-KNG-…`). A branch not named is left alone. |

## 3. Things to know before you cut over

- **Branch codes.** Production is Nyeri Town `NYR`, King'ong'o `KNG`, Wendo Nyahururu `NYH`. (Paper still draws KRT for Karatina; the real code is KNG.) A wrong code can be corrected later by the System Admin with `PATCH /inventory/requisitions/branches/:branchId/code` (no screen yet). References already issued keep the code they were issued with.
- **The open Afternoon requisition stays Afternoon.** Checked on production (8 Oct 2026): the only requisition is one `AFTERNOON` row in status `OPEN`. The migration relabels only old `EVENING` and `AD_HOC` rows as `EXTRA`, so this one keeps its cycle and gets a `REQ-` reference. Re-run the `type` and `status` query in section 4 the day of release; if a row of another type has appeared, it follows the relabel rule above.
- **Rollback.** Prefer rolling the **application** back (deploy the previous image): the old code ignores every new column and table. Undoing the database is only for a failed migration and only before the new code has written anything; the exact steps are in `20261008140100_requisitions_departments_expand/ROLLBACK.md`. Two things cannot be undone by SQL and do not need to be: the four new enum values stay (harmless unused), and the old `EVENING`/`AD_HOC` labels come back only from the backup.
- **Never** run `prisma migrate dev` on production. The pipeline runs `migrate deploy`.
- Two small additions in this release beyond Block 1's screens: live updates reach every screen (including the Director's) through a Redis bridge, so the worker and the API containers must share the same Redis (they already do in `docker-compose.yml`); and the urgent-escalation job runs in the existing worker container, once a minute.

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
```

**After the migration:**

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

## 5. What is new in production after release

Heads: a new Requisitions home on the phone. Branch Manager: Requisitions (Queue, Discrepancies, History), Departments under Manage, Fill it myself, Send without this section, Nudge, change a quantity with a reason, cancel with a reason, urgent. Director and hub roles: one Requisitions row with the same list across branches. A Requisition printout with no money. Sidebar counts and live updates.

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
7. Manage › Departments: rename one and rename it back. Retire is refused while a section is open. Do **not** add a department yet.
8. Print the requisition: no money on the page.

**Department head (Kitchen at Nyeri Town)**
1. Requisitions: start the cycle, see the suggested lines, change one, add an item, Review and send with your PIN. A wrong PIN says so.
2. After the manager changes a line, the phone shows what changed, with the reason, without reloading.
3. After approval: "Approved, with the store". Add to this requisition, send with your PIN.
4. History lists your past requisitions with no money.

**Director**
1. Requisitions shows every branch; To approve shows an urgent one that has waited over an hour, in red, with "Open and approve".
2. Approve it with your own PIN; the file says it was signed as the Director.
3. Operations › Branch Settings › Departments is readable with a branch picker and cannot be changed.

**Store Manager and Accountant**
1. Requisitions list and any file open, read only: no Approve, no Cancel, no Nudge. Money is visible.
2. Store Manager: the Queue count is what waits to be packed.

**Store Attendant**
1. Sees no money and no on-hand figures (the page for the Attendant arrives with Block 2; check through the Store Manager's login that the Attendant still has Dispatch).

**Everyone:** the browser console shows no red errors on the list, a file, History and the print page.

## 7. If something is wrong

Stop, do not run anything by hand on production. Roll the application back to the previous image (the old code runs on the new tables). Tell the session what the "after" queries printed. The database undo is in `ROLLBACK.md` and is only for a failed migration before any new requisition was written.

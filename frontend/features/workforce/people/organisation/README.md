# Workforce · People · Organisation (slice 1b front end)

Paper Chapter 3 ("Departments and heads") on the real API in `backend/src/modules/workforce/people/organisation/` (O1 to O15). Status: **built, awaiting owner review** (18 Oct 2026, branch `feat/workforce-1b-frontend`, nothing pushed). Decisions made without the owner: `docs/features/workforce/decisions-1b-frontend.md`.

## Sub-modules

| Folder | What the user does there |
|---|---|
| `overview/` | The Organisation page: four numbers, sites on the left, the chosen site's departments (`/app/workforce/organisation`) |
| `departments/` | One department (`/app/workforce/organisation/<id>`): people, casual pool; add, edit, retire, restore |
| `heads/` | Head card; assign, replace, acting head (with the server's preview), end |
| `positions/` | The Positions tab (`?tab=positions`): list, settings, holders; add, edit, "clocks in" change with impact, retire, restore |
| `_shared/` | Types, services (`org-services.ts`), remote hooks, wording (`org-copy.ts`), tabs, notice, position chips, the Home gap rows (`org-home.ts`) |

Public face: `../index.ts` (`OrganisationScreen`, `DepartmentScreen`, `useOrgOverview`, `gapRows`). Route shells: `app/app/workforce/organisation/{page,[id]/page}.tsx`. Menu: the `wf-organisation` row in `nav-table.ts`; gate in `lib/route-access.ts` (HR, Branch Manager, Director).

## Rules the screens follow

- Wire names say `organization`; requests keep `siteId`.
- Every button comes from the server: `can.edit` and `can.assignHead` on a department, the capability table (`org.write`, `org.write_heads`) elsewhere. No role name is read.
- A refusal (`HEAD_NOT_ELIGIBLE`, `POSITION_HELD`, `DEPARTMENT_HAS_PEOPLE`, `DEPARTMENT_MANAGED_BY_INVENTORY`, `HUB_HAS_NO_HEADS`, `ACKNOWLEDGE_IMPACT`) is shown in the dialog in the server's words.
- The Central Store never has heads: its Head card says so and its rows draw no Assign button.
- "Heads on leave", "Waiting on the head" and the people table's Today column are dashes until Leave, Approvals and Attendance exist.

## Endpoints used

O1 overview, O2 department, O3 add, O4 edit, O5 retire and restore, O6 candidates, O7 preview, O8 assign, O9 end, O10 positions, O11 one position, O12 add position, O13 impact, O14 edit position, O15 retire and restore.

## Parity manifest

| Paper | Screen | State |
|---|---|---|
| Ch 3 step 01 | Organisation, sites and departments | built, checked at 1440 against Paper |
| Ch 3 step 02 | One department | built, checked at 1440 |
| Ch 3 steps 03, 04 | Assign a head, acting head | built, run end to end (preview first) |
| Ch 3 step 05 | Add a department | built, run end to end |
| Ch 3 step 06 | Positions | built, checked at 1440 |
| Ch 3 steps 07 to 09 | Add position, stop tracking time, retire | built; the impact step run in the browser (0 people) |
| Ch 1 | Home: "No head for ..." rows | data wired |

Roles walked in the browser: HR (everything above) and Branch Manager (one site, no Add department, Assign head on gaps). The Accountant (refused) is covered by the route-gate test and the API (403). Director, Store Manager and System Admin were checked through the API against "Who sees what".

## Built beyond Paper

| Item | Why |
|---|---|
| "End head", "End acting head", "Change acting head" and the reason dialog | O9 and the acting case need them; Paper draws Replace and Name only |
| "Show retired departments / positions" | Restore needs a way in |
| Loading, error, "not on your list" and no-access states | States kit |
| A one-line "No heads here" for the Central Store | The hub never has heads |
| A "Review who it affects" step before saving a clocking change | The server needs the count acknowledged |

## Size checks (18 Oct 2026)

Largest files in `people/`: `people-types.ts` 253, `file-model.ts` 227, `dialog-fields.tsx` 201; all organisation files are under 200. Busiest folders: `file/components/tabs` and `file/components/dialogs` 10; `organisation/departments/components` 5. None over 12.

## Tests

Pure files carry the tests: `_shared/lib/org-copy`, `org-home`, `heads/lib/head-copy`, `departments/lib/department-copy` and `department-forms`, `positions/lib/position-copy`; plus the nav table and route-gate tests. The one new interactive kit piece, `PersonRadioList` (real radios), has a markup test (`_shared/components/person-radio-list.test.ts`); behaviour was run in the browser with clicks and scripts, not a separate keyboard-only walk. There is no DOM test library (as in 1a).

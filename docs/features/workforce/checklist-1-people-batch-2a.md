# Checklist: final pass 1, People, batch 2A (the shell)

Branch `feat/workforce-1-people-batch-2a`. Part 1 sets **Built** (code written, type check and changed-file tests green). Part 2 sets **Verified** (a real browser, as that role, at 1440 and 390, beside the Paper frame). Nothing is Verified yet.

| Row | Item | Built | Verified | Note |
|---|---|---|---|---|
| 1 | Home HR | yes | no | Five numbers from `home-kpis`; Needs you rows are one per kind with a count, overdue first. |
| 2 | Home Director | yes | no | Same screen, Director's numbers. |
| 3 | Home Accountant | yes | no | |
| 4 | Home Branch Manager (desktop and phone) | yes | no | Phone seen only in part 2. |
| 5 | Home Store Manager | yes | no | |
| 6 | Home head (desktop and phone) | yes | no | Action cards (clock, team today, this week) from the card registry. |
| 7 | Home staff (desktop and phone) | yes | no | Shows 3 numbers; a 4th and 5th need data that does not exist yet (decisions, D6). |
| 8 | Home System Admin | yes | no | "Password resets", not "Locked out". |
| 9 | Needs you "See all" | yes | no | `/app/workforce/needs-you`, paged, search, Kind chips, overdue filter. |
| 10 | States kit | yes | no | `role-home/components/home-states.tsx`: loading, error, offline, empty, stale. |
| 11 | Landing | yes | no | `lib/role-home.ts`: every human role lands on `/app/workforce`. |
| 12 | Menu, desktop | yes | no | Three levels, sidebar attention marks, Search in the sidebar, personal items under the name. System Admin is Home and Company only. |
| 13 | Menu, phone drawer | yes | no | 310 px drawer, same menu. |
| 14 | Floor-staff and head menus | yes | no | Work row named for the department; head also gets Department. My team and Timesheets stay hidden until their pages exist (2B). |
| 15 | Search | yes | no | `shell/search/`, Ctrl K, people only for roles that may see them. |
| 16 | Naming test | yes | n/a | `nav-naming.test.ts`: retired names, sentence case, no duplicate label under one caption. Green. |
| 17 | Attention marks | yes | no | Amber dot and small number; red-brown only for overdue; closed feature sums, open feature shows on sub-links; "99+". |
| 18 | Refusal screen | yes | no | `/app/not-available`; who the page is for from `GET /workforce/page-for`; reference code. |
| 19 | Device step | yes | no | Remembered in this browser only (decisions, D9). |
| 20 | Welcome back | yes | no | Pause countdown; session-ended bar. |
| 21 | Set your PIN | yes | no | Only a person with no PIN; not 1234, not one digit four times. |
| 22 | Error states | yes | no | Wrong password, offline, session ended, paused (a wait, never a lock). |
| 23 | Deletions | yes | no | Listed in the handoff under Deleted and Kept. Part 2 does the deletion check (nothing imports a deleted file; app builds). |

## Tests that cover part 1
Front end: `components/app/shell/nav-*.test.ts` (237, access gate for `navFor` and `menuFor`, menu shape per role, naming), `features/workforce/signin/lib/signin-rules.test.ts`, home and search tests. Back end: `home.test`, `home-db.test`, `page-for.test`, `auth-service.test` (pause), `workforce-layering.test`.

# Checklist: final pass 1, People, batch 2A (the shell)

Branch `feat/workforce-1-people-batch-2a`. Part 1 sets **Built** (code written, type check and changed-file tests green). Part 2 sets **Verified** (a real browser, as that role, beside the Paper frame). "yes" means seen in a browser on 22 Oct 2026; "partly" says what was not seen. Seen at 1440 means desktop, at 390 means phone.

| Row | Item | Built | Verified | Note |
|---|---|---|---|---|
| 1 | Home HR | yes | yes | Seen at 1440 and 390. Five numbers from `home-kpis`; Needs you rows are one per kind with a count, overdue first. |
| 2 | Home Director | yes | partly | Seen at 1440; not at 390 (Paper draws no Director phone Home). |
| 3 | Home Accountant | yes | partly | Seen at 1440 with the Open payroll button; not at 390. |
| 4 | Home Branch Manager (desktop and phone) | yes | yes | Seen at 1440 and 390 against Paper 1.9. Paper's phone cards (On shift now, Late today) need Attendance, which is off; this Home shows five counts that exist today. |
| 5 | Home Store Manager | yes | partly | Seen at 1440; not at 390. |
| 6 | Home head (desktop and phone) | yes | yes | Seen at 1440 and 390 against Paper 1.10. Number cards differ from Paper's (no clock data); the top bar, greeting and Latest follow it. |
| 7 | Home staff (desktop and phone) | yes | yes | Seen at 1440 and 390 against Paper 1.11. Shows 3 numbers; a 4th and 5th need data that does not exist yet (decisions, D6). |
| 8 | Home System Admin | yes | partly | Seen at 1440; not at 390. "Password resets", not "Locked out". |
| 9 | Needs you "See all" | yes | partly | Seen at 1440 against Paper 1.12 (sizes, filter boxes, pager); not at 390, page 2 and the filters not clicked. |
| 10 | States kit | yes | partly | Loading and "Nothing needs you" seen. Error, offline and stale not provoked in a browser (covered by tests). |
| 11 | Landing | yes | yes | Every role signed in above landed on `/app/workforce`. |
| 12 | Menu, desktop | yes | yes | Three levels, group captions clear of the connector line (fixed 22 Oct), sidebar attention marks, Search in the sidebar, personal items in the My account group (rows 26 and 27), for HR, Director, Accountant, Branch Manager, Store Manager, head, attendant and System Admin. |
| 13 | Menu, phone drawer | yes | yes | 310 px drawer seen for HR and the attendant. |
| 14 | Floor-staff and head menus | yes | partly | Head menu (Kitchen, Department with Overview and Casual pay) seen at 1440; a head on a phone still sees the legacy bottom tabs by design. A waiter's menu not seen. |
| 15 | Search | yes | partly | Opens with Ctrl K, matches and bolds letters, "Nothing matches" for a missing page; seen as a head at 1440. The people results for HR not seen. |
| 16 | Naming test | yes | n/a | `nav-naming.test.ts`: retired names, sentence case, no duplicate label under one caption. Green. |
| 17 | Attention marks | yes | partly | Amber dot and number on closed features, "99+" seen. The red-brown dot for overdue items on a menu row was not seen. |
| 18 | Refusal screen | yes | partly | Seen at 390 as a head opening Payroll (role words, My payslips button, reference). Not seen at 1440. |
| 19 | Device step | yes | yes | Seen at 1440 and 390 beside Paper; remembered in this browser only (D9). |
| 20 | Welcome back | yes | yes | Seen at 1440 and 390 beside Paper. Wrong-password bar and pause countdown were seen earlier in the walk. |
| 21 | Set your PIN | yes | partly | Seen at 1440: refused 1111, saved a valid PIN, landed on Home. Not seen at 390. |
| 22 | Error states | yes | partly | Wrong password, the pause countdown and the refused PIN seen. Offline and "You were signed out" not provoked in a browser (tests only). |
| 23 | Deletions | yes | yes | Nothing in `app/`, `features/`, `components/` or `lib/` imports a deleted file (grep, `tsc`, `pnpm build`); READMEs and one code comment that named deleted files were corrected. |
| 24 | Notifications drawer (desktop) | yes | partly | Added 22 Oct at the owner's request (Paper 13.1). Seen at 1440: area chips, search, clear, opening a row marks it read and closes the drawer, Escape, the caught-up state. Not seen: page 2, rows per page, focus returning to the bell. |
| 25 | Notifications page (phone) | yes | partly | Paper 13.2. Seen at 390 with the same filters and states. Not seen: page 2 and rows per page. |
| 26 | Sidebar sections | yes | yes | 22 Oct. Each caption (Staff, Time, Pay, Setup) starts its own short connector line with only its own links; Paper already draws it so (frame 3I6W-0). Seen as HR at 1440 and in the 390 drawer. |
| 27 | My account group | yes | yes | 22 Oct, Paper 2.8 drawn first. My file, My leave, My payslips, Activity on my record, My notices and Profile in one group after the features; Profile and Sign out stay under the name. Seen as HR at 1440 and 390 and as a head at 1440 (closed). A person whose only personal link is Profile gets no group (System Admin). |
| 28 | Password eye icon | yes | yes | 22 Oct, Paper 3.1 and 4.5 redrawn first. Eye button replaces "Show", crossed out while the password shows; label "Show password" / "Hide password", `aria-pressed`, reached by Tab and used with Space, 40 px hit area. Seen at 1440 and 390. Other password fields (Inventory, Profile, reset password, payslip lock) are other features and still use their own control. |

## Fixes made while walking (22 Oct 2026)
Sidebar group captions cut by the connector line; See all page to Paper 1.12 sizes; sign-in name letter-spacing (inherited a fixed 16 px value); "1 departments" wording; "My team" card label; a mixed Overdue row's button.

## Tests that cover this batch
Front end: `components/app/shell/nav-*.test.ts` (237, access gate for `navFor` and `menuFor`, menu shape per role, naming), `features/workforce/signin/lib/signin-rules.test.ts`, home and search tests, `role-home-services.test.ts`. Back end: `home.test`, `home-db.test`, `page-for.test`, `needs-you-line.test`, `auth-service.test` (pause), `workforce-layering.test`.

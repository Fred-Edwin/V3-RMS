# Handoff: People walkthrough, role by role (live, with the owner watching)

## (a) Where
- Worktree `/home/fred/Projects/V3-RMS-lanes/lane-1`, branch `review/workforce-1-people`, last commit `e2e88038`. Nothing pushed. Ports: front end 3101, API 4101, browser `http://lane1.localhost:3101`.
- Servers are **stopped**. Start: `docker start wendo-lane-1-redis`; in `backend/` run `pnpm dev` and in `frontend/` run `pnpm dev -p 3101`, both in the background with logs in the scratchpad. Prove fresh: `GET /api/v1/workforce/org` without a token must answer 401 (not 404). First page loads compile for 10 to 60 s: wait, do not assume a hang.

## (b) What exists
- Review is written: `final-pass/1-people-findings.md` (15 findings, 2 A) and `1-people-how-it-works.md`. Read the findings file first (not the specs again).
- Lane database holds realistic seed data I added: 17 people (Town, Highway, Central Store, two casuals, some on probation), 26 contracts, 11 probation confirmations, a Director-approved pay change for Joy Chebet Rotich. Old `ZZ ...` test people and sites are also there (ignore; say so if they show).
- Ids: Joy Chebet Rotich `53bbf80c-1bc0-40a5-b091-338652879ba8` (probation overdue, good for decide-probation); Rose Akinyi Ouma `17a73949-3b8b-4299-8ed0-11a23e8ca4bf` (no pay, no contract); Ibrahim Salim Juma `86b5c77d-4bd6-4b09-b6e0-85a62148959e` (casual); BM Town's own file `c2d9f627-7677-4739-84c0-83e3816dfa12`; Grace Wairimu (Highway) `78c8725f-4ab0-4afc-a1d5-e3b2f91cfb00`; Otieno Mwangi W-0014 (Town, active).
- Paper (open the file with the Paper tools; never `get_basic_info`): file `01M3TP8J54R83RHC9FJ7RAHGKG`. Chapter 3 artboard `SX0-0` (viewed). Chapter title nodes: Ch1 `OOM-0`, Ch2 `QWP-0`, Ch4 `Y8A-0`; use `get_node_info` to read `artboardId`, then `get_screenshot` on the artboard.

## (c) The task (agreed with the owner)
Redo the browser walk **one role at a time, with the owner watching**. Before starting, say in a few lines what you will do for that role. Narrate each step in a line or two. At the end of each role STOP and give: (1) what you showed, (2) **your own feedback**: what worked, what looked wrong or confusing, any rule broken, compared with Paper where it helps, as new findings; (3) ask for the owner's feedback and wait for "next". Do not rely on the owner's feedback alone.
Order: 1 HR Manager (`hr@`): Employees list, Add employee wizard all five steps (hire a new person), a full file (Overview, Job and pay, Documents, Activity), dialogs (Change pay, Edit job, Decide probation, Transfer, Send to site, Exit and undo), Organisation (department page, assign, acting head, end head, positions). 2 Director (`director@`): read-only look, then approve a pending pay change HR sends. 3 Branch Manager (`bm.town@`): basics-only hire, pay and IDs locked, assign a head, a Highway person is blocked. 4 Accountant (`accountant@`): pay readable, no hire, Organisation refused. 5 Store Manager (`store.manager@`). 6 Department head (`kitchen.head.town@`): what they get. 7 Staff (`store.attendant@`; also `mary.kimani@`, `tom.cheruiyot@` with temporary password `Wendo#2026pass`): My file at **phone size**, add emergency contact, numbers, photo; show what they cannot add (finding 15). 8 System Admin (`admin@`): what happens on the People pages.
Also cover, where reachable: the People cards on each role's Home, documents (offer letter, contract, appointment, pay change, probation, transfer, certificate) if they open anywhere, keyboard Tab, Enter, Escape and focus, console errors.

## (d) Commands and method
- Passwords `password123`. Login limit is 10 a minute: log in once per role, reuse. After login a "Is this your phone?" step appears: click "Use it just once".
- Use chrome-devtools MCP (`list_pages` first). Fill the login form with `take_snapshot` then `fill` and `click` (scripted value setting did not log in). Use `new_page` with `isolatedContext` for a second role. For phone size use the `emulate` tool (`resize_page` did not go below about 916 px).
- Avoid `includeSnapshot` on big pages; screenshots go to `scratchpad/shots/`. Read data with `evaluate_script` returning `innerText`.
- Seed or fix lane data only through the API as HR (scripts `seed.mjs`, `contracts.mjs`, `writes.mjs` are in the scratchpad `.../fb0bb378-a699-451d-9a78-ba76a6790e12/scratchpad/`). Never write to the main database (the Postgres MCP). Lane psql: `PGPASSWORD` from `backend/.env`, host localhost port 5433, db `wendo_rms_lane1`.
- Append new findings to the findings file as rows 16, 17, ... with severity and a recommendation; fill the "Could not check" list as rows become covered; commit with `git add <explicit path>`.

## (e) Read first (only these)
`final-pass/1-people-findings.md`, `final-pass/1-people-how-it-works.md`, `docs/sessions/final-pass-review-template.md`. Nothing else unless a screen is unclear.

## (f) Gotchas
- Never `pkill -f`; kill by process id. No `sleep` chains: use a short Bash `sleep` of at most a few seconds or run waits in the background.
- zsh: no `grep --include`. Edit files with Edit and Write only.
- The first load of any page is a cold compile; a navigation timeout there is not a bug.
- Do not change code or Paper. Do not push. Never leave an attendance switch on (never switched on so far).

## (g) Rule slips so far
- I seeded lane data with Bash scripts (not the Edit tool), in the lane database only, at the owner's request. Brian Otieno's payout was set to Cash and M-Pesa as a test and restored to Bank.

## (h) Departures
- The review stopped at the 150-call cap before a full role walk; this walkthrough replaces that part. Findings 1 to 15 stand; 15 was added after the owner asked about self-service for ID and bank.

# Block 5: the Attendant's front door and history, amendment 2 to the Stock, Counting and Waste contract (draft for owner approval, 8 Oct 2026)

Adds to `stock-count-waste-contract.md` (which Lane 0's Amendment 1 already extended). Paper: page "Inventory · Counting redesign (Oct 7)", chapter 11, steps **52** Stock & counts home, **53** My counts, **54** My waste, today and earlier (all Store Attendant, phone). Paper wins. Closes gaps G1, G2 and the Attendant half of G5 in `role-coverage.md`.

## Owner question (recommendation first)

**Step 55, Kitchen waste today and earlier (department head or member), moves to Block 3 (Branch waste).** It is the department-waste list, and Block 3 renames and rebuilds exactly that module (`waste/department/` to `waste/branch/`). Building it here would be built twice. Say no and it stays in this block as a third small session.

## What stays unchanged

No new capability. No new table. Every endpoint below sits under `counts.record` or `waste.read` (the Attendant's own entries only, a service rule), is read only, and returns the blind view (no stock figures, no differences, per `stock-count-waste-contract.md` §6). The Store Manager and System Admin hold `counts.record` too, so "My counts" works for them as their own counts.

## New and changed endpoints

| # | Endpoint | Capability | Does |
|---|---|---|---|
| C31 | `GET /counts/home` | `counts.record` | The Attendant's home (step 52): the caller's open count if any (`id`, reference, section name, counted and total lines, so "Resume"), the count of sections and the section counted longest ago ("Samrat Supermarket last counted 3 days ago", a date, no figures), the number of counts the caller has signed (the "12" badge on My counts), the number of waste entries the caller logged today ("3 entries today") |
| C32 | `GET /counts/mine?from=&to=&status=&page=&pageSize=` | `counts.record`, own only | The caller's counts, newest first (step 53): `reference`, section names, item count, signed time, status (Waiting for review, Approved), plus `page` and the total for the header ("12 counts"). Default window last 30 days (a count waiting for review always shows, as C2). Own count detail stays C5 |
| W3 | existing | `waste.read` (own only) | No change in shape. Step 54's "today and earlier" is W3 with `from` and `to` (Lane 0). The screen groups by Nairobi day and shows Reverse only on entries the caller logged earlier the same day (existing `waste.reverse_own` rule); a reversed entry is struck through |

Wire rules, the envelope, idempotency, error codes and `siteId` follow the existing contract. Two new schemas (`countsHome`, `myCountsList`) in the frozen contract files with fixtures in both copies, both front-end mirrors updated, a contract test, and the READMEs.

## Screens and routes

- **52 Stock & counts home** replaces the Attendant's "Pick a section" as the front door of the Stock & counts link. Pick a section moves one level down (the session proposes the route and reports it; the nav row for the Attendant is an `oldHref` to `newHref` change in `nav-table.ts`, and `nav-table.test.ts` must pass). Desktop roles are unchanged.
- **53 My counts** and **54 My waste** are lists: States kit, URL state (date range, status, page), the §4a table convention (search is not drawn on these two phone lists; follow Paper), the shared date range picker from `components/ui2/`.
- Phone column centred at every width (Attendant, Stock/Count/Waste pattern), no status bar, 44px targets, no money, no stock figures.

## Sessions (two, small)

1. **Back end** (one session): the two endpoints, schemas, fixtures, mirrors, contract test, service rules, view builders, tests (including a test that no stock figure or difference appears in any response), README. Branch from the integration branch or main, whichever holds Block 1 at that moment; touches only `counting/` and its `_shared/`.
2. **Front end** (one session, starts after the back end session's contract commit): steps 52 to 54, the nav-table rows, wording and states copy, Paper checks at 390 with `get_computed_styles` plus 768 and 1024 spot checks, accessibility.

## Release

Read-only endpoints and screens: no migration, no cut-over timing needed. The owner checks as the Store Attendant on a phone.

# Foundation session: Company table and the Organization → Site rename

Paste this whole file as the first message of a new agent session. This is the **foundation session**: it changes names across almost every backend file, so it runs **alone** (no other code lane at the same time). The Paper design lane may keep running; it touches no code.

## Read first
- `CLAUDE.md` (all of it, especially Non-Negotiables 3 and 12–14 and the migration workflow), `docs/ROADMAP.md` ("Company and Branch foundation", "How the work runs"), `docs/PARALLEL_WORKFLOW.md` (including "Finish: merge and clean up").
- `docs/inventory/CENTRAL_STORE_SCOPING_DESIGN.md` (the hub rule you must preserve exactly).
- `backend/prisma/schema/access.prisma` (the `Organization` model lives here, `@@map("organizations")`).

## Step 0: isolate yourself
This is a code session, so use a lane: `scripts/lane.sh list` first, and **stop and tell the owner if any other code lane is active**. Then `scripts/lane.sh up 1 chore/company-site-foundation`. Work only in that worktree, on that lane's ports, database and browser (`lane1.localhost:3101`). Do not touch the owner's main folder, untracked files, or processes you did not start. Never touch production.

## Goal
1. **Wendo Coffee Bistro becomes one Company.** Every current site belongs to it.
2. **What the code calls an `Organization` is really a branch or the Central Store.** Rename it in code so the words are true, without changing any data or any API field.

Today nothing represents the company. `organizationId` is in about 3,050 places in 197 backend files; frontend has about 259 mentions in 53 files; raw SQL in 9 files uses the real column names (`organization_id`, `organizations`).

## Decide with the owner first (ask before any change, with your recommendation)
1. **The new name.** Recommendation: model **`Site`**, field **`siteId`**, with a `type` of `BRANCH` or `CENTRAL_STORE`. Reason: CLAUDE.md says the Central Store is never a branch or point of sale, so "Branch" would be untrue for it. The screens keep saying "Branch" where the user sees a branch. Alternative: `Branch`/`branchId`.
2. **What a Company holds now.** Recommendation: only `id`, `name` ("Wendo Coffee Bistro"), `isActive`, timestamps. Company-wide settings move there later, not in this session.
3. **Production safety.** Merging this deploys a migration to production automatically. Ask whether a production database backup exists and ask the owner to take or confirm one **before** you merge.

## The plan: three steps, separate commits, gates after each

### A. Additive migration (nothing breaks)
- New `Company` model (in `schema/access.prisma`), one row "Wendo Coffee Bistro" inserted and every site's `companyId` backfilled in the migration SQL. The migration must be idempotent and safe on a database that already has data.
- New `SiteType` enum (`BRANCH`, `CENTRAL_STORE`); backfill from `isHub`. **Keep `isHub` and its one-Central-Store unique index exactly as they are** this session (making it "one per company" belongs to the later multi-company readiness pass).
- Prove it against data: run the migration on a copy that has the seeded dev data, and count rows before and after.

### B. Rename in code only (no database change)
- Prisma: rename the model and fields in the schema with `@@map("organizations")` and `@map("organization_id")` so **the database tables and columns do not change**. Prove it: `prisma migrate diff` from the migrations to the schema must print **no SQL** for this step. If it prints anything, stop.
- Let the TypeScript compiler find every use (strict mode). Do it in reviewable commits: Access first, then Inventory, then the legacy services, controllers and repositories, then scripts and seeds. Raw SQL keeps working because column names are unchanged; still read each of the 9 raw-SQL files.
- **Keep every name on the wire exactly as it is.** The JSON the API sends, request bodies, query strings, socket events, and the login token's claim stay `organizationId`. Reason: the frontend is deployed separately (Vercel) from the API (DigitalOcean), so a renamed field would break the live app between the two deploys. Where an endpoint returns a Prisma row directly, the new field name would leak out: add a small mapper at the controller or serializer so the old name is sent. The frontend is **not** changed in this session (it is renamed module by module as each is rebuilt).

### C. Check what the compiler cannot see
Search for and handle each of these, and list what you found in the PR:
- **API responses.** Before step B, capture a baseline of JSON responses (the list and detail endpoints for each seeded role: Store Manager, Store Attendant, Accountant, Director, Branch Manager, System Admin, plus waiter and HR), then compare after. Any key that changed is a bug unless the owner approves it.
- **Login token** (`backend/src/utils/jwt.ts`, `auth-service.ts`): keep the claim name `organizationId`; existing tokens and the browser-cached permissions must keep working.
- **Socket.io room names and events**, **Redis cache keys** (menu cache and others), and **BullMQ job payloads**: jobs already queued in production under the old shape must still be handled when the new worker starts. Keep names, or accept both shapes.
- **Dynamic property access** and string field names (`['organizationId']`, `select`/`include` built from strings), Zod schemas, test fixtures, seed scripts (`seed-organizations.ts` and the rest), `.env` files and docs.
- **Non-Negotiable 3** ("every repository query includes `organizationId`") keeps its meaning under the new name; update the wording in `CLAUDE.md`.

## Out of scope
The multi-company readiness pass (global menu, unscoped branch list, one-hub rule per company, company boundary for Director and System Admin, onboarding a company); rebuilding any screen; renaming API or frontend fields; changing production settings.

## Gates (all green before the PR, and again after the final rebase)
- `prisma validate`; `prisma migrate diff` showing no SQL for step B.
- Backend `pnpm build` and `pnpm test` (the baseline was 1,570 passing; no test removed or weakened), frontend `pnpm build`, `pnpm check:imports` in both.
- The response-shape comparison from step C shows no differences.
- Browser smoke on your lane, in an isolated profile, as at least the Store Manager, Branch Manager, Director and a waiter: log in, open the main screens, no console errors, Central Store screens still load.
- A second smoke after a cold start to prove cached tokens and permissions still work.

## Docs to update
`CLAUDE.md` (Non-Negotiable 3 wording, the D-15 paragraph's use of "Organization", the migration step if it changes), `docs/DATA_MODEL.md` and `docs/API_CONTRACT.md` (a note that wire names are unchanged by design), `docs/ROADMAP.md` (mark the Company/Site foundation done and note what is still open for multi-company readiness), the migration notes in the PR.

## Finish
Follow "Finish: merge and clean up" in `docs/PARALLEL_WORKFLOW.md`. **Do not merge until the owner says "merge" and has confirmed the production backup**, because the merge deploys a migration. After the merge, watch the deploy; if it fails, report and stop. Because the Prisma client changes, tell the owner to run `pnpm install` and `pnpm exec prisma generate` in `backend/` and `frontend/`, and refresh the lane template database (`scripts/lane.sh template refresh`). End with the ~5 line plain-English recap.

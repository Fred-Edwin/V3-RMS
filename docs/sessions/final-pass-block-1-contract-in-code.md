# Block 1, session 0: the contract in code (short; everyone else waits for it)

Branch: cut `feat/final-pass-block-1` from `main` (the integration branch for Block 1), then work on `feat/req-contract` from it. Read `docs/sessions/final-pass-session-common.md` and `docs/features/inventory/requisitions-contract.md`. You are the **backend architect** turning the owner-approved contract document into frozen, typed code. You write no service logic.

## Do
1. **Confirm §2 against the real schema and code, first.** Check: the actual table names, how `ReferenceCounter` scopes, how the audit log merges sources, how a user's department and `isDepartmentHead` are stored, whether `Location` and `User` carry `departmentTag`, and the push and Inbox helpers. List every difference from the contract in your summary; if one breaks a rule in the contract, stop and ask.
2. Write `backend/src/modules/inventory/requisitions/_shared/requisitions-contract.ts` and `backend/src/modules/inventory/departments/_shared/departments-contract.ts`: Zod schemas and inferred types for every request and response of R1 to R26 (`requisitions-contract.md` §4), using `_shared/wire.ts` primitives; fixtures (`*.fixtures.json`, one realistic example per endpoint and the error cases) and a contract test that parses every fixture. Money fields are `cap` fields (absent without `requisitions.see_value`).
3. Mirror both by hand into `frontend/features/inventory/requisitions/_shared/types/requisitions-contract.ts` and `.../departments/types/departments-contract.ts`, with the same fixtures and a test, as the Stock, Counting and Waste contract does.
4. Add the capability names to `central-store-access.ts` (§3 rows) with their role mapping and an access test, and the names-only mirror in `frontend/features/inventory/_shared/lib/capabilities.ts`.
5. Add the wording table and states copy as `requisitions/_shared/lib/states-copy.ts` on the front end (from Paper steps 21 and 22).
6. Create the empty folders with placeholder routers and READMEs for `requisitions/` and `departments/` as the contract says (the way the Stock, Counting and Waste contract left placeholder routers), and the route-mount lines in `routes/index.ts` (you may touch this file once; the orchestrator reviews it).

## Do not
Write services, repositories, screens or the migration (back end A does the migration as its first commit). Change a shape without telling the owner.

## Verify
Backend `pnpm build`, `pnpm test`; frontend `pnpm build`; both contract tests parse the identical fixtures.

Bring back the summary in `final-pass-session-common.md`, plus the list of differences from §2 and any shape you were unsure of. **The owner freezes the contract after reading it.** Back end A, back end B and both front-end sessions start only after that.

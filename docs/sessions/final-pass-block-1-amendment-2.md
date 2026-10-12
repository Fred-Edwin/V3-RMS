# Block 1, contract Amendment 2 in code

Branch: `feat/req-amendment-2` from `feat/final-pass-block-1`. Read `docs/sessions/final-pass-session-common.md`, `docs/features/inventory/requisitions-contract.md` and `docs/features/inventory/requisitions-amendment-2.md` (the list you implement; nothing else). You are the **back-end contract engineer**.

## Task
Apply every row of Amendment 2 §1 and §2 to the frozen contract in code, exactly as written:
- `backend/src/modules/inventory/requisitions/_shared/requisitions-contract.ts` (and the departments contract for the retire code), the fixtures JSON and the contract test.
- The front-end mirrors in `frontend/features/inventory/**/_shared` (hand-written, same fixtures).
- The access table `central-store-access.ts`: the new "on behalf" rows (§1), with tests.
- The wording tables and the READMEs of `requisitions/` and `departments/`.
- Add an "Amendment 2" section to `requisitions-contract.md` pointing at the amendment file.

## Keep the build green without doing back end B's work
Where a new field or route cannot be produced yet, return a typed placeholder (null, empty list) with a one-line `// back end B` marker, and list each marker in your summary. Do not implement behaviour (filters, on-behalf edits, R18 list, print fields, retire check, branch-code endpoint, sockets, audit scope); back end B does.

## Do not touch
Front-end screens, `components/ui/`, the migration, anything outside the contract files, mirrors, access table, wording tables, READMEs and the minimum code needed to compile.

## Done when
Backend `pnpm build` and `pnpm test` pass, frontend `pnpm build` and `pnpm test` pass, the contract test checks every new field against the fixtures, and the summary lists: each Amendment 2 row and where it landed, every `// back end B` marker, anything in the amendment that was unclear (stop and ask, do not guess). Do not push.

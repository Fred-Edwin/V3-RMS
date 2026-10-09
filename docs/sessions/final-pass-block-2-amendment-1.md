# Block 2, contract Amendment 1 in code

Same session and branch as the Block 2 contract in code (`feat/dispatch-contract`, commit 52c4352 is your first commit). Read `docs/features/inventory/dispatch-amendment-1.md` (the owner-approved list you implement; nothing else) and your own differences list from the first pass.

## Task
Apply every row of Amendment 1 §1 to the contract in code, exactly as written: the Zod schemas and inferred types in `dispatch/`, `deliveries/` and `discrepancies/` `_shared/`; both fixture copies (byte-identical); the hand-written front-end mirrors; the contract tests; the error codes (all of row 11) in the contract and both mirrors; the permissions payload (`GET /inventory/permissions/me` gains the user's departments and head or member role: schema, fixture, mirror; the endpoint's behaviour is back end C's); the requisition file (R4) `dispatches` field and tracker facts in the requisitions contract and its mirror and fixtures; the access rows if any row changes; the READMEs. Correct `dispatch-flow.md` where Amendment 1 row 13 says the System Admin does not confirm on behalf. Add a "Amendment 1" section to `dispatch-contract.md` pointing at the amendment file.

Where a new field cannot be produced yet, return a typed placeholder with a one-line `// back end C` or `// back end D` marker and list every marker in your summary. Do not implement behaviour. Do not start servers.

## Done when
Backend `pnpm build` and `pnpm test`, frontend `pnpm build` and `pnpm test` pass; both fixture copies are identical and parsed by both sides; the summary lists each Amendment 1 row and where it landed, every marker, and anything unclear (stop and ask, do not guess). Do not push. Follow the completion rule: do the checks yourself; stop only for an owner decision, missing access, or an unmerged dependency.

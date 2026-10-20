# How a Workforce build session runs: two parts with a planned stop

Working document. Delete it when Workforce ships. Every build brief points here. Written 20 Oct 2026 after the first back-end session (6A) ran out of context and needed an unplanned handover. The owner's method: part 1 builds fast, then the agent stops on purpose and hands over to a fresh session for verification.

## Part 1: build (fast, clean, no heavy checks)
- Write the code, one scope item at a time, in small tidy files (the size, folder and layer rules in the brief apply from the first line).
- Check only what you just changed: `pnpm exec tsc --noEmit` after each group of files, and `pnpm exec vitest run <path of the files you changed>` for the tests you wrote for them. Unit tests for new rules are written alongside the code. Print at most the last 20 lines of any test output.
- **Do not** run the full test suite, the three time-zone runs, `pnpm build`, the HTTP proof, the end-to-end check, the migration proof copy or the docs pass in part 1.
- Read each named file once, in pieces if large; never re-read; do not paste long output back into your own context.
- Commit after each scope item with `git add <explicit paths>`.
- Keep the **done checklist** at `docs/features/workforce/checklist-<session>.json`: a JSON array, one object per scope item in the brief's order, shaped `{ "id": 1, "item": "<short name>", "built": false, "verified": false, "note": "" }`. Edit it with the Edit tool and change only the `built`, `verified` and `note` fields: never rewrite, reorder or delete items, and never remove an item to make the list look complete. Part 1 sets `built`; part 2 sets `verified` only after the gate that proves it has run.
- **The stop rule:** when every scope item is built and committed, STOP. Do not start part 2 in the same context, even if there seems to be room. (If the owner asks for an early handover, do the same steps at once.)

## The stop: write the handoff and the starter prompt
1. Write `docs/features/workforce/handoff-<session>.md`, **60 lines or fewer**, in this fixed shape: (a) worktree, branch, last commit hash, ports; (b) what is built, one line per module or scope item; (c) what is not yet done, as a checklist; (d) the exact part-2 commands; (e) at most five files to read first; (f) the known gotchas below; (g) any rule slip so far, said plainly; (h) departures from the spec so far.
2. Commit both files.
3. Print **the starter prompt as plain text in a code block** for the owner to copy, then tell the owner: "Part 1 is built and committed. Clear the context now, then paste this prompt." The starter prompt says: read the handoff file and the brief (everything below its divider), skip part 1, do part 2.

## Part 2: verify and finish (fresh context)
1. Run, once each: `pnpm build`, the full backend suite, the three time-zone runs, `pnpm check:imports` (not worse than the baseline), ESLint on the new code, no `requireRole(` in new code.
2. The seven database-flow test files that already failed on the base (attendance, payroll x2, payslips, timesheets and others) are known: re-run only those at the end and confirm the failing count has not grown. Say which test files ran and how many tests passed; **"tests pass" is not a report**.
3. The migration proof on a copy of the lane database (legacy tables identical, a second run changes nothing), the per-role HTTP proof, and the one end-to-end flow checked with the read-only Postgres MCP; then tear down proof data and leave the lane's attendance switch off.
4. Docs: module README, `DATA_MODEL.md`, `API_CONTRACT.md`, the Workforce README status row, `docs/PROJECT_STATUS.md`; edit with the Edit tool (never append with Bash).
5. Update the checklist's `verified` fields; the final report's recap is built from it (any item with `built` or `verified` false must be named and explained).

## Rules that hold in both parts
- **No cheating to go green:** fix the cause. Never delete a test, skip an assertion, loosen a check, or catch-and-ignore an error to pass a gate.
- **Two attempts, then stop:** if the same failure survives two fix attempts, stop, record it, and report it instead of looping.
- Edit and Write tools only (no `Why:` line needed; the owner dropped that rule on 20 Oct 2026); no subagents; say any rule slip plainly in the final message.

## Known gotchas (do not rediscover)
- `prisma migrate dev --create-only` adds a bogus "drop payroll_payslip_seq" block at the top of every new migration: delete it by hand (the migration must be additive).
- Database tests run only on a `_lane` database: `export DATABASE_URL=$(grep '^DATABASE_URL=' backend/.env | cut -d= -f2-)` before `pnpm exec vitest run ...` (lane 1 `wendo_rms_lane1`, API 4101; lane 2 `..._lane2`, 4102; lane 3 `..._lane3`, 4103).
- The lane database may lack `hr@wendo.test`: create an inactive-able test user in the proof script and tear it down; say so. The audit log is append-only, so test users stay as inactive rows.
- zsh: never `grep --include=*.ts`; use `grep -rn pattern dir | grep -v test`.
- The read-only Postgres MCP points at the owner's main database. Never write there.
- Never overwrite a PIN backup in a lane database; never leave a lane site's attendance switch on.

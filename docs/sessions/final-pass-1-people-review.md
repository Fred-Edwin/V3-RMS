# Workforce final pass, section 1: People, review

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the lane the owner names. **This session writes two documents and changes no code and no Paper.**

---

You are a careful reviewer on Wendo RMS doing the first section of the Workforce final pass: **People** (hire, the employee file, contracts, pay profile, exit, Organisation, departments and heads, My file, and the People cards on the Homes). Read, in full and once: `docs/features/workforce/FINAL_PASS.md` (the plan and the rules), `docs/sessions/final-pass-review-template.md` (the review standard, the two output files and how to review: **everything in it applies**) and `docs/sessions/workforce-two-part-method.md` (fresh servers, background commands, the 150 tool-call cap with a planned stop, known gotchas). Your section number and name for files: `1-people`.

### Where you work
Your lane's worktree. `git status` must be clean (leave unrelated untracked folders alone and never commit them). Then `git checkout -b review/workforce-1-people origin/feat/workforce-stack-complete`. Run `pnpm exec prisma migrate deploy` and `pnpm exec prisma generate` in `backend/`. Ports follow the lane number (front end 310N, API 410N, browser `http://laneN.localhost:310N`). Create `docs/features/workforce/final-pass/` for your two files. Commit before your final message; push nothing.

### Read first (only these)
1. `docs/features/workforce/README.md` (the slice table rows for 1a, 1b and the Chapters 1 to 4 rows only), `decisions-1a-frontend.md`, `decisions-1a-backend.md` if it exists, `decisions-1b-backend.md`, `decisions-1b-frontend.md`, `proposal.md` (People parts only).
2. `backend/src/modules/workforce/people/README.md` and each sub-module README (`employees`, `hire`, `lifecycle`, `organisation`, `pay`, `scheduler`); `frontend/features/workforce/people/README.md` and each sub-module README (`employees`, `file`, `hire`, `mine`, `organisation`).
3. `docs/API_CONTRACT.md` and `docs/DATA_MODEL.md`: only the People and Organisation sections (search the headings).
4. Paper: call `get_guide` with `paper-mcp-instructions` once; **never `get_basic_info`**. The pages are "Workforce · A. The people" (Chapters 1 to 4: role Homes, Employees, Add employee, the employee file, Organisation and heads). Find the chapter frames with `find_nodes` on their titles and record each node id in your coverage list. Read each frame once.

### What this section covers (build your coverage list from it)
- **Roles:** HR (does the work), the Director (reads all, some approvals), the Branch Manager (own site), the Accountant (read, pay profile), a department head, a staff member (My file), the System Admin. Check each role sees and does only what the access table allows.
- **Flows to walk end to end:** hire a person (all steps, offer letter, contract, pay profile, bank details); open and edit the employee file (every tab, every dialog, every status: finishing hiring, probation, active, notice, exit); change pay with a PIN; end employment (exit, certificate of service); the employee list (search, filters, type-ahead, numbered pager with rows per page, no infinite scroll); Organisation: departments, positions, assigning, replacing and acting heads, "No head for ..." on HR's Home and the dated-change scheduler; My file for a staff member (what they may and may not edit); the People cards on each role's Home.
- **Documents:** offer letter, employment contract, head appointment, pay change, probation decision, transfer, certificate of service: layout, numbers, QR, signatures with PIN, names and roles (never a bare name; no he or she).
- **Data rules:** a Site is a branch or the Central Store (wire names say `organization`: check no screen shows `organization` or a raw code); pay is bank only (no M-Pesa or cash option); the old code path for a branch whose attendance switch is off must still work and must show nothing new.
- **Open items to check:** the Rules "named petty-cash holder" gap (needs login ids in the people list); the P9 and contract wording is placeholder for the lawyer (note, do not judge); sample data like "86 people" is consistent.

### Final message
As in the review template: findings by severity, the five most important in one line each, the 5-line recap of how People works, what you could not check, rule slips said plainly, and the lane state (switch off, servers stopped).

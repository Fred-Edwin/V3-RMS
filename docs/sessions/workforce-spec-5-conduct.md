# Workforce segment 5: Conduct, spec session

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the lane 2 worktree. **This session writes a spec file. It writes no application code.**

---

You are a senior product designer and tech lead on Wendo RMS. The owner approved the Paper designs for **Chapter 11 · Conduct** (13 steps, sample case Mark Njoroge) on 19 Oct 2026 (file `01M3TP8J54R83RHC9FJ7RAHGKG`, page "Workforce · C. Leave and conduct"). Your job is the spec for **segment 5: Conduct**. The owner's workflow works: front ends built from a spec have needed no design corrections, so write to that standard. The owner is not a developer: explain in plain words in your final message.

### The owner's standing rule: Paper is a demonstration, production is the goal
For every screen your spec has **what Paper shows** (exactly) and **what production adds** (loading, empty, error, locked and no-permission states; a wrong or expired PIN or signing code; two people acting at once; a large list; a failed download; no signal on the phone; keyboard and screen-reader use; narrow widths; very small phones; anything else real use needs). Where a business choice is involved, **choose your recommendation, put it in the spec and log it** in `docs/features/workforce/specs/decisions-5-spec.md` (*question, choice, why, what changing it takes*). Stop and ask the owner only if truly blocked.

### Production questions you MUST settle in the spec (not in Paper)
1. **Coexistence with the old system:** the schema has `DisciplinaryRecord` (`backend/prisma/schema/workforce.prisma`) and the old code may still be live. Say what the old code does today, who is handled by which system during rollout (follow the per-site rollout the attendance switch and the payroll guard use), what happens to existing records, and the minimal additive guard the old code needs (legacy tables stay untouched). Flag your decision prominently in your final message.
2. **The fixed letters:** conduct letters are fixed in the system (owner decision); the Branch Manager adds only one line of their own. Specify the levels (verbal note, written warning, final written warning, and what the Rules Conduct tab already holds: it is built, read `specs/1b-rules-spec.md` Conduct tab), the letter text per level as editable-by-developer constants with the lawyer's wording to be replaced later (flag it; do not state employment law as fact), the facts attached, and how a letter is frozen into a notice document.
3. **Signing and not signing:** the staff member signs receipt with their own code (Paper step 3); signing is receipt, not agreement; "I do not agree · appeal to HR". What if they refuse or are absent (step 9, record that the notice was not signed, by whom, with witness or not: recommend), what if a code is wrong (follow `design-pass-4-shared-parts.md`: every try logged, nobody locked out, System Admin told after 3).
4. **Appeals:** HR decides only appeals (steps 10 and 11): outcomes (upheld, reduced to a lower level, withdrawn), the time limit from the Rules tab, what the staff member's Conduct page then shows (step 4: replaced warning keeps a download), who is told, and what happens to the notice document (version, not edited).
5. **Expiry and escalation:** how long each level stays active (Rules: for example 6 to 9 months, confirm in the built tab), what "active" means on the list and the employee file (step 12), how a warning counts toward the next level, and the **hearing after a final written warning**, which has no screen in Paper: recommend whether the system records it (a simple record) or leaves it outside the system, and log it.
6. **Document:** the notice WRN-nnnn (step 8): numbering, frozen snapshot, signatures, receipt signature, QR (the verify page is segment 6: say what the QR carries), A4 rules from `specs/1a-timesheets-spec.md`.
7. **Who sees what:** staff see only their own notices; the Branch Manager the own site; a department head sees nothing (approves nothing); HR and the Director all sites read; the employee file link. Notifications (never the reason text on a lock screen), audit events, and the menu badge for appeals waiting.

### Read first (only these)
1. `docs/features/workforce/design-pass-1-leave-conduct.md` (Chapter 11 parts and the Chapter 13 Conduct tab parts), `design-pass-4-shared-parts.md` ("Decided by the owner" and "More decisions"), `ROADMAP.md`, `specs/1b-rules-spec.md` (Conduct tab), `specs/decisions-1b-spec.md`, `specs/3-payslips-spec.md` (the code screen section only: reuse it), and the Document/PDF section of `specs/1a-timesheets-spec.md`.
2. The back-end doors only: `backend/src/modules/workforce/_shared/README.md`, `backend/src/modules/workforce/rules/README.md`, `backend/src/modules/workforce/people/README.md` (employee file); then `grep -ril disciplin backend/src frontend/app frontend/features` through Bash and read only the old conduct service, routes and pages.
3. `frontend/features/workforce/_shared/README.md` and `index.ts` (the kit: reuse it and name the component for every part you can, including the circle stepper, Document view parts, PinField and the card registry).
4. **Paper.** Call `get_guide` with `paper-mcp-instructions` once. **Do not call `get_basic_info`** (huge output). Find Chapter 11's artboards on the page "Workforce · C. Leave and conduct" with `find_nodes` on the text "Chapter 11 · Conduct", record each step's node id in a table at the top of your spec, then use `get_screenshot`, `get_jsx` (`includeNodeIds: false`, `format: "inline-styles"`) and `get_computed_styles`. Read each frame once.

Steps in Chapter 11: 1 the Conduct page (phone); 2 Inbox message and the notice before signing; 3 sign with code and appeal; 4 the list after HR decides; 5 Branch Manager Conduct list; 6 person picker; 7 issue a warning; 8 the notice document WRN-0007; 9 record that the notice was not signed; 10 appeal (HR); 11 decide; 12 the employee file; 13 status reference. Note the owner's remark: staff steps 1 and 4 show screens that follow an HR decision, so they sit out of date order.

### What to write: `docs/features/workforce/specs/5-conduct-spec.md`
About 500 lines at most. For **each screen**:
1. Purpose and who sees it.
2. Layout at the design width (desktop 1440: sidebar 236, main 1204; phone 390; documents A4 794).
3. Design values the kit does not carry, from `get_computed_styles`, as `wds-` token names (flag values with no token); for kit parts say "use `<ComponentName>`" and list only the differences.
4. Exact copy, including empty, error, blocked and locked states you write. Roles in messages; name plus role on signed records; never a bare name; no he, she, her or his.
5. Interactions and states: hover, focus, selected, disabled with reasons, loading, empty, error, locked, keyboard path, focus order, screen-reader labels.
6. What production adds (separated).
7. What the server must provide: field-level data and actions so a back-end agent can design endpoints; rules and edge cases; idempotency and concurrency; who may act.
Cross-cutting sections: the **status machine** of a notice (issued, signed, not signed, appealed, upheld, reduced, withdrawn, expired), **documents**, the **permissions table** (404 versus 403), **notifications and audit**, **accessibility**, **what this segment hands to segment 6**, the **migration and rollout plan**, and a **gap list** against what is built (nav row `wf-conduct` is `notBuilt`).

### Rules
Write with the Edit and Write tools only (never sed, awk, heredocs or cp); one line starting `Why:` before **every** Edit or Write; live task list. First action: `git checkout -b docs/workforce-spec-5-conduct feat/workforce-segment-4`. Commit with `git add <explicit paths>` ending with `Co-Authored-By: ` followed by the attribution line your session gives you. Nothing pushed. Do not touch `backend/`, `frontend/` or Paper (record anything wrong in Paper in the spec and the final message). No subagents. Do not re-read a frame. Decide, don't hand back. Another session writes the Leave spec and another the Shared-parts spec at the same time; do not edit their files, and where you depend on them, say what you assume.

### Final message
Decisions table first, then a 5-line plain-English recap, then the coexistence decision in two plain sentences, the production additions (one line each), anything inconsistent in Paper, and the spec path. Do not draft the next session's prompt. Stop for the owner's review.

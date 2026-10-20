# Workforce segment 4: Leave, spec session

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the lane 1 worktree. **This session writes a spec file. It writes no application code.**

---

You are a senior product designer and tech lead on Wendo RMS. The owner approved the Paper designs for **Chapter 10 · Leave** (20 steps) on 19 Oct 2026 (file `01M3TP8J54R83RHC9FJ7RAHGKG`, page "Workforce · C. Leave and conduct"). Your job is the spec for **segment 4: Leave**. The owner's workflow works: front ends built from a spec have needed no design corrections, so write to that standard. The owner is not a developer: explain in plain words in your final message.

### The owner's standing rule: Paper is a demonstration, production is the goal
For every screen your spec has **what Paper shows** (exactly) and **what production adds** (loading, empty, error, locked and no-permission states; a wrong or expired PIN; two people acting at once; a large list; a failed download; no signal on the phone; keyboard and screen-reader use; narrow widths; very small phones; anything else real use needs). Where a business choice is involved, **choose your recommendation, put it in the spec and log it** in `docs/features/workforce/specs/decisions-4-spec.md` (*question, choice, why, what changing it takes*). Stop and ask the owner only if truly blocked.

### Production questions you MUST settle in the spec (not in Paper)
1. **Coexistence with the old system:** the schema already has `LeavePolicy`, `LeaveBalance`, `LeaveRequest` and `LeaveRequestAcknowledgement` (`backend/prisma/schema/workforce.prisma`), and the old leave code and screens may still be live. Say what the old code does today, who is handled by which system during rollout (follow the per-site rollout the attendance switch and the payroll rollout guard use), how a request is never decided twice, what happens to requests and balances already in the old tables, and the minimal additive guard the old code needs (legacy tables stay untouched). Flag your decision prominently in your final message.
2. **Balances:** how a year's entitlement is built from the Rules Leave tab (already built, spec `specs/1b-rules-spec.md`, Leave tab only), proration for people who join or leave mid-year, carry-over, how a balance is calculated and frozen when a request is decided, how HR adjusts a balance (Paper step 15: now, add, new; reason and PIN), and the rule that leave counts every calendar day.
3. **Minimum cover and the rota:** the decision screen shows the request with the rota ("Review with the rota"). Specify how cover is computed, what a Branch Manager sees when cover would drop below the minimum, whether it blocks or only warns (recommend), and what an approval writes to the rota, Today board, the Home KPI "On leave" (which shows a dash today) and "Coming up" card.
4. **Who decides:** the Branch Manager decides for the own site; the request moves to HR after 3 days unanswered (Paper step 5); who decides the Branch Manager's own leave (step 13); a request that spans a rule change; two deciders at once; cancelling an approved request by the staff member or by the manager.
5. **Document:** the leave slip LVE-nnnn (Paper step 17 and the Document view, step 6): numbering, frozen snapshot, QR (the verify page belongs to segment 6: say what the QR carries), signatures and PIN.
6. **Notifications** (never balances in a lock-screen text), **audit events** and the **menu badge** for "Leave waiting" that replaces Waiting for you.

### Read first (only these)
1. `docs/features/workforce/design-pass-1-leave-conduct.md` (Chapter 10 parts only), `design-pass-4-shared-parts.md` ("Decided by the owner"), `ROADMAP.md`, `specs/1b-rules-spec.md` (Leave tab and "Who edits what"), `specs/decisions-1b-spec.md`, and the Document/PDF section of `specs/1a-timesheets-spec.md`.
2. The back-end doors only: `backend/src/modules/workforce/_shared/README.md` (access table, audit writer, PIN, documents), `backend/src/modules/workforce/rota/README.md`, `backend/src/modules/workforce/rules/README.md`; then run `grep -ril leave backend/src frontend/app frontend/features` through Bash (no `--include`, zsh rejects it) and read only the old leave service, routes and staff page.
3. `frontend/features/workforce/_shared/README.md` and `index.ts` (the kit: reuse it and name the component for every part you can, including the circle stepper, Document view parts, PinField and the card registry).
4. **Paper.** Call `get_guide` with `paper-mcp-instructions` once. **Do not call `get_basic_info`** (huge output). Find Chapter 10's artboards on the page "Workforce · C. Leave and conduct" with `find_nodes` on the text "Chapter 10 · Leave" (or `get_children` of that page's chapter frame), record each step's node id in a table at the top of your spec, then use `get_screenshot`, `get_jsx` (`includeNodeIds: false`, `format: "inline-styles"`) and `get_computed_styles`. Read each frame once.

Steps in Chapter 10: 1 menu (new Conduct link); 2 Leave home and Request; 3 History and a followed request; 4 approved and declined endings; 5 moved to HR; 6 Document view; 7 Inbox answer; 8 not enough days; 9 Branch Manager inbox; 10 Leave with the rota; 11 approve; 12 decline; 13 own leave on a desktop; 14 Balances (HR); 15 adjust a balance; 16 Calendar; 17 the leave slip LVE-0031; 18 Rules, Leave tab (built in segment 1: read only, note the link); 19 changing Annual leave (built); 20 minimum cover (built).

### What to write: `docs/features/workforce/specs/4-leave-spec.md`
About 600 lines at most (two files if needed). For **each screen** (steps 1 to 17; for 18 to 20 record only how they connect to what is built):
1. Purpose and who sees it.
2. Layout at the design width (desktop 1440: sidebar 236, main 1204; phone 390; documents A4 794).
3. Design values the kit does not carry, from `get_computed_styles`, as `wds-` token names (flag values with no token); for kit parts say "use `<ComponentName>`" and list only the differences.
4. Exact copy, including empty, error, blocked and locked states you write. Roles in messages; name plus role on records; never a bare name; no he, she, her or his.
5. Interactions and states: hover, focus, selected, disabled with reasons, loading, empty, error, locked, keyboard path, focus order, screen-reader labels.
6. What production adds (separated).
7. What the server must provide: field-level data and actions so a back-end agent can design endpoints; rules and edge cases; idempotency and concurrency; who may act.
Cross-cutting sections: the **status machine** of a request, **documents** (the leave slip: page size, fonts, stamps, numbering, frozen snapshot), the **permissions table** (404 versus 403), **notifications and audit**, **accessibility**, **what this segment hands to segment 6** (badge counts, "Needs you" rows, the verify QR), the **migration and rollout plan**, and a **gap list** against what is built (nav rows `wf-leave`, `wf-my-leave`, `wf-staff-my-leave` are `notBuilt`).

### Rules
Write with the Edit and Write tools only (never sed, awk, heredocs or cp); one line starting `Why:` before **every** Edit or Write; live task list. First action: `git checkout -b docs/workforce-spec-4-leave feat/workforce-segment-4`. Commit with `git add <explicit paths>` ending with `Co-Authored-By: ` followed by the attribution line your session gives you. Nothing pushed. Do not touch `backend/`, `frontend/` or Paper (record anything wrong in Paper in the spec and the final message). No subagents. Do not re-read a frame. Decide, don't hand back. Another session writes the Conduct spec and another the Shared-parts spec at the same time; do not edit their files, and where you depend on them, say what you assume.

### Final message
Decisions table first, then a 5-line plain-English recap, then the coexistence decision in two plain sentences, the production additions (one line each), anything inconsistent in Paper, and the spec path. Do not draft the next session's prompt. Stop for the owner's review.

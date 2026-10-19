# Workforce segment 1B: Rules, spec session

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the lane 1 worktree. **This session writes a spec file. It writes no application code.**

---

You are a senior product designer and tech lead on Wendo RMS. The owner approved the Rules screens (Paper file `01M3TP8J54R83RHC9FJ7RAHGKG`). Your job is to write the **spec file** that the back-end and front-end build sessions of Segment 1B (Rules) follow, so the screens match Paper and the feature runs in production. The owner is not a developer: where you explain something in the final message, use plain words.

### The owner's standing rule: Paper is a demonstration, production is the goal
Paper exists so the owner can understand how the feature works. It is not a complete list of what production needs. For every screen your spec has **what Paper shows** (exactly) and **what production adds** (loading, empty, error, no-permission and locked states; a wrong or expired PIN; two people changing the same rule at once; a start date in the past or clashing with a version already stored; a change that would alter pay for a month already approved or paid; very long lists; keyboard and screen-reader behaviour; narrow desktop widths; and anything else real use needs). Where a business choice is involved, **choose your recommendation, put it in the spec, and log it** in `docs/features/workforce/specs/decisions-1b-spec.md` (*question, choice, why, what changing it takes*). Stop and ask only if truly blocked.

### Read first (only these)
1. `docs/features/workforce/segment-1-review.md` (section 1B), `design-pass-1-leave-conduct.md` ("Editing a rule", "Locked Change links", "Design pass 2: Chapters 12 and 13"), `design-pass-4-shared-parts.md` (the "Decided by the owner" tables only).
2. `backend/src/modules/workforce/rules/README.md`, `rules-field-policy.ts`, `rules-schemas.ts` (what exists: versions, confirmations, per-field policy, two read endpoints), `rules-defaults.ts`.
3. `frontend/features/workforce/_shared/README.md` and `index.ts` (the kit: reuse it and name the component for every part you can).
4. **Paper.** Call `get_guide` with `paper-mcp-instructions` once. **Do not call `get_basic_info`** (huge output). Use node ids directly with `get_screenshot`, `get_jsx` (`includeNodeIds: false`, `format: "inline-styles"`) and `get_computed_styles`. Chapter 13 · Rules is node `1K8V-0` on page "Workforce · D. Pay"; its 13 steps are the frames under its "Steps" child (the on-screen labels STEP 01 to 13 are right; some frame names are stale, so go by the on-screen labels). The Leave tab and its dialogs are Chapter 10 steps 18 to 20 on page "Workforce · C. Leave and conduct" (find the node with `find_nodes` text "Rules" scoped to that chapter, not the whole file). Read each frame once.

### What to write: `docs/features/workforce/specs/1b-rules-spec.md`
About 600 lines at most (two files if needed). For **each tab and dialog** (Lateness, Overtime, Attendance, Leave, Probation, Casual work, Conduct, Statutory, Holidays, Week and breaks, version history, who edits what, the shared Change dialog, the locked-Change popover):
1. Purpose, who sees it, who may change which row.
2. Layout at 1440 wide.
3. Design values the kit does not carry, from `get_computed_styles`, as `wds-` token names (flag values with no token); for kit parts say "use `<ComponentName>`" and list only differences.
4. Exact copy, including empty, error and locked states you write.
5. Interactions and states: hover, focus, selected, disabled with reasons, loading, empty, error, locked, keyboard path, focus order, screen-reader labels.
6. What production adds (separated).
7. What the server must provide: field-level data and actions so a back-end agent can design endpoints: create a version (effective date today or later in Nairobi time, reason, PIN), confirm, the "who can change this row" answer behind the padlock, who is told, version history, effective rules for a date, the Statutory tables (ships empty; the Accountant types and confirms; sample rates in Paper are illustrative only), holidays and the pay-on-holiday row, the Branch Manager's own-site overrides (only Lateness, Overtime and minimum cover).
Cross-cutting sections: the **permissions table** (role by tab and row, 404 versus 403), **how a change takes effect** (versions never edited; effective dates; what happens to a month already approved or paid: recommendation, a change never alters an approved month), **who is told and what is audited** (never pay figures in notifications), **the naming rule** (never a bare person name; role alone or name plus role; no he, she, her or his), accessibility, and a **gap list** against the built rules store.

### Rules
Write with the Edit and Write tools only (never sed, awk or heredocs); one line starting `Why:` before each Edit or Write; live task list. Commit with `git add <explicit paths>` ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Nothing pushed. Do not touch `backend/`, `frontend/` or Paper (record anything wrong in Paper in the spec and the final message). No subagents. Do not re-read a frame. Decide, don't hand back.

### Final message
Decisions table first, then a 5-line plain-English recap, then the production additions (one line each), anything inconsistent in Paper, and the spec path. Do not draft the next session's prompt. Stop for the owner's review.

# Template: spec session brief

Copy to `docs/sessions/<feature>-spec-<segment>.md` on the stack, fill the `<…>` parts, commit. The session reads Paper and writes a spec file; it writes **no application code**. Start it in a free lane.

---

# <Feature> segment <n>: <name>, spec session

Working document. Delete it when the feature ships. Paste everything below the divider into a fresh session started in the <lane> worktree. **This session writes a spec file. It writes no application code.**

---

You are a senior product designer and tech lead on Wendo RMS. The owner approved the Paper designs for <chapters> (file `01M3TP8J54R83RHC9FJ7RAHGKG`, page "<page name>", node `<chapter node>`). Your job is the spec for **segment <n>: <name>**. The owner's workflow works: front ends built from a spec have needed no design corrections, so write to that standard. The owner is not a developer: explain in plain words in your final message.

### The owner's standing rule: Paper is a demonstration, production is the goal
For every screen your spec has **what Paper shows** (exactly) and **what production adds** (loading, empty, error, locked and no-permission states; a wrong or expired PIN; two people acting at once; a large list; a failed export or download; no signal; keyboard and screen-reader use; narrow widths; anything else real use needs). Where a business choice is involved, **choose your recommendation, put it in the spec and log it** in `docs/features/<feature>/specs/decisions-<n>-spec.md` (*question, choice, why, what changing it takes*). Stop and ask the owner only if truly blocked.

### Production questions you MUST settle in the spec (not in Paper)
1. **Coexistence with the old system:** what the old code does today for this area, who is processed by which system during rollout, how nobody is processed twice, and the minimal additive guard the old code needs (the legacy tables stay untouched). Flag your decision prominently in your final message.
2. <Feature-specific questions, for example: the calculation engine, a document the designs do not draw, an old gate that must become server-enforced.>

### Read first (only these)
1. `docs/features/<feature>/segment-<n>-review.md`, <design-pass notes>, <earlier specs and decisions this one reuses>.
2. <The README and door of each back-end module this segment reads>, `frontend/features/<feature>/_shared/README.md` and `index.ts` (the kit: reuse it and name the component for every part you can).
3. **Paper.** Call `get_guide` with `paper-mcp-instructions` once. **Do not call `get_basic_info`** (huge output). Use the node ids below with `get_screenshot`, `get_jsx` (`includeNodeIds: false`, `format: "inline-styles"`) and `get_computed_styles`. Read each frame once.

| Step | Node | What |
|---|---|---|
| | | |

### What to write: `docs/features/<feature>/specs/<n>-<name>-spec.md`
About 600 lines at most (two files if needed). For **each screen**:
1. Purpose and who sees it (roles from the owner's decisions).
2. Layout at the design width (desktop 1440: sidebar 236, main 1204; phone 390; documents A4).
3. Design values the kit does not carry, from `get_computed_styles`, as `wds-` token names (flag values with no token); for kit parts say "use `<ComponentName>`" and list only the differences.
4. Exact copy, including empty, error, blocked and locked states you write.
5. Interactions and states: hover, focus, selected, disabled with reasons, loading, empty, error, locked, keyboard path, focus order, screen-reader labels.
6. What production adds (separated).
7. What the server must provide: field-level data and actions so a back-end agent can design endpoints; rules and edge cases; idempotency and concurrency; who may act.
Cross-cutting sections: the **status machine**, **documents and exports** (page size, fonts, stamps, numbering, the frozen-snapshot rule), the **permissions table** (404 versus 403), **notifications and audit** (never money figures in notifications), **accessibility**, **what this segment hands to the next**, and a **gap list** against what is built.

### Rules
Write with the Edit and Write tools only (never sed, awk, heredocs or cp); one line starting `Why:` before **every** Edit or Write; live task list. First action: create your branch with `git checkout -b <branch> <top-of-stack-branch>`. Commit with `git add <explicit paths>` ending with `Co-Authored-By: <the attribution line the session gives you>`. Nothing pushed. Do not touch `backend/`, `frontend/` or Paper (record anything wrong in Paper in the spec and the final message). No subagents. Do not re-read a frame. Naming rule: never a bare person name (role alone, or name plus role); no he, she, her or his. Decide, don't hand back.

### Final message
Decisions table first, then a 5-line plain-English recap, then the coexistence decision in two plain sentences, the production additions (one line each), anything inconsistent in Paper, and the spec path. Do not draft the next session's prompt. Stop for the owner's review.

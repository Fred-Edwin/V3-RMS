# Workforce segment 1A: Timesheets rework, spec session

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the lane 1 worktree. **This session writes a spec file. It writes no application code.**

---

You are a senior product designer and tech lead on Wendo RMS. The owner approved a redesign of timesheets and payroll as one month-based feature (Paper file `01M3TP8J54R83RHC9FJ7RAHGKG`, page "Workforce · D. Pay", **Chapter 12 · Payroll and timesheets**, node `314E-0`). Slice 4a (timesheets) is already built to an older design. Your job is to write the **spec file** that the back-end and front-end build sessions of Segment 1A (Timesheets rework) will follow, so the screens can be built exactly like Paper and the feature can run in production.

### The owner's standing rule: Paper is a demonstration, production is the goal
The Paper designs exist so the owner can understand how the feature works. They are not a complete list of what production needs. The build agents must deliver a **production-ready** feature and are expected to add whatever real use needs that Paper does not draw. Your spec must therefore have two parts for every screen: **what Paper shows** (exactly) and **what production adds** (your complete list of what is missing: loading, empty and error states, no-permission and locked states, a wrong or expired PIN, two people acting at once, a long name, 200 people, a failed export, a very slow connection, keyboard and screen-reader behaviour, narrow desktop widths, and anything else you can name). Do not wait for the owner to ask for these. Where a production addition involves a business choice the owner could reasonably answer, **choose your recommendation, put it in the spec, and log it** in the decisions table in `docs/features/workforce/specs/decisions-1a-spec.md` (*question, choice, why, what changing it takes*). Only stop and ask the owner if you are truly blocked.

### Read first (only these)
1. `docs/features/workforce/segment-1-review.md` (what changes versus the built slice 4a; the three defaults), `design-pass-3-payroll.md` (the owner's decisions for Chapter 12), `design-pass-4-shared-parts.md` (the "Decided by the owner" tables only).
2. `backend/src/modules/workforce/timesheets/README.md` (what is built), `frontend/features/workforce/_shared/README.md` and `index.ts` (the kit: **reuse it**; name the existing component for every part you can), `frontend/features/workforce/timesheets/` READMEs (what the built screens already have).
3. **Paper.** Call `get_guide` with `paper-mcp-instructions` once. **Do not call `get_basic_info`** (it returns a huge token list; you do not need it). Use the node ids below directly with `get_screenshot`, `get_jsx` (pass `includeNodeIds: false`, `format: "inline-styles"`) and `get_computed_styles`.

| Step | Node | What |
|---|---|---|
| 01 | `3AUK-0` | How payroll works (only for the six stages and who does what) |
| 02 | `314L-0` | Timesheets month page (months list left, month right, KPI strip, table) |
| 03 | `31J4-0` | Date range |
| 04 | `31WA-0` | Export menu |
| 05, 06 | `3262-0`, `32LS-0` | Exported timesheet PDF, pages 1 and 2 (A4 landscape document) |
| 07 | `32QU-0` | Excel export |
| 08 | `330S-0` | A person's drawer |
| 09 | `34CW-0` | A person's full month |
| 10 | `33DF-0` | Overtime decision dialog |
| 11 | `33PK-0` | Approve the month dialog |
| 12 | `340Z-0` | Month approved |

Also Chapter 9 on page "Workforce · B. Schedule and time" (`1CG5-0`): **only** to note what changes (Report a problem goes to the Branch Manager; after the month is approved, "tell HR"). The phone screens are built and unchanged except that wording.

### What to write: `docs/features/workforce/specs/1a-timesheets-spec.md`
Keep it concise (aim for about 600 lines; split into two files if you must). For **each screen**:
1. **Purpose and who sees it** (roles, from the owner's decisions).
2. **Layout**: regions and their sizes at 1440 wide (sidebar 236, main 1204, and so on), what scrolls and what stays.
3. **Design values** that the kit does not already carry, read from Paper with `get_computed_styles`: font family, size, weight, tracking, line height, colours **by `wds-` token name** (match Paper values to the tokens in `frontend/app/tokens.wds.css`; flag any value with no token), spacing, borders, radii, shadows. For parts the kit already has (KPI strip, table kit, status pills, tabs, dialog, PIN field, range picker, drawer), say "use `<ComponentName>`" and list only the differences.
4. **Exact copy** (every string, including captions, column headers, button labels, empty-state and error-state text you write).
5. **Interactions and states**: hover, focus, selected (a selected month is neutral grey `#E4E2DE` with a dark left bar, never amber; amber means in progress or needs you), disabled (with reasons), loading, empty, error, locked, keyboard path, focus order, screen-reader labels.
6. **What production adds** (as above), clearly separated from what Paper shows.
7. **What the server must provide** (field-level: the data this screen needs and each action it takes), written so a back-end agent can design endpoints from it. Include rules and edge cases: who may act, what blocks "Approve September", what counts as an exception, how a part-approved overtime is stored, how the open month's "so far" is computed, idempotency, concurrency.

Then add these cross-cutting sections: **the PDF and Excel documents** (page size, margins, fonts, the department grouping and 20-people-on-page-1 rule, the "Draft, not approved" stamp, the signature and QR, the document number TSH-n, column definitions, number formats, what happens past one page); **permissions table** (role by action, the 404 versus 403 rule); **the month status machine** (OPEN, TO_APPROVE, APPROVED, and what each allows; payroll stages and Paid belong to Segment 2, only reference them); **notifications and audit events** (who is told what, what is audited, never pay figures); **accessibility and keyboard**; **a gap list** against the built slice 4a (what must be rebuilt or removed), kept consistent with the review file.

### Rules
- Write the spec with the Edit and Write tools only (never sed, awk or heredocs); one line starting `Why:` before each Edit or Write; keep a live task list. Commit with `git add <explicit paths>` ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Nothing pushed. Do not touch `backend/`, `frontend/` or Paper (if Paper looks wrong, record it in the spec and the final message, do not edit it).
- No subagents. Read only what is named. Do not re-read a frame. One `get_jsx` and one `get_computed_styles` pass per screen; a screenshot of each screen for your own check.
- Naming rule from the owner: never a bare person name, use the role or name plus role; no he, she, her or his.
- Decide, don't hand back: finish everything in scope.

### Final message
Open with the decisions table, then a 5-line plain-English recap, then: the list of **production additions** you made beyond Paper (one line each), anything in Paper that looks wrong or inconsistent, and the path of the spec file. Do not draft the next session's prompt. Stop for the owner's review.

# Workforce segment 2: Payroll (desktop), spec session

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the lane 1 worktree. **This session writes a spec file. It writes no application code.**

---

You are a senior product designer and tech lead on Wendo RMS. The owner approved the redesign of payroll and timesheets as one month-based feature (Paper file `01M3TP8J54R83RHC9FJ7RAHGKG`, page "Workforce · D. Pay", **Chapter 12 · Payroll and timesheets**, node `314E-0`). Segment 1 already built the **timesheet** half (months, approval by each site's manager, exports) and the **Rules** screens. Your job is the spec for **Segment 2: Payroll on the desktop**, steps 13 to 29. The owner's workflow works: they have not needed to correct a front-end design built from a spec, so write this one to the same standard. The owner is not a developer; explain things in plain words in your final message.

### The owner's standing rule: Paper is a demonstration, production is the goal
Paper shows how the feature works. It is not a complete list of what production needs. For every screen your spec has **what Paper shows** (exactly) and **what production adds** (loading, empty, error, locked, no-permission states; a wrong PIN; two people acting at once; a month with 200 people; a person with no pay profile; a mid-month joiner or leaver; a site that has not approved; figures that fail a sanity check; a failed export or bank file; keyboard and screen-reader use; narrow desktop widths; and anything else real use needs). Where a business choice is involved, **choose your recommendation, put it in the spec, and log it** in `docs/features/workforce/specs/decisions-2-spec.md` (*question, choice, why, what changing it takes*). Stop and ask the owner only if truly blocked.

### Two production questions you MUST settle in the spec (they are not in Paper)
1. **Rollout and the old payslips.** The old payslip code (legacy HR module) still pays everyone today. The new attendance clock is switched on per site (pilot: Nyeri Town first), so a site that is off has **no approved timesheets** and cannot be in a Payroll month. Paper says "Payroll waits for every site". Decide and specify: which sites a Payroll month includes (recommendation: only sites whose attendance is on and that have approved their month), how the staff of included sites are kept out of the old payslip run so nobody is paid twice, how the old run keeps working for the rest, what the month page shows for a site not yet on the new system, and the minimal guard the old code needs (state it as a small, additive change; the legacy tables stay untouched). This is the most important production decision in the segment: flag it prominently in your final message.
2. **The calculation engine.** The statutory tables ship **empty**; the Accountant types and confirms them in the Rules Statutory tab (built). Paper's sample figures are illustrative only. Specify the engine as **generic and table-driven**: no tax rate or band is hard-coded; what inputs it takes (approved hours from `getApprovedHours`, the pay profile, authorised overtime minutes and the overtime multipliers, lateness and absence deductions as the Rules say, holiday pay, casual pay as a memo line only, leave days as 0 until Leave is built); the order of calculation (gross, statutory deductions, PAYE after personal relief, net); rounding rules; what a payslip line records so "each line shows its working"; sanity checks that block or warn (a negative net, a huge change from last month). Do not state tax law as fact: the spec describes the structure, and says the Accountant must check the first month against a hand calculation.

### Read first (only these)
1. `docs/features/workforce/design-pass-3-payroll.md` (the owner's decisions: stages, who does what, corrections until Paid, the lock, bank only, exports, the Director estimate), `design-pass-4-shared-parts.md` ("Decided by the owner"), `specs/1a-timesheets-spec.md` (the Timesheets tab and months list you will reuse; the month status machine), `specs/1b-rules-spec.md` (only the Statutory, Overtime, Lateness and Holidays sections: what payroll reads).
2. `backend/src/modules/workforce/timesheets/README.md` (the `getApprovedHours` door), `rules/README.md` (`getEffectiveRules`, `isPayConfirmed`), `people/README.md` (pay profile, `payAmountOn`), and a quick look at the legacy payslip code (find it under `backend/src/` with the Grep tool: `payslip`; read only the service and routes to learn what exists and how to guard it).
3. `frontend/features/workforce/_shared/README.md` and `index.ts` (the kit: reuse it and name the component for every part you can), `frontend/features/workforce/timesheets/` READMEs.
4. **Paper.** Call `get_guide` with `paper-mcp-instructions` once. **Do not call `get_basic_info`** (huge output). Use the node ids below with `get_screenshot`, `get_jsx` (`includeNodeIds: false`, `format: "inline-styles"`) and `get_computed_styles`. Read each frame once.

| Step | Node | What |
|---|---|---|
| 01 | `3AUK-0` | How payroll works (stages, who does what) |
| 13 | `34VL-0` | The payroll month, waiting for a site |
| 14 | `3559-0` | Rules applied |
| 15 | `35IW-0` | Tax and deductions |
| 16 | `35YU-0` | Casual pay tab |
| 17 | `36DI-0` | Totals and HR's review |
| 18 | `36QQ-0` | The Accountant approves |
| 19 | `373H-0` | HR publishes, Payslips tab |
| 20 | `37H4-0` | The Accountant pays out (bank file) |
| 21 | `3CA5-0` | Mark as paid locks the month |
| 22 | `37TW-0` | Payroll export menu |
| 23, 24 | `3852-0`, `38I9-0` | Register PDF page 1; summary PDF |
| 25 | `38SP-0` | Payroll Excel workbook (five sheets) |
| 26 | `391Z-0` | The Director's estimate for the open month |
| 27 | `3AWN-0` | Corrections open until paid |
| 28 | `3B7L-0` | Correct a payslip |
| 29 | `3BHO-0` | Month locked once paid |

Steps 30 to 36 (staff phone, A4 payslip, casual pay sheet) belong to Segment 3 and another spec: ignore them except to note what the desktop must hand to them. Step 02 to 12 (Timesheets tab) were built in Segment 1: reuse, do not respec.

### What to write: `docs/features/workforce/specs/2-payroll-spec.md`
About 600 lines at most (two files if needed). For **each screen**:
1. Purpose and who sees it (roles from the owner's decisions; Branch Managers see no payroll).
2. Layout at 1440 wide (sidebar 236, main 1204, months list, KPI strip, tabs).
3. Design values the kit does not carry, from `get_computed_styles`, as `wds-` token names (flag values with no token); for kit parts say "use `<ComponentName>`" and list only the differences. The stage line colours (amber current, green finished, grey to come), the selected-month grey `#E4E2DE` with a dark left bar (never amber).
4. Exact copy, including empty, error, blocked and locked states you write.
5. Interactions and states: hover, focus, selected, disabled with reasons, loading, empty, error, locked, keyboard path, focus order, screen-reader labels.
6. What production adds (separated).
7. What the server must provide: field-level data and actions so a back-end agent can design endpoints; rules and edge cases; idempotency and concurrency; who may act (the preparer can never approve; HR cannot approve a site; the Accountant approves; Director and System Admin read).
Cross-cutting sections: **the month status machine for payroll** (Timesheets approved, Calculated, Reviewed, Approved, Published, Paid; what each allows and who moves it; how it extends the timesheet status machine from 1A), **the calculation engine** (above), **corrections until Paid** (one payslip, reason and PIN, version 2, the voided bank file if one was downloaded, who is told) and **the lock**, **the bank file** (bank only; the file format is a business choice: recommend a generic CSV with the columns Paper shows and say it is replaceable per bank), **the documents and exports** (register PDF and Excel, summary PDF, statutory schedules Excel, all payslips; page size, fonts, the Draft stamp until approved, numbers PAY-2026-09 style, the frozen snapshot rule from 1A), **permissions table** (404 versus 403), **notifications and audit** (never pay figures in notifications), **accessibility**, the **rollout section** (question 1), and a **gap list** against what is built.
Also say what the **Director's estimate** (step 26) needs and how "earned so far" is computed for an open month without approved timesheets.

### Rules
Write with the Edit and Write tools only (never sed, awk or heredocs); one line starting `Why:` before each Edit or Write; live task list. First action: create your branch with `git checkout -b docs/workforce-spec-2-payroll feat/workforce-segment-1` (the top of the stack). Commit with `git add <explicit paths>` ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Nothing pushed. Do not touch `backend/`, `frontend/` or Paper (record anything wrong in Paper in the spec and the final message). No subagents. Do not re-read a frame. Decide, don't hand back.

### Final message
Decisions table first, then a 5-line plain-English recap, then **the rollout decision (question 1) stated in two plain sentences**, the production additions (one line each), anything inconsistent in Paper, and the spec path. Do not draft the next session's prompt. Stop for the owner's review.

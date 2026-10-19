# Workforce segment 3: Payslips and casual pay (phone and documents), spec session

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the lane 2 worktree. **This session writes a spec file. It writes no application code.**

---

You are a senior product designer and tech lead on Wendo RMS. The owner approved the redesign of payroll (Paper file `01M3TP8J54R83RHC9FJ7RAHGKG`, page "Workforce · D. Pay", **Chapter 12 · Payroll and timesheets**, node `314E-0`). Another session is writing the spec for the **desktop** half (steps 13 to 29). Your job is the spec for **Segment 3: what staff see and the documents**, steps 30 to 36: the staff phone, the payslip as an A4 document, the Document view, and casual pay with its pay sheet. The owner's workflow works: they have not needed to correct a front-end design built from a spec, so write this one to the same standard. The owner is not a developer; explain in plain words in your final message.

### The owner's standing rule: Paper is a demonstration, production is the goal
Paper shows how the feature works; it is not a complete list of what production needs. For every screen your spec has **what Paper shows** (exactly) and **what production adds** (loading, empty, error, offline, no-permission and locked states; a wrong, missing or locked-out code; a payslip not yet published; a corrected payslip (version 2); a person with no payslips; a very small phone; a very large font setting; a failed or slow download or share; a head recording casual workers with no signal; two heads recording the same worker; keyboard and screen-reader use; and anything else real use needs). Where a business choice is involved, **choose your recommendation, put it in the spec, and log it** in `docs/features/workforce/specs/decisions-3-spec.md` (*question, choice, why, what changing it takes*). Stop and ask only if truly blocked.

### Things Paper does not draw that production needs (settle them in the spec)
- **The P9** (Kenyan Tax Deduction Card): Paper draws only the "Download P9 for 2026" button. Specify the document in the same A4 style as the payslip (what it contains in plain terms, when it becomes available: January 2027 for 2026, how a staff member who joined or left mid-year is handled). Do not state tax rules as fact; describe the data and layout, and flag that the Accountant must verify the content against the official format before first use.
- **Opening a payslip behind "their own code"** (steps 30): the code screen, wrong code (every try is logged, nobody is locked out, the System Admin is told after 3), an unrecognised phone (the first sign-in asks "Is this your phone?"; the screens must never explain how phones are recognised), and what is audited. Read `design-pass-4-shared-parts.md` for the decisions.
- **Amounts hidden by default** with an eye icon (and the choice remembered per device): specify the accessibility behaviour (screen readers must not read hidden amounts).
- **Casual pay**: who is a casual worker, how a head adds one, the daily rate from Rules, the memo line on payroll, the petty-cash hand-off (paid from petty cash, not in the bank file), the Branch Manager's approval, the pay sheet preview for the head and the printed sheet after approval, what happens if a day is recorded wrongly, a casual who works across sites. A department head approves nothing, but here the head **records**: keep that distinction exact.
- **Corrected payslip (version 2)** for staff: how they are told, how version 1 is shown as replaced, "Questions? Call HR" (no in-app problem pathway; no HR contact line exists in the Rules store yet: recommend where it comes from).
- **A person on the old payslip system** (a site not yet on the new one): what the phone's "My payslips" shows, so nobody sees a broken screen during the rollout.

### Read first (only these)
1. `docs/features/workforce/design-pass-3-payroll.md` (especially "Staff on the phone", "Who sees what"), `design-pass-4-shared-parts.md` ("Decided by the owner" and "More decisions"), `design-pass-1-leave-conduct.md` ("Document view", "Do staff sign"), `specs/1a-timesheets-spec.md` (the document and export section: reuse its PDF rules), `specs/1b-rules-spec.md` (Casual work and Statutory tabs only).
2. `frontend/features/workforce/_shared/README.md` and `index.ts` (the kit: phone parts, Document view parts, PinField; reuse and name every component), `frontend/features/workforce/timesheets/` READMEs (My time on the phone).
3. A quick look at the legacy payslip code (Grep `payslip` under `backend/src/` and `frontend/`; read only the service, routes and the staff payslip page) so you know what exists today.
4. **Paper.** Call `get_guide` with `paper-mcp-instructions` once. **Do not call `get_basic_info`** (huge output). Use node ids with `get_screenshot`, `get_jsx` (`includeNodeIds: false`, `format: "inline-styles"`) and `get_computed_styles`. Read each frame once. The Document view and phone Home style are already approved in Chapters 1 and 10 (reuse, do not respec).

| Step | Node | What |
|---|---|---|
| 30 | `3AJR-0` | Staff phone: getting in (notification, Menu, My payslips, the code) |
| 31 | `3C3B-0` | Payslips home, detail, history |
| 32 | `3BSS-0` | The payslip as an A4 document |
| 33 | `3AMB-0` | Document view (phone) |
| 34 | `3AOM-0` | Casual pay, phones (head records, manager approves, a third phone) |
| 35 | `3ASM-0` | The casual pay sheet (document) |
| 36 | `3AQ2-0` | A corrected payslip, version 2 |

### What to write: `docs/features/workforce/specs/3-payslips-spec.md`
About 500 lines at most. For **each screen**: purpose and who sees it; layout at 390 wide (and the A4 document at 794); design values the kit does not carry as `wds-` token names (flag values with no token), with "use `<ComponentName>`" for kit parts; exact copy including empty, error and locked states you write; interactions and states (hover where it applies, focus, disabled with reasons, loading, empty, error, offline, keyboard and screen-reader behaviour); **what production adds** (separated); **what the server must provide** (field-level data and actions so a back-end agent can design endpoints: payslip list and detail for the signed-in person only, year to date, the hidden-amounts preference, the document file, the code check and its audit, versions, casual recording and approval, the pay sheet, the P9 data). Cross-cutting: **permissions table** (a person sees only their own payslip; HR and the Accountant can open any payslip but it is audited and, for opening someone else's, the Director is told per the owner's decision; 404 versus 403), the **A4 documents** (payslip, casual pay sheet, P9: page size, fonts, signature, QR, numbering PS-n and CPS-n, the version label, the frozen-snapshot rule), **notifications and audit** (never pay figures), **accessibility**, and a **gap list** against what is built. Also list **what the desktop Payroll feature must hand over** to this segment (publish creates the payslips; a correction creates version 2), so the two specs agree.

### Rules
Write with the Edit and Write tools only (never sed, awk or heredocs); one line starting `Why:` before each Edit or Write; live task list. First action: create your branch with `git checkout -b docs/workforce-spec-3-payslips` from the current branch (`feat/workforce-segment-1`, the top of the stack). Commit with `git add <explicit paths>` ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Nothing pushed. Do not touch `backend/`, `frontend/` or Paper (record anything wrong in Paper in the spec and the final message). No subagents. Do not re-read a frame. Naming rule: never a bare person name; role alone or name plus role; no he, she, her or his. Decide, don't hand back.

### Final message
Decisions table first, then a 5-line plain-English recap, then the production additions (one line each), anything inconsistent in Paper, and the spec path. Do not draft the next session's prompt. Stop for the owner's review.

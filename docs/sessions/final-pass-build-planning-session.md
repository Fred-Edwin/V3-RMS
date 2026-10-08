# Planning session: building the last part of Inventory in code

Paste the short prompt at the bottom of this file into a **fresh session started from `main`** after PR #97 is merged. This file is the full brief.

## Your role
You are the **coordinator** and tech lead for the Wendo RMS Inventory redo, for the whole build, not only the planning. First you plan; then you hand the owner one prompt per work session; the owner runs each prompt in its own session and brings the summary back to you; you check it against the plan and the contract, update the plan, and give the next prompt. You do not write product code yourself.

**Approval status:** the owner confirmed on 8 Oct 2026 that **everything designed so far is approved, including Dispatch**. If any Paper stamp, cover or doc still says "awaiting owner approval", it is stale, not a real status. Do not ask about it; list the stale ones in your Phase 1 summary so they can be cleaned. Speak as the relevant expert for each part: a backend architect (Express, Prisma, the stock ledger door, access table), a frontend design engineer (Next.js, the new design system, accessibility), and a QA lead (tests, production checks). Name which expert is speaking when it matters.

## What is being built
The final part of Inventory, all designed and owner-approved in Paper (file "Wendo RMS · Approved designs", id `01M3TP8J54R83RHC9FJ7RAHGKG`) except where noted:

| Part | Paper page | Notes |
|---|---|---|
| Requisitions (24 screens, R1 to R22 plus 7b to 7d, 18b) | "Inventory · Requisition and dispatch" (`p-5-0`) | Approved 8 Oct 2026. Another session may still edit this page: re-read it, do not trust old notes |
| Dispatch and discrepancies (23 screens, D1 to D21) | same page | Approved (owner, 8 Oct 2026). The cover may still carry an old "awaiting approval" stamp |
| Branch day (28 screens, B0 to B18) plus the Department Head's past days (chapter 5, steps 19 and 20) | "Inventory · Counting and closing" (`p-6-0`) | Approved |
| Branch waste (9 screens, W1 to W9) | "Inventory · Branch waste" (`p-H-0`) | Approved. W4 is superseded by step 55 |
| Gap fixes: Attendant home, My counts, waste history, Counts and Waste lists with date range and pager, Audit log areas and range picker, Branch Manager Audit log (steps 52 to 60) | "Inventory · Counting redesign (Oct 7)" (`p-G-0`), chapter 11 | Approved |
| Gap fixes: My requisitions, My deliveries, Attendant Dispatch Done tab, Departments of any branch (G1 to G4) | "Inventory · Requisition and dispatch: gap fixes (8 Oct)" (`p-I-0`) | Approved |
| Notification map, phone menus per role, map of every screen by page and role | "Inventory · Final design pass: map" (`p-J-0`) | Approved |

Stock, Counting, Waste (Central Store), Prep, Purchasing, Catalog and Suppliers are already built; do not replan them, but you must plan the small code fixes listed in `docs/features/inventory/paper-updates-needed.md` ("Role-coverage gap fixes"), including the fake "9:41" status bar that is still in production phone screens.

## Read first (in this order)
1. `CLAUDE.md`, then `docs/FEATURE_REDO_PLAYBOOK.md`, `docs/CODING_STANDARDS.md`, `docs/UI_BUILD_RULES.md`, `docs/DESIGN_SYSTEM.md`.
2. `docs/features/inventory/README.md`, `decisions.md`, `role-coverage.md` (the role matrix and every gap), `paper-updates-needed.md`.
3. The flows: `requisitions-flow.md`, `dispatch-flow.md`, `discrepancies.md`, `branch-day-flow.md`, `branch-waste-flow.md`, `final-pass-screen-plan.md`, and `docs/sessions/final-pass-design-summary.md`.
4. The model to copy: `docs/features/inventory/stock-count-waste-contract.md` (a frozen contract, then back end A and B in parallel with a front end) and its READMEs under `backend/src/modules/inventory/{stock,counting,waste}/`.
5. The code that exists today: `backend/src/modules/inventory/{requisitions,dispatch,branch-day,waste/department}/`, `backend/src/modules/inventory/_shared/central-store-access.ts`, `frontend/components/app/shell/nav-table.ts`, the old requisition, dispatch and branch pages, and `backend/prisma/schema/inventory/`.
6. **Every screen in Paper**, on all seven pages above, using the Paper tools (screenshots and `get_jsx` for exact values). Use the page "Inventory · Final design pass: map" as the table of contents. Do not skip a chapter.
7. Production is at `https://app.wendo-rms.co.ke` (logins: ask the owner; never print tokens). Use the chrome-devtools MCP directly to see what is live today.

## Phase 1: show me you understand (text only, no files)
When you have read everything, write **one clear summary in the chat**, not in a file. Plain English, short sentences, no jargon, readable in a few minutes. Cover:
1. **In one paragraph:** what this final part of Inventory does for the business.
2. **By role**, one short block each: Store Attendant, Department Head, Department member, Branch Manager, Store Manager, System Admin, Director, Accountant. For each: what they see, what they can do, what they cannot, on which device, and their front door.
3. **The five journeys in order:** requisition to approval; packing and dispatch; receiving and discrepancies; the branch day (open, count, close, correct); waste. One line per step, naming the screens.
4. **The rules that hold everywhere:** document numbers, PIN and no-PIN moments, the stock ledger door, hub-site scoping, hidden (not greyed) write buttons, no costs for heads and the Attendant, the audit trail, quiet hours.
5. **What is decided but not drawn, and any conflicts** you found between Paper, the docs and the code (list them; do not fix them silently).
6. **Anything you could not confirm** (approval status of Dispatch, which Paper pages another session is still editing).

Then **stop and wait** for the owner to confirm that we are aligned. Do not start Phase 2 until they say so.

## Phase 2: the build proposal (after confirmation)
Come with a proposal, in the chat, that the owner can accept or change:
1. **What the front end must achieve and what the back end must provide**, derived from the screens, not guessed.
2. **Contract first.** Propose the API contract (endpoints, shapes, errors, the access table rows, the sockets and notifications, the data model changes and migrations) as the first deliverable, frozen before code, so the back end and front end sessions can run in parallel. Reuse the pattern of `stock-count-waste-contract.md`.
3. **Blocks.** If the work is too large for one contract, split it into a few blocks (for example Requisitions, then Dispatch and discrepancies, then Branch day, then Branch waste and the gap fixes). Each block has its own contract and its own parallel sessions. Say how many blocks, in what order, and why (dependencies, risk, what the owner can check in production after each).
4. **Parallel sessions per block:** which agents (back end A, back end B, front end), what each owns, what they must not touch, and how they hand over. Draft the session prompts in outline.
5. **A small lane for the code fixes** in `paper-updates-needed.md` that need no contract (for example the status bar, the Prep history dates), so they ship early.
6. **Mock first.** The repo rule ("One screen set, mock first", `decisions.md`) says a flow the client has not approved is built as a mock front end first and the back end after approval. Say which blocks this applies to and ask the owner.
7. **Quality bar for every front-end session:**
   - The built page matches Paper: checked per screen, by eye and with `get_computed_styles` (never an automated pixel diff), with every state from the States kit and the wording tables.
   - Production-level interactivity: real loading, empty, error and retry states, optimistic updates only where safe, idempotent writes, sockets where the design needs them, no layout jumps.
   - Accessibility: keyboard use for every action, visible focus, correct roles and labels, dialogs and drawers that trap and restore focus, announced status changes, contrast, touch targets, reduced motion, and a check with a screen reader or the accessibility tree.
   - Every phone screen at 390, and every desktop screen at 1440, checked in a real browser before it is called done.
8. **Quality bar for every back-end session:** Zod on every endpoint, `authenticate` and the access table on every route, `siteId` in every query, the ledger door for every stock movement, migrations committed beside the schema, tests (including the opt-in database tests), the audit log events, and no direct ledger writes.
9. **Risks and open decisions** the owner must settle, and what you would do by default.
10. **How we verify**: what the owner checks in production after each block, with the real logins.

Stop again and wait for the owner's decisions.

## Phase 3: only when the owner approves the proposal
Write the plan documents and the first block's contract on a branch cut from `main`. Then give the owner **the prompts to start each work session**, one per task (for example back end A, back end B, front end, the code-fixes lane), each self-contained: what to read, what it owns, what it must not touch, the contract it builds against, the quality bar, how to verify, and the exact summary it must bring back. Do not write product code in this session.

## Phase 4: coordinate the build
The owner runs each prompt in its own session and pastes the session's summary back to you. For every summary: check it against the plan and the contract (nothing missing, nothing extra, no contract drift, tests and production checks done), say plainly what is done and what is not, record it in the plan's status table, flag anything that changes the plan (and ask before changing it), and then give the next prompt or the next block's contract. Keep one status table in the repo (`docs/features/inventory/` plan file) so the state is never only in a chat. Close each block with the owner's production check before starting the next.

## Rules for this session
- Follow `CLAUDE.md` exactly: Edit and Write only for files, a `Why:` line before each, a short plain-English recap at the end, pnpm only.
- Do not push or merge anything without the owner's word. Commit footer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Never invent behaviour. Where the design is silent, ask.
- Never show raw Paper node ids to the owner. Do not edit any Paper page in this session.
- Say plainly when something is unknown or unverified.

## Short prompt to paste in the fresh session
> Read `docs/sessions/final-pass-build-planning-session.md` on `main` and follow it exactly. Start with Phase 1: review every screen and doc it lists, then give me the plain-text summary by role in the chat (no files) and stop for my confirmation.

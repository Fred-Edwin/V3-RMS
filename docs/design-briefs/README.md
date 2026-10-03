# Design briefs

Reusable prompts for the **product-designer agent** (Step 1–2 of `docs/FEATURE_REDO_PLAYBOOK.md`):
the agent studies a flow, sends a brief, then builds a story-ordered walkthrough page in Paper.

- **[flow-walkthrough-brief-GENERIC.md](flow-walkthrough-brief-GENERIC.md)** — the template. Paste into a fresh session and change the "THIS SESSION'S FLOW" line. One flow per session.
- `example-*-brief.md` — filled-in versions used for Inventory (requisition, purchasing, stock and counting) and the integration pass. Use them to see how a brief is specialised; do not reuse their flow-specific parts.

Known staleness (update the generic brief before the next use):
- Its "read first" lists name docs that were deleted in the 2026-10-03 cleanup (`milestone-*-plan.md`, `02-screens-by-role.md`, `WALKTHROUGH_FINDINGS.md`, `*-walkthrough-decisions.md`). Point it at the sub-module README (`backend/src/modules/inventory/<sub>/README.md`) and `docs/features/inventory/decisions.md` instead.
- It tells the agent to write `docs/features/inventory/<flow>-walkthrough-decisions.md`. Under the documentation strategy that note is temporary: its decisions get folded into the sub-module README / `decisions.md` when the flow is built.
- The "flows still to come" list and Paper page ids (working file `01M1ZZJ6S3FZGF5C7PPBGTKY89`, approved file `01M3TP8J54R83RHC9FJ7RAHGKG`) reflect 2026-10-01.
- The standing owner rules inside it (attendants never see stock figures, nothing is deleted, Restock level wording, table style, phone style) are still in force and also live in `docs/features/inventory/README.md`.

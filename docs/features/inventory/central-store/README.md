# Central Store — implementation docs

Everything about building the Central Store side of Inventory lives in this folder from now on. Older plans stay where they are (`../milestone-*-plan.md`, `../*-walkthrough-decisions.md`); do not move them. New plans, session logs and parity notes go here.

| File | What it is |
|---|---|
| `catalog-suppliers-restock-plan.md` | Build plan for the approved Catalog, suppliers and restock levels flow (migrations, services, frontend). |
| `session-N-prompt.md` / `session-N-log.md` | The handover prompt each agent session starts from, and what that session did. Written per session. |
| `visual-parity-protocol.md` | How a frontend agent proves each screen matches Paper without wasting time. Binding for every Central Store screen. |

Later flows (Stock and counting, Prep, Purchasing changes) add their plans here as `<flow>-plan.md`.

## Design sources (read, do not edit)

- Paper file "V3-RMS", page "15 · Catalog, suppliers and restock levels walkthrough (client)". **The master is the "Wendo RMS · Approved designs" file, page "Inventory . Catalog, suppliers and restock levels" (pasted 2 Oct 2026; link `https://app.paper.design/file/01M3TP8J54R83RHC9FJ7RAHGKG/p-7-0`).** The V3-RMS working copy is for the design agent only.
- Purchasing changes (cheque, supplier names on documents): approved file, page "Inventory · Purchasing".
- Decisions: `../catalog-suppliers-restock-walkthrough-decisions.md`.
- Find artboards by name, not by id: ids change when a page is copied between files.

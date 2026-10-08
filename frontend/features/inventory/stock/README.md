# Stock (front end)

Read only for every desktop role (`stock.read`); the Attendant never reaches it. Contract: §4.2 (S1 to S5). `_shared/services/stock-api.ts` is the one HTTP service (`callApi` fixtures seam). Folders: `overview/`, `items/`, `history/` (ledger, stock card, date picker).

| Step | Paper node | Route | Verdict |
|---|---|---|---|
| 42 Overview | `24DJ-0` | `/stock` | built from the screenshot's layout, not computed styles |
| 27 All items | `224J-0` | `/stock/items` | built on the shared table; not compared in the browser |
| 28 Stock ledger, date picker | `22BR-0` | `/stock/ledger` | built; the picker is our own panel (no popover package); not compared |
| 29 Stock card | `22OO-0` | `/stock/ledger/[itemId]` | built; not compared |

Honest gap: these four screens were built from Paper screenshots and the shared table's conventions; their exact values (`get_computed_styles`) were not pulled per element. Do that in the real-data pass.

Old files kept on purpose: `components/screens/stock-ledger-screen.tsx`, `stock-table`, `stock-topbar`, `hooks/use-stock.ts`, `services/stock-api-service.ts` and `types/stock.ts` serve the branch Department Head's ledger, branch day and the old spot-count route until their redo or the release.

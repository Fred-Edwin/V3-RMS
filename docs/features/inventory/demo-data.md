# Demo data in production (client demo, 6 Oct 2026)

Production holds the owner's **real** data and a small amount of **demo** data. This page says which is which and how to remove the demo data.

## Real data (never remove)
The catalog and suppliers loaded on 6 Oct 2026 by `seed-catalog-from-staging` from `docs/Item Catalog/staging/`: 214 items, 19 categories, 7 suppliers with their contacts, payment methods and 70 supplier lines. Plus the client's real staff accounts. Backup taken before any demo data: `~/wendo-backups/wendo_rms_2026-10-06_pre-demo.dump` (on the owner's machine).

## Demo data and how to recognise it
The client sees these rows, so the markers are neutral wording rather than the word DEMO (decided 6 Oct 2026). The one exception is the ledger, which cannot be edited.

| Data | Marker | Where |
|---|---|---|
| 21 restock levels (12 Central Store, 5 Nyeri Town Kitchen, 4 Nyeri Town Barista) | change-log reason `Opening setup · 6 Oct 2026` (until `rename-demo-markers.sql` is run: `DEMO · restock level`) | `restock_levels`, `restock_level_changes` |
| 17 opening-stock rows, so Restock shows a mix of OK, Low and Out | ledger reason `DEMO · opening stock` (the ledger cannot be edited; it shows only on the old Stock ledger screen) | `inventory_transactions` |
| 1 supplier contact on Meadows | name `Sales desk` (until renamed: `DEMO · Sales contact`), phone `0700 000 000` | `supplier_contacts` |
| An item added live in the demo (rehearsal and demo) | name starts `Demo —` | `inventory_items` |
| Anything else added live (a Cheque payment method, a supplier document) | title or note says DEMO | removed in the app (supplier page) |
| The whole Purchasing and Receiving flow | not in the database; it lives in each browser (`localStorage`) | reset with the Demo bar's Load |

Live edits during the demo are made **on demo rows only** (the Demo item, the demo contact, a demo restock level), so real items are not altered. The audit-log entries they create stay in the log.

## Apply and remove
Both scripts are in `backend/src/scripts/demo-data/`. Run from that folder:

    ssh wendo 'cd ~/wendo-rms && docker compose exec -T postgres psql -U wendo_user -d wendo_rms -v ON_ERROR_STOP=1' < apply-demo-data.sql
    ssh wendo 'cd ~/wendo-rms && docker compose exec -T postgres psql -U wendo_user -d wendo_rms -v ON_ERROR_STOP=1' < remove-demo-data.sql

- `apply-demo-data.sql` ran on 6 Oct 2026. Safe to re-run.
- `rename-demo-markers.sql` swaps the old DEMO wording for the neutral wording above. Safe to re-run.
- `remove-demo-data.sql` lifts the ledger lock for its own transaction and **refuses to run if any real stock movement exists** in the ledger, so run it **before** anyone records real stock. After that, demo stock can only be corrected with take-back entries through the app. Back up first.

## After the demo
Remove the demo data before the client's staff start real counts, then delete the `Bash(ssh wendo *)` line from `.claude/settings.local.json` if it is no longer needed.

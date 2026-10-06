# Purchasing · receiving

Record a delivery against an approved or sent order. Rules: `docs/features/inventory/purchasing-mock/backend-rules.md` §5.

**Status:** built, tests green (6 Oct 2026). Not yet wired to the front end (step 4).

`POST /inventory/purchasing/orders/:id/receive` (capability `orders.receive`; the Store Attendant, Store Manager, System Admin).

```json
{ "lines": [{ "lineId": "…", "receivedQty": "10", "deliveredPrice": "1100", "priceConfirmed": true }],
  "deliveryNoteNo": "DN-77", "deliveryNotePhotoId": "<upload id>", "pin": "1234" }
```

- **Option A (owner decision):** the receiver types the supplier's price per line when it differs from the order's
  (`deliveredPrice`); a differing price needs `priceConfirmed: true` or the call fails with `PRICE_CHANGE_UNCONFIRMED`
  (`details.lineIds`). A line left out is received in full at the order's price.
- More than ordered: `RECEIVED_EXCEEDS_ORDERED`. No delivery note number or photo: `DELIVERY_NOTE_REQUIRED`. Nothing received at
  all: `VALIDATION` (cancel the order instead). A short delivery drops the missing quantity for good (Q-03).
- Own PIN, checked before anything is written (`INVALID_PIN`).
- One transaction: order to `DELIVERED` (guarded), `GRN-nnnn` from the counter, the delivery and its lines, each order line's
  received quantity, price and result, **one `postStockMovement` RECEIVE per received line** (usage units = buy quantity x pack;
  `unitCost` = confirmed price / pack, linked by `purchaseDeliveryLineId`), the item's `currentCost`, the supplier's last price
  (a matching pack line is updated, an item the supplier never sold us gets a line), and one audit row.
- Never `inventoryTransaction.create`: `ledger-guard.test.ts` enforces it.

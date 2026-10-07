# purchasing / needs-restocking

**Design:** approved (Paper steps 01, 02, 28; the supplier catalog on step 03) · **Code:** built (6 Oct 2026), not yet mounted in `routes/index.ts` (the purchasing router mounts every folder in the last step).

What needs buying, and what a supplier's catalog offers when an order is raised. Read-only.

## Rules
- An item **needs restocking** when it has a Central Store restock level above zero and on-hand (the ledger sum at the Central Store location) is below it, and it is not already on an open order (Draft to Sent, Q-07). **Out** when on-hand is zero or less, otherwise **Low** (`restockStatus`).
- **Suggested quantity** = round up of (level minus on-hand) divided by the pack, in whole buy units (`_shared/money.ts`). The pack is the supplier line's, else 1 when the line is sold in the unit we use, else the item's; unknown means no suggestion ("never bought before").
- **Default supplier:** the line marked preferred (or the item's preferred supplier), else the cheapest by last price; an unpriced line ranks last. One line per supplier is kept (preferred, else cheapest). Only active suppliers are offered (on hold and archived are not).
- Groups are by default supplier, most urgent first (Out before Low, then furthest below level); "No supplier yet" is last. Sorts: `urgent`, `name`, `value`. The `group` parameter is accepted and ignored: the screen re-groups the same data for "List by item".
- **Blind rule:** the Store Attendant gets the same list and the prices, but `onHand` and `level` are removed (stock figures). The suggested quantity is kept: it is how the phone fills the box when an item is ticked.
- The New-order catalog (`GET /catalog`) lists what one supplier sells: Low and Out by default, everything with `filter=all`. `filter=selected` is a screen-side state and behaves as the default.

## Endpoints (mounted under `/inventory/purchasing`)
| Method | Path | Capability |
|---|---|---|
| GET | `/needs-restocking` (`group`, `supplierId`, `q`, `sort`) | `orders.read` or `orders.request` |
| GET | `/catalog` (`supplierId`, `q`, `category`, `filter`) | `orders.request` |

The tab counts (`GET /summary`) live in `orders/` and call `needsRestockingService.countNeeds`.

## Differences from the mock's types (step 4 adapts the screens)
- `lastPrice` and `price` may be `null` (a supplier line never priced); the mock always had a number.
- `onHand` and `level` are optional (absent for the Attendant).
- "Setup incomplete" is not a list filter. An item is orderable when the supplier sells it with a price, or the person raising the order types a price; otherwise the order fails with `ITEM_SETUP_INCOMPLETE` (see `orders/`).

## Coupling
Reads `restock/restock-suggestion` (`restockStatus`), `repositories/location-repository` (Central Store location), and the `purchase_orders` tables (to leave out items already on an open order). The suggested-quantity and money maths are in `_shared/money.ts`.

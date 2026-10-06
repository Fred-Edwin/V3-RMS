# Purchasing · supplier account

What the supplier page shows about money and orders: the Orders tab with the owing card, and the statement of account.
Rules: `docs/features/inventory/purchasing-mock/backend-rules.md` §6 and §9 (statement).

**Status:** built, logic tested (6 Oct 2026). Not yet wired to the front end (step 4).

| Route (under `/inventory/purchasing`) | Capability | What |
| --- | --- | --- |
| `GET /suppliers/:id/orders` | `suppliers.read` | `{owing, orders[]}`; the owing card is blank for a caller blind to financial data |
| `GET /suppliers/:id/statement?from&to&format=json\|csv` | `payables.read` | the supplier's view of our account; `from` defaults to the first of last month, `to` to today |

- Open invoice = a live invoice with a balance (or in dispute). `owing` is the sum of balances after advances and payments;
  `overdue` is those past their due date; `late` buckets them 1 to 30, 31 to 60, 61 to 90, 90+ days.
- `creditHeld` is money paid that no invoice has used (an advance with no invoice, or what exceeds an invoice).
- Statement: an invoice is a **Credit**, a payment, advance or voided invoice a **Debit**. A voided invoice and a reversed
  payment stay on it struck through (`superseded`), with a line that cancels them. Opening balance is everything before `from`;
  ageing is open invoices by days past due at `to`.
- The Branch Manager reads both (`payables.read`) but the supplier's payment account detail is hidden by
  `suppliers.read_payment_details` (in `_shared/order-view.ts`, not here).
- The store reads at most 2,000 orders per supplier (a safety cap, far above real volume).

# Purchasing · payables

Advances, the supplier's invoice, disputes, voids, payments, reversals, the payment advice and extra documents on a purchase
file. Rules: `docs/features/inventory/purchasing-mock/backend-rules.md` §4 and §6.

**Status:** built, tests green (6 Oct 2026). Not yet wired to the front end (step 4).

| Route (under `/inventory/purchasing`) | Capability | What |
| --- | --- | --- |
| `POST /orders/:id/deposits` | `payables.record_deposit` | advance, `PAY-nnnn`; not above the order total (`DEPOSIT_EXCEEDS_ORDER`) |
| `POST /orders/:id/invoice` | `payables.record_invoice` | one live invoice per order; duplicate number warns; a differing amount needs a reason and is saved disputed |
| `POST /orders/:id/documents` | `record_invoice`, `record_payment` or `orders.approve` | "+ Add a document" |
| `POST /invoices/:id/settle-dispute` | `payables.record_invoice` | agreed amount and note; the dispute clears |
| `POST /invoices/:id/void` | `payables.record_invoice` | reason and own PIN; only while no payment stands; order back to Delivered |
| `POST /invoices/:id/payments` | `payables.record_payment` | cheque number for cheques; `PAYMENT_EXCEEDS_BALANCE` unless `confirmOverpay`; disputed invoices cannot be paid |
| `POST /payments/:id/reverse` | `payables.record_payment` | approver PIN (Store Manager or System Admin); adds `<ref>-R`, original marked Reversed |
| `GET /payments/:id/advice` | `payables.read` | print data; account detail only with `suppliers.read_payment_details` |

- After every change that touches an advance, a payment, a dispute or the invoice, `refresh` in the service recomputes the
  invoice (`OPEN` or `PAID`) and moves the order between To pay and Closed, in the same transaction.
- An advance is applied to the invoice up to its amount; the rest stays as credit with the supplier.
- Nothing is deleted: a void marks the invoice, a reversal adds a linked row. Every action writes a `PAYMENTS` audit row in the
  same transaction.
- Amounts are `Prisma.Decimal` (`_shared/money.ts`); they cross the wire as strings.

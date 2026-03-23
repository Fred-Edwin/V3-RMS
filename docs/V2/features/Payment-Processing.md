# Feature Spec: Payment Processing — Mpesa STK Push
## Wendo Coffee Bistro — RMS V2.3
**Status:** Draft — Critical open question (Daraja vs Pesapal) must be resolved before development
**Phase:** V2.3
**Last Updated:** 2026-03-22

---

## 1. Overview

V1 of the RMS handles payment recording but not payment initiation. For Mpesa, the waiter uses a separate Pesapal POS device to trigger the STK push, then manually marks the order paid in the RMS. This is a two-device, two-workflow process.

V2.3 brings Mpesa payment initiation directly into the waiter's app. The waiter enters the customer's phone number, the system triggers the STK push, the customer pays on their phone, and the order is automatically marked paid when the callback is received. No Pesapal device is needed for Mpesa transactions.

**Primary problem it solves:** Payment collection is disconnected from order management. Every Mpesa transaction requires the waiter to context-switch between the RMS and a POS device, then manually reconcile.

---

## 2. Actors

| Actor | Role | What They Do |
|---|---|---|
| Waiter | `WAITER` | Triggers STK push from the order detail screen |
| Branch Manager | `MANAGER` | Can also trigger STK push; views branch payment reports |
| Director | `DIRECTOR` | Configures per-branch Mpesa credentials; views cross-branch payment reports |
| System | — | Calls Mpesa API, receives callback, auto-confirms order |
| Customer | External | Receives STK prompt on phone, enters PIN |

---

## 3. Workflow

### 3.1 Waiter Initiates Payment

1. Waiter opens the order detail screen for a table that is ready to pay
2. Waiter selects **Mpesa** as the payment method
3. Waiter enters or confirms the customer's phone number (Kenyan format: 07XX or 01XX)
4. Waiter taps **Send Payment Request**
5. System normalises the number (07XX → 2547XX) and sends STK push via Mpesa API
6. Screen shows a waiting state: *"Waiting for customer to complete payment on their phone..."*

### 3.2 Customer Pays

1. Customer receives the Mpesa STK push prompt on their phone
2. Customer enters their Mpesa PIN and confirms
3. Safaricom processes the transaction and sends a callback to the RMS

### 3.3 Automatic Confirmation

1. Callback is received at `POST /payments/mpesa/callback` (public endpoint)
2. System matches the callback to the order via `mpesaRequestId`
3. If `ResultCode === 0` (success): order is marked paid, `paidAt` is set, Mpesa code is stored
4. A Socket.io `payment:confirmed` event is emitted to the waiter's session
5. Waiter's screen automatically updates to show the order as paid — no manual action needed

### 3.4 Failed or Expired STK Push

If the customer does not respond within **120 seconds**:
- Waiter sees a timeout prompt
- Options: **Resend STK Push** or **Switch Payment Method**
- Resend sends a new STK push to the same number (or a different number if the waiter updates it)

If the customer cancels the STK prompt (ResultCode !== 0):
- System emits `payment:failed` Socket.io event
- Waiter is notified immediately and offered the same Resend / Switch options
- Order remains unpaid — no automatic cancellation

---

## 4. Per-Branch Mpesa Configuration

Each branch operates with its own Mpesa till or paybill number linked to its own bank account. This gives the Director clean, branch-level financial visibility without manual reconciliation.

**Configuration stored per `Organization`:**
- `mpesaTillNumber` — the branch's Mpesa till or paybill number
- `mpesaConsumerKey` — Daraja API consumer key (or Pesapal equivalent)
- `mpesaConsumerSecret` — **NEVER logged, NEVER returned in API responses**
- `mpesaPasskey` — **NEVER logged, NEVER returned in API responses**

When a waiter triggers an STK push, the system automatically routes the request through the credentials for the waiter's branch (`user.organizationId`). The waiter never sees or selects credentials.

---

## 5. Card Payments

Card payments remain unchanged from V1. The waiter uses the Pesapal POS device and manually marks the order paid with `CARD` as the payment method. No changes are made to the card payment flow in V2.3.

---

## 6. Data Models

See `docs/V2/DATA_MODEL_ADDENDUM.md` Section 4.

Changes to `Organization`:
- Add `mpesaTillNumber`, `mpesaConsumerKey`, `mpesaConsumerSecret`, `mpesaPasskey`

Changes to `Order`:
- Add `mpesaRequestId` — the Daraja `CheckoutRequestID` used to match callbacks
- Add `mpesaCallbackRaw` (Json) — raw callback payload stored for audit

No new models needed.

---

## 7. API Endpoints

See `docs/V2/API_CONTRACT_ADDENDUM.md` Section 4 for full endpoint specs.

Key endpoints:
- `POST /payments/mpesa/stk-push` — waiter initiates
- `POST /payments/mpesa/callback` — **[PUBLIC]** Safaricom callback receiver
- `POST /payments/mpesa/stk-push/:requestId/retry` — resend
- `GET /payments/mpesa/status/:orderId` — poll for timeout handling
- `PUT /payments/mpesa/config/:organizationId` — Director configures credentials

---

## 8. Frontend Changes

**Modified screen:** `OrderDetailBottomSheet`
- Add Mpesa STK push option in the payment method selector
- Phone number input with Kenyan number validation
- Pending payment state (spinner, customer instruction text)
- Timeout countdown and Resend / Switch options at 120 seconds
- Auto-update to confirmed state on `payment:confirmed` Socket.io event

No new top-level pages required.

---

## 9. Security Considerations

- Mpesa credentials are never returned in any API response
- Credentials are never logged at any level (error logs, access logs, debug output)
- The callback endpoint is public — use IP whitelisting and/or Daraja callback signature validation
- Phone numbers are stored normalised (2547XX format) — do not log raw customer phone numbers in error messages

---

## 10. Open Questions — Must Resolve Before Development

| # | Question | Impact |
|---|---|---|
| 1 | **Daraja direct vs Pesapal intermediary** — which integration approach? | Determines the entire backend integration architecture for this phase |
| 2 | **Till number vs paybill per branch** — which Mpesa structure does Wendo use? | Determines how STK push requests are structured per branch |
| 3 | **STK push timeout** — is 120 seconds the right window, or does Wendo want a shorter/longer timeout? | Determines frontend timer and retry UX |
| 4 | **Card payments long-term** — does Wendo want a software-based card option in a future phase, or is Pesapal hardware the permanent solution? | Not a V2.3 blocker, but useful for long-term planning |

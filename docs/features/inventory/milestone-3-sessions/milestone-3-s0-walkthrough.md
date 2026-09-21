# Milestone Three (Prep) — S0 Walkthrough

For the owner to manually verify what was built in this session: schema,
5 backend endpoints, and 8 frontend screens (4 screens × 2 breakpoints) for
Prep run recording. Follow this in order — it starts servers, gets you a
`PREPPED` output item to test with, then walks the full Flow 3 happy path
plus the History/detail views.

---

## 1. Start the stack

Postgres and Redis run in Docker; the API and frontend run as local dev
processes (not Docker — this repo's Docker Compose expects a prebuilt image
that isn't available locally).

```bash
cd ~/Projects/V3-RMS
docker compose up -d postgres redis
```

Backend (new terminal or background):

```bash
cd ~/Projects/V3-RMS/backend
npx tsx watch src/server.ts
```

Wait for it to come up, then confirm:

```bash
curl -s http://localhost:4000/api/v1/health
# {"status":"ok","timestamp":"...","services":{"database":"up","redis":"up"}}
```

Frontend (another terminal or background):

```bash
cd ~/Projects/V3-RMS/frontend
npx next dev -p 3000
```

Wait for `http://localhost:3000/login` to respond, then open it in your
browser.

**Gotcha:** if you ran `pnpm build` in `frontend/` at any point while the dev
server was already running, the dev server will start 404ing on its own JS
chunks (a stale `.next` production build colliding with the dev server). If
that happens: kill the dev server, `rm -rf frontend/.next`, restart
`next dev`.

---

## 2. Log in

Use the seeded Store Manager account (hub org, full access to Prep):

- **Email:** `store.manager@wendo.test`
- **Password:** `password123`

(There's also `store.attendant@wendo.test` / `password123` if you want to
check the Attendant view — Prep shows identical data to both roles, no
role-based narrowing.)

---

## 3. Get a PREPPED item to test with

Prep runs need an **output item** that's catalogued as type `Prepped`. If
none exists yet in your local DB:

1. Go to **Catalog** in the left nav.
2. Click **New item**.
3. Fill in:
   - **Name:** anything, e.g. `Grilled Chicken Portion`
   - **Type:** `Prepped`
   - **Buy unit:** `kg` (not really used for a prepped item, but required)
   - **Usage unit:** `portion` (or whatever unit makes sense — this is what
     shows up as the yield unit everywhere)
4. Click **Create item**.

You'll also want at least one **input item** with some stock to consume —
any existing raw ingredient works (e.g. `Onions`). Negative stock is allowed
by design (Flow 21), so it doesn't matter if the input runs low or negative
after the prep run — that's expected behavior, not a bug.

---

## 4. Walk Flow 3 — record a prep run

1. Click **Prep** in the left nav (Central Store section). You should land
   on the **Prep runs list** — a KPI strip (Runs this week / Yield flags /
   Prep value) and a "Recent runs" table with Output/Flagged-only filters
   and a "View all →" link to History.
2. Click **New prep run** (top right). A drawer opens.
3. **Output item:** type to search, pick the Prepped item from step 3.
   - If this output already has prior runs, you'll see a blue "Typical: ~X →
     ~Y" nudge appear — this is the rolling-average hint, purely
     informational, never blocks anything.
4. **Inputs consumed:** click **+ Add input**, search for your input item
   (e.g. Onions), pick it, then enter a quantity in the row that appears.
   Add more input lines the same way if you want.
5. **Actual yield:** enter a number (the quantity produced, in the output
   item's usage unit — shown read-only next to the yield field).
6. Watch the **Output unit cost** footer update live as you type — it's
   computed client-side as a preview (`Σ input cost ÷ yield`); the real
   persisted value is computed server-side inside the same transaction that
   writes the ledger rows, so it should match exactly once confirmed.
7. Click **Confirm run**. No PIN, no signature step — Flow 3 is explicit
   that a prep run's ledger record itself is the accountability mechanism
   ("the ledger records who and when").
8. You're back on the Prep runs list — your new run appears in the table,
   and the KPI strip updates (Runs this week, Prep value).

---

## 5. Verify the ledger effect (optional, for confidence)

If you want to confirm this actually wrote to the stock ledger correctly
(not just the UI), check Postgres:

```bash
docker exec wendo-postgres psql -U wendo_user -d wendo_rms -c "
SELECT ii.name, it.type, it.quantity, it.unit_cost
FROM inventory_transactions it
JOIN inventory_items ii ON ii.id = it.inventory_item_id
ORDER BY it.created_at DESC LIMIT 5;"
```

You should see one `PREP_CONSUME` row per input line with a **negative**
quantity, and exactly one `PREP_PRODUCE` row for the output with a
**positive** quantity equal to what you entered as actual yield. This
sign convention matters — `PREP_CONSUME` is the first negative-signed
ledger writer in the codebase, and everything downstream (on-hand
calculations) depends on it being right.

---

## 6. Open the detail drawer

Click on the row you just created (anywhere in the row, not a specific
button). A read-only drawer opens showing:

- **When / Recorded by / Yield vs average** strip at the top
- **Output produced** block (item name + yield)
- **Input consumed** table (item, qty, cost per line)
- The typical-yield context note, if this output has prior-run history
- **Output unit cost** footer with the `Σ input cost ÷ yield` formula
- A **Close** button — this record is immutable, there's no edit action
  anywhere on this screen by design

Click **Close** (or the × ) to dismiss.

---

## 7. Browse Prep History

1. Click **View all →** on the runs list, or **Prep** → look for the
   history link, or navigate directly to `/app/inventory/prep/history`.
2. You'll see a KPI strip scoped to the current filter range (Runs in
   range / Total input cost / Yield flags), a search box, an Output filter,
   a Yield-flag filter, and a date-range picker.
3. Try:
   - Searching by output name or attendant name.
   - Filtering by output item.
   - Filtering by yield flag (Normal / Low yield / High yield) — you likely
     only have "Normal" runs unless you've deliberately entered a yield far
     off the rolling average (±15% triggers a flag, ±35% additionally marks
     `notifiedStoreManager` — no actual notification is sent, that's
     explicitly out of scope this milestone).
   - Clicking a row opens the same detail drawer as step 6.
4. **Clear filters** appears once any filter is active, resets everything.

---

## 8. Mobile check (optional)

Resize your browser window below ~1024px wide (or use DevTools device
emulation). The same 4 screens render as:

- **Prep runs list** → card list, "New prep run" as a full-width button
- **New prep run** → full-screen form (not a drawer)
- **Prep run detail** → full-screen read-only view
- **Prep History** → card list with the same filter chips, stacked

Behavior is identical to desktop — same hooks, same backend calls, same
validation.

---

## 9. What to look for / known rough edges

- **Two-stage prep is allowed** — you can pick an input item that is itself
  the output of an earlier prep run. Try prepping something, then use that
  same item as an input on a second run, to confirm this isn't blocked.
- **Yield-variance thresholds are hardcoded constants** (±15% warn, ±35%
  notify-SM), not yet configurable — this was an explicit, resolved design
  decision (plan §6 Q1), not an oversight.
- **No reference number** on prep runs (no `PREP-0001` style tag) — also
  deliberate, checked against all 8 approved Paper screens, none show one.
- **Screen-mirroring loading skeletons** were added this session (KPI strip
  + table shape, both breakpoints) — to see them, throttle your network in
  DevTools (Network tab → "Slow 3G" or similar) and reload the Prep or
  History page; on a fast local connection the loading state is too brief
  to see normally.

---

## 10. Shutting down

```bash
# Ctrl+C both the backend and frontend dev processes, then:
docker compose down
```

(Or leave Postgres/Redis running if you're coming back to this soon —
they're cheap to keep up.)

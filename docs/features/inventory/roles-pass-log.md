# Central Store — roles pass log (3 Oct 2026)

Branch `feat/central-store-roles-pass`. Covers the four rebuilt features: catalog, restock levels, suppliers (with what we owe) and the audit log.

## What was built
- **One permissions table**: `backend/src/modules/inventory/_shared/central-store-access.ts`, role by capability. Route guards (`requireCapability`), service guards (`requireHubReader` for reads, `requireHubActor` for writes) and the front end all read it. Rule agreed with the owner: every desktop role reads every Central Store screen; write belongs to whoever does the job; the Branch Manager does not see supplier payment details; the System Admin reads and writes everything; the Accountant writes supplier invoices.
- **`GET /inventory/permissions/me`** returns the caller's capabilities. The front end keeps only the capability *names* (`_shared/lib/capabilities.ts`); a backend test fails if the two lists differ.
- **Hub rule D-15**: reads may come from outside the hub for roles holding `central_store.read_any_org`; writes still need the hub org, except the System Admin, who belongs to no organization.
- **Front end**: a Central Store sidebar section for the Branch Manager, Accountant, Director and System Admin (their own shells); the inventory sidebar is built from role and capabilities (`_shared/lib/nav-groups.ts`) with a "My dashboard" way back; the page gate in `middleware.ts` admits the desktop roles to the rebuilt screens; catalog, restock levels, suppliers and audit log obey capabilities (read-only item panel and restock table, no Payment tab for the Branch Manager, Record invoice/payment by capability).
- Item history and the change-review are not for the attendant; a department head's item list is price-free.
- Fixes on the way: the Audit log link bounced the Accountant and Director and let the Attendant onto a URL the API refused (the gate had no audit-log rule); both fixed.

## Decisions I took
- **Old-flow screens keep their role lists** (Receiving, Purchasing, Prep, Dispatch, Stock & counts, Reports, Settings) until their own rebuild; the sidebar shows them only to the Store Manager and Attendant as before. The System Admin and the other desktop roles reach the rebuilt screens only for now.
- **"Restock levels" is now a sidebar item** (it was reachable only from the item panel) for everyone who may read it.
- **Item history needs the right to see costs** (its sentences name prices), so the attendant gets none.
- **`paymentMethodCount`** was added to the supplier detail so the profile checklist stays right when the methods themselves are hidden.
- Local account created: `admin@wendo.test` (System Admin, password `password123`), local database only.

## Tests
- Backend: 109 files, 1570 tests (new: the table, both guards, route guard, front-end name match, supplier roles, restock read-only and System Admin, department-head price-free list; the role-matrix tests were rewritten to the new table).
- Front end: 23 files, 192 tests (new: sidebar rules, profile checklist with hidden methods). `next build` (from a scratch copy), `check-wds-tokens`, ESLint on every changed file, `tsc` all clean.

## Browser and API results (real data)
Status matrix against the running API (store manager / attendant / accountant / director / branch manager / admin / kitchen head):

| Call | SM | SA | ACC | DIR | BM | ADM | DH |
|---|---|---|---|---|---|---|---|
| items list | 200 | 200 | 200 | 200 | 200 | 200 | 200 (price-free) |
| suppliers list | 200 | 200 (stripped) | 200 | 200 | 200 | 200 | 403 |
| supplier detail | 200 | 403 | 200 | 200 | 200 | 200 | 403 |
| payment methods | 200 | 403 | 200 | 200 | **403** | 200 | 403 |
| what we owe | 200 | 403 | 200 | 200 | 200 | 200 | 403 |
| restock levels (read) | 200 | 403 | 200 | 200 | 200 | 200 | 403 |
| audit log | 200 | 403 | 200 | 200 | 200 | 200 | 403 |
| edit a supplier | ok | 403 | 403 | 403 | 403 | ok | 403 |
| record an invoice | ok | 403 | ok | 403 | 403 | ok | 403 |
| change restock levels | ok | 403 | 403 | 403 | 403 | ok | own dept only |

In the browser: Branch Manager (Central Store section in the manager sidebar; supplier page without Payment tab, edit or record buttons; still sees what we owe); Accountant (audit log opens, Payment tab and Record invoice/payment present, no edit/hold/archive, read-only item panel); System Admin (every write control); Store Manager (everything as before, plus the Restock levels link); Store Attendant (sidebar unchanged, redirected from suppliers, audit log and restock levels, no KES on the catalog).

## Surprising
- The first load of a supplier page as the Branch Manager bounced to their dashboard once, while the dev server was compiling the changed middleware; later loads were fine. The "Daily summary failed" toasts on the manager dashboard come from that page's own request, not from this change.
- `tsx watch` on this machine does not reload edited backend files, so my backend process is restarted by hand after edits.
- `CLAUDE.md` now says to edit files only with the Edit/Write tools. This pass started with scripted edits and finished with the tools.

## Deferred
- Move Receiving, Purchasing, Prep, Dispatch, Stock & counts, Waste and Reports onto the table as each is rebuilt (the sidebar and gate have a place for them).
- The System Admin signing old-flow documents with their own PIN: those flows are not on the table yet.
- Phone versions for the desktop roles (owner: after the whole inventory feature is built).
- The Accountant's and Store Manager's real names in the phone notes (needs a backend field).

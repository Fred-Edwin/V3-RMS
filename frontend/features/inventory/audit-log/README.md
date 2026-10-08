# audit-log (frontend)

The Audit log screen (Paper chapter 8, step 35; Area menu and date range, steps 58 and 59): `components/screens/audit-log-screen.tsx`, route `/app/inventory/audit-log`, sidebar link "Audit log" (Store Manager, Accountant, Director; hidden from the Store Attendant).
Backend and behaviour: `backend/src/modules/inventory/audit-log/README.md`. Endpoint: `GET /inventory/audit-log` (API_CONTRACT §30.12).

- Filters: **Area** menu (`components/area-menu.tsx`: All areas, Central Store areas, Branches areas; "Purchasing and payments" opens the purchase file's own log), **Branch**, **Who**, and the shared date range picker (`components/ui2/date-range-picker.tsx`; starts on today, no "Any time"). All of it, with the page and rows per page, lives in the URL (`area`, `branch`, `who`, `from`, `to`).
- Columns: When, Who, Area, What (with the reason underneath for the older areas), Record (a link: the count, the item's stock card on that day, the ADJ number, or the purchase file).
- Not drawn in code yet, but in Paper: the search box ("Search a record or a person") and the person's role under their name. Both need a back-end change and are logged as gaps G17 and G18 in `docs/features/inventory/role-coverage.md` for the batched back-end session.
- The five Branches areas show "Nothing here yet" until each block adds a source.

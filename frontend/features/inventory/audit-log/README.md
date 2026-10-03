# audit-log (frontend)

The Audit log screen (Paper chapter 8, step 35): `components/screens/audit-log-screen.tsx`, route `/app/inventory/audit-log`, sidebar link "Audit log" (Store Manager, Accountant, Director; hidden from the Store Attendant).
Backend and behaviour: `backend/src/modules/inventory/audit-log/README.md`. Endpoint: `GET /inventory/audit-log` (API_CONTRACT §30.12).
Chips: the three areas together or one at a time; Who and When are menus (Today, Last 7 days, Last 30 days, Any time).

# Decisions: People batch 4 (desktop "My ..." screens)

| question | choice | why | what changing it takes |
|---|---|---|---|
| Header of My file | Plain header (no dark card) on desktop and phone | Frames 13.3 and 13.14 draw plain; Paper wins over the 22 Oct note that kept the dark card | Swap `own-header.tsx` |
| Sign out everywhere | Reuses the "This wasn't me" server step | The owner asked to reuse it. Side effects are the same: every session ends, code cleared, phones removed, System Admin told, new password needed | A lighter endpoint with its own audit entry |
| After pressing it | This device goes straight to the new-password page | The sign-in just ended, so nobody is left on a dead page | n/a |
| Change password | Small dialog (current, new, again) using the old Profile endpoint | Profile page removed; the endpoint is unchanged | n/a |
| Notifications row | Reads the browser's own permission; "Turn on" asks for it | Same hook the Profile page used | n/a |
| Change my photo | Amber link under the position once a photo exists | Frame draws no way to change a photo; the Add row covers the first one | Remove link |
| Legacy links to /app/profile | Dashboard cards point to My file; the inventory fix sheet points to Inventory settings (where the signing PIN card lives) | Profile is gone | n/a |
| Payslips on desktop | `/my-payslips`, `/history` and `/[id]` all show the one page; an id opens the drawer. A phone keeps its pages | Frames 13.9, 13.10 | n/a |
| Payslip is read only when the drawer opens | Detail is fetched only when opened | Opening a payslip is audited | n/a |
| Notices on desktop | Three figures are always To sign, Can appeal, Ended | Frame 13.11; the phone band still lets the server choose | n/a |
| My leave "Search a request" | Not built | No search for a person's own requests on the server (backend gap, batched) | Add `q` to the own-requests read |
| Activity "By" column | Shows the entry's grey line | The list has no separate "by" field | Add a field to the list answer |
| Notification links to Activity | Go to Activity on my record | It exists now, My phones is gone | n/a |
| Demo seed | A rule that already matches is skipped | The defaults moved, the seed stopped on a 409. Seed needs `API=http://localhost:4104` for lane 4 | n/a |
| Shared kit change | `WorkforceDrawer` takes an optional `width` (default 480) | One payslip is 560 | n/a |

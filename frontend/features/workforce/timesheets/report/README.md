# Timesheets · report (TSH-n)

**Spec:** Paper Chapter 8 step 5. **Status:** built, awaiting review (19 Oct 2026). **Endpoints:** P1 (the report), P2 (sign), P4 (reopen).

`/app/workforce/timesheets/report?period=<id>`: a bare page (no sidebar), the kit's landscape printed document. The status stamp (open, closing, closed), six figures, the people table with "Decided by", a line counting the people the system alone approved (as Paper does), and what moved on to the next month. After the close the Branch or Store Manager (or HR, or the System Admin) signs with their **PIN** (the fourth digit signs, Enter never does; a wrong PIN is refused in words with no lockout); the signature shows the first and second name, the full name in the line under it. HR can reopen from here. Payroll's receipt is recorded on this page once payroll exists (slice 6); until then the footer says so. **Hours only; no pay figure.** The same file is the Export (CSV, every person, hours as h:mm).

| Piece | File |
|---|---|
| Page | `components/report-screen.tsx` |
| Figures and table | `components/report-table.tsx` |
| PIN dialog | `components/sign-dialog.tsx` |
| Words, CSV, the status line | `lib/report-view.ts` |

**Coupling:** the reopen dialog from `periods/`; the kit's `WorkforceDocument`, `DocumentCanvas` and `WorkforcePinDialog`.

# Workforce · Payslips (Segment 3, back end)

**Status:** built 20 Oct 2026 on `feat/workforce-3-payslips-backend` (not pushed, awaiting the owner's review). Spec: `docs/features/workforce/specs/3-payslips-spec.md` (S1 to S6, S11, S12). Decisions and the list of what this assumes about Payroll part 2: `docs/features/workforce/decisions-3-payslips-backend.md`.

## What it does

What staff see of their pay, behind a server-enforced code, and the documents.

- **The code** (PD1 to PD4, PD7): the person's own 4-digit PIN. One right code opens My payslips on that phone; it relocks on Lock, after 10 minutes without a tap, or at the 8 hour cap. Every try is recorded (never the digits). Nobody is locked out: from the 5th wrong try in 15 minutes an answer waits 2, 4, 8, 16, then 30 seconds. The 3rd wrong try tells the System Admin and the person, once per window.
- **Staff reads**: the list (no amounts, no code needed), home, history, one payslip (this month and year to date, each line with its working), versions, the stored A4 file. Only the signed-in person's own; anyone else's is a 404.
- **HR and the Accountant** open anyone's published payslip with no staff code (`payslip.read_any`); each opening is audited and counted for the Director's daily digest (PD5).
- **The old-payslip card** (PD12): `legacy` on the list, home and history.
- **The P9** (PD13, PD14): status, a gated and stored A4 card, the Accountant's one-time format confirmation, HR's build for a leaver.

## Folders

| Folder | What lives there |
|---|---|
| `unlock/` | The pause and window rules (pure), tries and tokens, the unlock middleware, the first code, Lock, the phone-confirmation hook. |
| `reads/` | The records of a person's published months, the view maths (pure), the detail builder, legacy card, staff and HR reads, the opening audit and the Director's digest, the publication seam. |
| `documents/` | The A4 payslip model and drawing, stored once with its hash. |
| `p9/` | The layout (structure only), availability rules and month rows (pure), the model, drawing, repository and service. |

## Endpoints

Base `/api/v1/workforce/payslips`. Headers for staff reads that show pay: `x-payslip-unlock` and `x-device-id`. Full table: `docs/API_CONTRACT.md` §41.

## Seams with Payroll part 2

`setPublicationSource` (published, paid, pay day, paid date), `ensureFileForPayslip` (make the A4 file at publish or correction), `setDeviceConfirmationSource` ("Is this your phone?"). Defaults work on part 1's data.

## Tests

Pure: `unlock-rules`, `payslip-model`, `p9-rules`, `p9-model` (in the time-zone script). `payslips-routes.test.ts` (staff, HR, Accountant, Director, System Admin; UNLOCK_REQUIRED). `payslips-flow-db.test.ts` (12 database flows; export `DATABASE_URL` for a `_lane` database and run it alone). Proof over HTTP with real logins: `src/scripts/payslips-casual-proof.ts` (95 checks).

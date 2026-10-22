# Workforce · Payslip openings (the Director's digest)

Status: built (21 Oct 2026, branch `feat/workforce-6b-shared-frontend`, not pushed). Spec: `6a-audit-and-security-spec.md` A9. Back end: `GET /workforce/payslips/opens?from&to`.

**Batch 2A (22 Oct 2026): `home/cards/audit-cards.tsx` is deleted and the Director's Home no longer draws this card; the digest component stays here until the Audit log redo decides where it goes.** It was a side card on the Director's Home, registered as `workforce.payslip-openings` (held by `audit.read.payslip_access`). Last 7 days, newest first, one row per opener with the count and the time span; a row opens the Audit log on that opener and day. Counts and times only, never an amount. **A week with no openings draws no card** (so an empty lane shows nothing); with data the card was covered by unit tests only, not seen in the browser, because the lane has no payslips.

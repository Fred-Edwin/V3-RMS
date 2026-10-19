# Timesheets · approve the month

**Spec:** S7; Paper Chapter 12 step 11. **Status:** built (19 Oct 2026, not pushed, awaiting review). **Endpoint:** MO6.

`components/approve-dialog.tsx`: reads the month's totals again on open, shows hours, overtime authorised, late and absent, what is still to decide, the note about other branches, the PIN. Blocked (D1) while things are undecided, with the reason and "Show them" (closes and sets the Needs you chip); also blocked for an open month and a month with nobody in it. The totals shown travel with the PIN so the server refuses if anything moved ("Something changed while you were looking"). One idempotency key per dialog; "approved a moment ago" closes as success. Enter never signs; the last PIN digit enables the button. `lib/approve-view.ts` holds the blocking rule, the server's refusal words and the date reason shown under the page's disabled button.

**Coupling:** `months/` opens it; the server decides who may approve (the month's `capabilities.canApprove`).

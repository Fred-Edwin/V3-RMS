# Timesheets · export

**Spec:** S3 and section 10; Paper Chapter 12 steps 04 to 07. **Status:** built (19 Oct 2026, not pushed, awaiting review). **Endpoint:** MO7 (the file itself, with `Content-Disposition` and `X-Document-Number`). Decisions: F1 to F3.

`components/export-menu.tsx` (a dialog): PDF or Excel, the whole month or the range now selected (or one person from the full-month page), a line saying whether the file will be "Draft, not approved" or carry the signature and number, "Preparing…", a "Still preparing" line after 10 s, the offline state, and a failed export in the server's words with its code. `lib/export-file.ts` hands the blob to the browser. The file never contains a pay figure.

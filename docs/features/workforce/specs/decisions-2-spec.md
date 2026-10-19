# Segment 2 (Payroll): spec decisions

19 October 2026. Written by the spec session for `2-payroll-spec.md` and `2-payroll-engine-and-rollout.md` (E1 to E12). Each row is a question Paper left open or production needs answered, my recommendation (already written into the specs), why, and what changing it takes. The owner can change any row. Nothing is built.

| # | Question | Choice | Why | What changing it takes |
|---|---|---|---|---|
| P1 | **Rollout: which sites are in a Payroll month, and how is nobody paid twice?** | Only sites whose attendance switch is on and that approved their timesheets. A person is covered by exactly one system per month, decided by their site. The old payslip code gets a small additive guard (`isSitePeriodOnNewPayroll`, refuses save, publish and revert for a site-month the new Payroll covers; a site that was ever in Payroll never returns to the old run). Legacy tables untouched. | A site that is off has no approved hours; one rule in one place is the only safe way to avoid double pay. | The guard function and four lines in the old service. |
| P2 | Pilot order | Nyeri Town alone first; others join month by month. | Owner's pilot. | None. |
| P3 | Past months in the months list | Only new-system months; old months stay on the old pages. | No migration of old payslips. | A read-only history adapter over `payslips`. |
| P4 | A site that never approves | After 5 days past month end the Director may approve that site's month for it (1A approve dialog, extra line, the Branch Manager is told). HR still cannot. | Otherwise one absent manager blocks 85 salaries. | Drop the Director action and accept the wait. |
| P5 | Who calculates and when | The system, automatically within 15 minutes of the last included approval; HR may `Calculate again` in review. | Owner: the system calculates. | The trigger job. |
| P6 | Tax tables not confirmed | Month stays WAITING with its own banner; Accountant sees `Confirm the tax tables`. | Tables ship empty. | None. |
| P7 | Engine | Pure, table-driven, no tax name or rate in code; tables carry `kind`, `base`, `reducesTaxable`, `isIncomeTax`, employer share. Structure only; the Accountant hand-checks the first month. | Owner's engine rule; law changes. | Table schema fields. |
| P8 | Rounding | 4 decimals inside a line, each stored line rounded half up to 2 decimals, totals are sums of stored lines, PAYE and statutory rounded per person. | A payslip must add up. | Constants. |
| P9 | Hours source | `getApprovedHours` plus the 1A frozen snapshot (late, absent, leave); never raw clock events. | Approved truth only. | None. |
| P10 | Overtime pay | Only **authorised** minutes, for `overtimeEligible` staff, by the day's type multiplier (confirmed). | 1B rule: paid only when a manager authorises. | None. |
| P11 | Absence divisor | A Leave-group field `unpaidDayDivisor`, default 30 (Paper: Basic ÷ 30). | Paper shows an Absence v1 card but Rules has no such tab. | One field in Rules Leave. |
| P12 | Lateness pay | By minutes at the hourly rate from the counted day on, capped by `% of basic`; no flat amount per day. | The rule has no amount field. Paper's 410 to 205 implies a flat figure (see inconsistency 11). | One new Lateness field. |
| P13 | Total cost | gross + employer shares + casual memo. | Employer contributions are a real cost; Paper shows none because the sample has none. | A flag. |
| P14 | Adjustments | HR can add one line per person in review (allowance, incentive, arrears, advance repaid, HELB, other) with reason and PIN; recurring deductions are re-entered monthly for now. | Real months need them; Paper draws none. | A recurring-lines table later. |
| P15 | People left out | A person with no pay profile is left out, shown in their own row, paid next month via an `ARREARS` review line. | Paper step 17. | None. |
| P16 | First month | Accountant must tick `I checked at least 3 payslips by hand` before approving the first month of any site; a hand-check drawer helps. | Owner: check the first month against a hand calculation. | Remove the checkbox. |
| P17 | Review lines | Blocking kinds (cannot send) vs tick kinds; `BIG_CHANGE` threshold 25%; overtime above 50% of basic. | Paper lists five lines only; production needs a defined set. | Constants. |
| P18 | Accountant doubts | `Send back to HR` with a reason, no PIN. | Without it the only options are approve or a developer. | Drop the button. |
| P19 | Tag after publish | "To pay" (step 20), not "Published" (step 27). | Same state drawn twice. | Wording. |
| P20 | Approver separation | The approver is never the user who sent, recalculated or ticked a line. | Owner: nobody approves what they prepared. | None. |
| P21 | Correction kinds | Late days, unpaid absence, overtime authorised, basic for the month, an extra line; live NOW/CORRECTED preview; recomputed with the month's frozen rules. | Paper shows one (late days). | Add kinds. |
| P22 | Correction by the corrector's own payslip | Refused; the other role does it. | Separation. | None. |
| P23 | Bank file | Generic CSV behind a `BankFileFormat` interface, replaceable per bank; Mark as paid needs a non-voided download; people without a bank account block it. | Format is a business choice. | A new format file. |
| P24 | After Paid | `409 MONTH_LOCKED` on every write; mistakes become a next-month line or the developer. | Owner. | None. |
| P25 | Tabs | Enabled when there is something to show (Totals from Calculated, Payslips from Approved) for every reader. | Paper dims them inconsistently. | One map. |
| P26 | Separate Payslips menu link | Removed; Payslips is a tab. | One page per month. | `nav-table` row. |
| P27 | Employer contributions on pages | Shown as a row and box only when a table has an employer share. | Do not invent. | None. |
| P28 | Director's estimate | Computed from profiles, spells and authorised overtime, gross only, nightly at 00:30, stored; never exported. | No approved timesheets exist in an open month. | Job time. |
| P29 | Exports and stamps | Draft until approval, `APPROVED`, then `APPROVED · PUBLISHED`, then `APPROVED · PAID`; corrections create revisions of the snapshot, signature stays on revision 1. | Documents must not change. | Copy. |
| P30 | Who exports | Accountant, HR, Director; bank file only the Accountant; Branch Managers and System Admin none. | Owner. | One grant. |
| P31 | Capabilities | `payroll.*` replace `payrun.*`; `payrun.reopen` deleted. | Owner: no reopen. | The access table and its test. |
| P32 | Notifications | Never pay figures; staff told on publish, correction and paid; Accountant told on send and on voided file; sites reminded at most once per 24 h. | Owner. | Wording table. |
| P33 | Empty and non-started states | `Payroll has not started yet` until a first month exists. | A new install has none. | Copy. |

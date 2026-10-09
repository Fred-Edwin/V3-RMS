# Waste (front end)

Central Store waste. Contract §4.3 (W1 to W4); `_shared/services/waste-api.ts`. No PIN anywhere. `department/` holds the Department Head's branch waste (moved unchanged). `/stock/waste` shows the phone "My waste, today and earlier" (step 54, `entries/components/my-waste-screen.tsx`) when the list carries no `kpis`, the desktop Waste when it does. Step 54 reads W3 with `from` and `to` (starting at the last 7 days, in the URL), groups by the Nairobi day logged, shows Reverse only where the server says `can.reverse` (own entry, same day), and strikes through reversed entries (text uses `copy-faint` for contrast, not Paper's #8D8982). Fifty entries a page; the heading count is per page.

| Step | Paper node | Route | Verdict |
|---|---|---|---|
| 16 Pick what was wasted | `1ZC8-0` | `/stock/waste/new` | built; not compared |
| 17 How much and why | `1ZDQ-0` | quantity sheet | built; not compared |
| 18 Check, then confirm | `1ZFH-0` | review step | built; not compared |
| 19 My waste today | `1ZGW-0` | replaced by step 54 | superseded |
| 54 My waste, today and earlier | `2OYW-0` | `/stock/waste` (Attendant); real Reverse walked | numeric at 390 and by eye, matches; 768 and 1024 checked |
| 20 Reverse (phone) | `1ZJR-0` | reason sheet | built; not compared |
| 21 Waste (desktop) | `1ZLU-0` | `/stock/waste` | by eye, close |
| 22 Log waste drawer | `1ZS7-0` | `?drawer=log` | built; not compared |
| 23 Reverse any entry | `2008-0` | dialog | built; not compared |

Logged request (owner, 8 Oct 2026, not built): a date picker on the Waste page that selects any date or range, reusing the ledger's `DateRangePicker` (`stock/history/components/date-range-picker.tsx`). It was built and reverted (commits `7d136ee`, `6d7538c`) because the frozen W3 contract takes only `period`. To do it: amend W3 with `from` and `to` (`YYYY-MM-DD`, Nairobi days), then add the picker above the table, write `?period=custom&from=&to=`, and refetch on a range change (the table's query key ignores `from`/`to`, so tie its `refreshToken` to them). The KPI strip would keep its fixed periods.

Needs owner decision: N3 (no value on the Attendant's phone screens) applied.

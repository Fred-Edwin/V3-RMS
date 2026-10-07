# Waste (front end)

Central Store waste. Contract §4.3 (W1 to W4); `_shared/services/waste-api.ts`. No PIN anywhere. `department/` holds the Department Head's branch waste (moved unchanged). `/stock/waste` shows the phone "My waste today" when the list carries no `kpis`, the desktop Waste when it does.

| Step | Paper node | Route | Verdict |
|---|---|---|---|
| 16 Pick what was wasted | `1ZC8-0` | `/stock/waste/new` | built; not compared |
| 17 How much and why | `1ZDQ-0` | quantity sheet | built; not compared |
| 18 Check, then confirm | `1ZFH-0` | review step | built; not compared |
| 19 My waste today | `1ZGW-0` | `/stock/waste` (Attendant) | built; not compared |
| 20 Reverse (phone) | `1ZJR-0` | reason sheet | built; not compared |
| 21 Waste (desktop) | `1ZLU-0` | `/stock/waste` | by eye, close |
| 22 Log waste drawer | `1ZS7-0` | `?drawer=log` | built; not compared |
| 23 Reverse any entry | `2008-0` | dialog | built; not compared |

Logged request (owner, 8 Oct 2026, not built): a date picker on the Waste page that selects any date or range, reusing the ledger's `DateRangePicker` (`stock/history/components/date-range-picker.tsx`). It was built and reverted (commits `7d136ee`, `6d7538c`) because the frozen W3 contract takes only `period`. To do it: amend W3 with `from` and `to` (`YYYY-MM-DD`, Nairobi days), then add the picker above the table, write `?period=custom&from=&to=`, and refetch on a range change (the table's query key ignores `from`/`to`, so tie its `refreshToken` to them). The KPI strip would keep its fixed periods.

Needs owner decision: N3 (no value on the Attendant's phone screens) applied.

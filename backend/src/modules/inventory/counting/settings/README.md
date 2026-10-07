# counting / settings

**Design:** approved (Paper: *Inventory · Counting redesign (Oct 7)*, step 25 Count settings, step 45 Count settings as the Director) · **Code:** built.

## What it does
The numbers a count is judged against, for the Central Store: the **range** (a difference is within range when BOTH "worth up to KES …" and "at most … %" hold), the **repeat-shortfall** switch (flag an item short in 3 counts in a row), and the **Director alert amount**. A what-if preview shows how the last seven days would have gone. The hub's one `counting_thresholds` row holds them; with no row the defaults apply (KES 500, 5 %, repeat on, alert KES 5,000).

Changing a number applies **from the next signed count**: every signed count froze the settings it was judged against (`counts.range_kes`, `range_percent`, `director_alert_kes`, `flag_repeat`), so nothing already signed moves.

## Who can do what
| Who | Can |
|---|---|
| Store Manager, System Admin | read; save the range, the percent and the repeat switch (`counts.setup`) |
| Director, System Admin | read; save the alert amount (`counts.set_director_alert`) |
| Accountant, Branch Manager | read (`counts.read`) |
| Store Attendant | nothing here (403) |

Reads use `requireHubReader`, writes `requireHubActor`. No `requireRole`.

## Endpoints (base `/api/v1/inventory/stock`)
| # | Method | Path | Cap | Notes |
|---|---|---|---|---|
| C23 | GET | `/count-settings` | `counts.read` | the numbers in force, who set each and when, and `can.editRange` / `can.editDirectorAlert` |
| C24 | GET | `/count-settings/preview?rangeKes=&rangePercent=&directorAlertKes=` | `counts.read` | last 7 days of signed counts judged again with the proposed numbers (anything left out stays as it is today) |
| C25 | PUT | `/count-settings` | `counts.setup` | `{ rangeKes, rangePercent, flagRepeatShortfalls }`; the alert amount is left alone |
| C26 | PUT | `/count-settings/director-alert` | `counts.set_director_alert` | `{ alertKes }`; the range is left alone, and so is the range's "updated at" |

## The preview (`settings-preview.ts`)
Pure. Every signed line of the last seven days is judged with `judgeLine` (the one judging function, `_shared/variance-calc.ts`): `range.withinRange` / `outsideRange` are the tallies **under the proposed numbers** (a matched line is neither); the hint says how many lines would move into or out of range compared with today. `alert.countsOver` is how many counts had a line worth at least today's alert amount; the hint adds what the proposed amount would have done ("3 counts went over KES 5,000. At KES 8,000 it would have been 1."). The hub's own settings reads live here; the **kept** branch-day thresholds code is not imported.

## Code map
`settings-routes/controller/service/repository/validators.ts`, `settings.types.ts`, `settings-preview.ts`. The validators re-export the frozen contract schemas. The shared reader of the row (`count-settings-repository.ts`) and the defaults (`count-settings.ts`) live in `../_shared/` because the live count and the sign freeze read the same numbers.

## Tests
`settings-service.test.ts` (defaults, who set what, hub rule, the preview table), `settings-routes.test.ts` (the §3.1 grid for six roles, validation, no token), `settings.db.test.ts` (opt-in `RUN_DB_TESTS=1`: the two writes do not disturb each other and the range keeps its stamp).

## Coupling
`../_shared/` (count-settings, count-settings-repository, count-people, count-format, counting-contract), `../../_shared/` (central-store-access, variance-calc). Nothing from the kept `counting/thresholds-*` files.

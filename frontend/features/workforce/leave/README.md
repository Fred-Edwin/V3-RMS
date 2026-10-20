# Workforce · Leave (segment 4, front end)

Status: part 1 built (20 Oct 2026), not yet walked in a browser. Spec: `docs/features/workforce/specs/4-leave-spec.md` and `-screens.md`. Choices: `docs/features/workforce/decisions-4-leave-frontend.md`. API: `docs/API_CONTRACT.md` §45.

| Folder | Holds | Routes |
|---|---|---|
| `mine/home` | Phone Leave home; `MyLeavePage` picks phone or desktop | `/app/workforce/my-leave` |
| `mine/request` | Request form, shortfall (unpaid tail) block | `/my-leave/request` |
| `mine/history`, `mine/follow` | History with tabs; one request with the circle stepper, endings, cancel | `/my-leave/history`, `/history/[id]` |
| `mine/desktop` | Own leave on a desktop, Ask drawer | `/my-leave` (from 1024 px) |
| `slip` | Document view of the slip | `/my-leave/[id]/slip`, `/leave/[id]/slip` |
| `requests` | The Leave page shell, Requests tab, rota strip, approve, decline, cancel dialogs | `/app/workforce/leave` |
| `balances` | Balances tab, drawer, Adjust a balance | `?tab=balances` |
| `calendar` | Three-week grid | `?tab=calendar` |
| `_shared` | types, services (one per endpoint), dates, copy, idempotency, card, slip buttons | |

Kit additions: `CircleStepper`, chip tone `asked`, capability `leave.balance_adjust`. Other changes: `nav-table.ts` (flag `oldOnlyWhenSwitchOff`, three rows, four old rows), `route-access.ts`, `notification-copy.ts` (six rows), `home/cards/leave-data.ts` (Coming up).
Access comes from the server (`can()` and each request's `can`), never from role names. Public door: `index.ts`.

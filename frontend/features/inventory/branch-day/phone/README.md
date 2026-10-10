# branch-day / phone (department head and member)

**Design:** approved (Paper "Inventory · Counting and closing", steps 0, 1, 2, 2b, 3, 3b, 3c, 4 and chapter 5 steps 19 and 20; values in `docs/features/inventory/branch-day-paper-spec.md`) · **Code:** built 10 Oct 2026 on branch `feat/block4-fe-phone`, **on the contract's fixtures** (see "Mock" below). Contract: `docs/features/inventory/branch-day-contract.md` (BD1 to BD10).

## Screens and routes
| Route | Screen | Paper | Endpoint |
|---|---|---|---|
| `/app/day` | Day: three cards (opening, delivery, evening count) and one button | 0 | BD1 |
| `/app/day/opening` | Opening count: last night's figures; accept (no PIN) or recount | 1 | BD2, BD3 |
| `/app/day/opening/recount` | Recount, blind, then "Check the difference" (not drawn; built in the step 3 style, gap G28) | – | BD2, BD4 |
| `/app/day/opening/sign` | Check the difference and sign (PIN) | 2 | BD5 |
| `/app/day/opening/recorded` | Opening recorded | 2b | BD2 |
| `/app/day/count` | Count your department, blind, saves as you type | 3 | BD6, BD7 |
| `/app/day/count/check` | Check and sign (PIN) | 3b | BD6, BD8 |
| `/app/day/count/figures` | Every figure; a figure can still be changed | 3c | BD6, BD7 |
| `/app/day/sent` | Count sent, with the four-step tracker | 4 | BD1 |
| `/app/day/history` | Past days (filters and page in the address) | 19 | BD9 |
| `/app/day/history/[id]` | One past day, quantities only | 20 | BD10 |

Nav rows (`components/app/shell/nav-table.ts`): **Day** for a head and for a member, **Past days** for a head. The route gate (`lib/route-access.ts`) lets in a head or a floor member; which department is decided by the API.

## Rules the screens follow
- **Blind:** the count screens never show an opening, received, waste, expected or used figure. **No money** anywhere for a head or member.
- **PIN:** one idempotency key per form; a wrong PIN clears the box, says "That PIN is not right. Try again." under it and puts focus back; any other refusal is a line above the button and the form is kept. Accepting an opening needs no PIN.
- **One button on Day:** "Check the opening" until 12:00 Nairobi (the server's `action`), then "Count your department"; nothing once the count is signed (a "See your count" button opens Count sent).
- **States:** loading skeletons mirror the screen; empty, error with Retry and permission use the States kit with the lines in `_shared/lib/branch-day-copy.ts`. A failed load shows the table line, never the server's text.
- **Touch:** the count row is a label, so the whole 61 px row is the target; every link and button is 44 high.

## Mock
`services/branch-day-phone-api.ts` answers from `services/branch-day-phone-mock.ts` (typed with the contract mirror, PIN 1234) unless `NEXT_PUBLIC_BRANCH_DAY_MOCK=0`. Test switches in the browser console: `localStorage.bdMock = 'error' | 'empty' | 'slow'` (remove the key to clear), `localStorage.bdMockClock = 'morning' | 'evening'`. **When `feat/block4-be` is merged, flip the default (`!== '0'` to `=== '1'`) and run the walk again against the real API.**

## Parts added to the shared kit (`_shared/components/block2-phone-parts.tsx`), default looks unchanged
`PinField size="paper"` (44 high, Geist Mono bullets) and the focus edge fixed to `#B0610F` (was `#693C1B`); `B2Banner note` (the 18 px check disc success note of B2b and B4).

## Gaps built in the same style (not drawn in Paper)
The recount screen; the morning Day state ("Check the opening" card); the delivery card when nothing came or it is not counted yet; wrong PIN, fewer than four digits and refused writes; the change marker on 3c; loading, empty and error on every screen; "See your count" on Day after sending; the empty and filtered-empty past days. Wording notes for the owner: the matched items on the recount receipt use full catalogue names ("Coffee beans 1kg"), not Paper's short ones; Past days shows 25 rows a page (the kit's page size), not Paper's 5; the Day card note is the product half of Paper's note ("The day closes once every department has counted.").

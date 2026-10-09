# branch-day (front end)

**Design:** approved (Paper *Inventory · Counting and closing*, B0 to B18 and chapter 5; flow in `docs/features/inventory/branch-day-flow.md`) · **Code:** the contract mirror, its fixtures and the wording table are in place (Block 4 contract session, 9 Oct 2026). **The screens are not rebuilt yet:** the old Milestone Six components, hook, service and types in this folder still run until the Block 4 front-end sessions replace and delete them.

## Contract
`_shared/types/branch-day-contract.ts` mirrors `backend/src/modules/inventory/branch-day/_shared/branch-day-contract.ts` (BD1 to BD21). `branch-day-contract.fixtures.json` is byte-identical to the back end's; `branch-day-contract.test.ts` types it, checks the enums, error codes and sheet constant against the back end's file, and pins the blind rule (the head's count carries no opening, received, waste, used, yesterday or expected figure) and the money rule (a head or member never receives a `*ValueKes` or `unitCostKes`). The index does not export the mirror yet: the old type names clash, so the switch belongs to the PR that deletes the old screens.

## Wording
`_shared/lib/branch-day-copy.ts` is Paper step B18 and the copy on B0 to B17 and chapter 5: the figure names, the day states and chips, what blocks the close, the buttons and reasons, the blocker lines written from facts (`blockerCopy`), the heading above them, the department chip (`openingChip`), the States kit lines per screen and a line for every error code. The back end sends facts and codes only. `branch-day-copy.test.ts` pins it. The words counted (for the closing figure), consumption, gap, unusual and reopen never appear.

## Screens to build (contract §13)
Phone, department head or member: Day (B0), Opening count (B1), Check the difference and sign (B2), Overnight difference recorded (B2b), Count my department (B3), Check and sign (B3b), See every figure (B3c), Sent (B4), Past days (19), One past day (20). Desktop: Today (B5, B7, B9, B14, B16 with the branch picker for hub roles), a department's figures (B6), Close the day drawer (B8), History (B10, B10b, B10c), the day file with Items, Documents and Activity (B11, B12b, B13), Correct a count drawer (B12), the printed day sheet (B13b to B13d), Count for a department drawer (B15).

## Rules the screens follow
Heads see no costs and no expected figure while counting; the Branch Manager sees values; every other desktop role reads the same pages with write buttons hidden, not greyed. Today for a hub role has a branch picker and no Close button. Every signing write sends an `idempotencyKey` in the body; page, filters and dates live in the URL; tables follow `UI_BUILD_RULES` §4a.

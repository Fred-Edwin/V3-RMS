# Branch waste, desktop (Block 3)

W6 Branch waste (Branch Manager), W7 Reverse any entry, W8 Waste for any branch (read only) and the entry detail (BW6). Spec: `docs/features/inventory/branch-waste-paper-spec.md` (owner rulings override its defaults). Contract: `docs/features/inventory/branch-waste-contract.md` (§3 access, §4 BW4 to BW7). The phone screens (BW1 to BW3) are lane 5's `waste/branch/`.

**One screen, one route:** `/app/inventory/branch-waste` (`BranchWasteDeskScreen`). `use-branch-waste-access` decides the view from the server's table: `branch_waste.read` gives W6 (own branch, Reverse link on rows where the server says `can.reverse`), `branch_waste.read_any_branch` gives W8 (Branch column and picker, no Reverse; a holder of both, the System Admin, gets W8). Money (the Value column and the four figures) shows only where the keys are present (`catalog.see_costs`). No PIN anywhere.

**Status: built on fixtures.** `services/branch-waste-desk-api.ts` serves `lib/mock-data.ts` while `BRANCH_WASTE_MOCK` is on (default ON until `feat/block3-be` is merged; `NEXT_PUBLIC_BRANCH_WASTE_MOCK=off` or flipping the constant uses the real `/inventory/branch-waste` endpoints). In mock mode the view comes from the role, because a server without Block 3 sends no `branch_waste.*` capability (so the nav rows stay hidden there too). Test hook in the browser: `globalThis.__branchWasteMockFail = 'LOAD'` or an error code fails the next read or write.

| Screen | Paper | Component | Verdict |
|---|---|---|---|
| W6 | Branch waste: every entry | `branch-waste-desk-screen.tsx` | numeric match at 1440 (title, KPI cells, columns, 46px rows, reversed row, chip, pager cells); 768 and 1024 spot-checked |
| W7 | Reverse any entry | `reverse-entry-dialog.tsx` | numeric match (500 wide, padding 24, gap 16, chips 34, buttons 84×38 and 130×38, 60% scrim) |
| W8 | Waste for any branch | same screen, `everyBranch` | column widths as W8, branch picker in the URL (`?branch=`) |
| BW6 (gap G10) | not drawn | `entry-drawer.tsx` | built from the flow text in the W7 facts-table style, right drawer, 480 wide, no photo |

**Kit options added (defaults unchanged):** `Button` `variant="solid"` (no sheen) and `"flat"`, `shape="square"`, `size="dialog"`; `ScwKpiStrip variant="ink"` (2×2 below 1024); `DecisionDialog` `width`, `scrim="strong"`, `plain`; `ChoiceChips` `tone="ink"`, `labelOf`, `disabled`; `TablePager`, `TableToolbar`, `DataTable` `look="paper"`; `DataTable` `tableClassName`, column `headClassName`.

**Decisions applied:** kit toolbar layout (filters at the right), kit header rule with Paper's header text colour, 46px rows on both screens, the kit's date picker, Paper's exact `#8D8982` on reversed rows (contrast on `#F6F5F3` is about 3.2:1, below AA for 12 to 13px text; owner ruling D12, flagged), status filter options "Active" and "Reversed" (gap G11).

**Gaps built:** G10 entry drawer, G11 filter options, G12 states (loading skeleton, empty, filtered-empty, error with Retry, permission), G13 pending and error lines in the dialog, G14 the note field for "Other, add a note", G16 table scrolls sideways under about 1100px and the KPI strip is 2×2 below 1024, G18 reduced motion, G21 the subtitle follows the date range. Not built: the ledger-entry link in the drawer (the department ledger screen is the head's own, not reachable by these roles).

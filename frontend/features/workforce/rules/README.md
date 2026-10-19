# Workforce · Rules (segment 1B, front end)

Chapter 13 "Rules" (and the Leave tab of Chapter 10, steps 18 to 20) of the approved Paper designs, on the real API in `backend/src/modules/workforce/rules/` (its README has the endpoints, who may change what and the audit). **Status: built, awaiting the owner's review** (19 Oct 2026, branch `feat/workforce-1b-rules-frontend`, nothing pushed). Spec: [1b-rules-spec.md](../../../../docs/features/workforce/specs/1b-rules-spec.md). Every choice made without the owner: [decisions-1b-rules-frontend.md](../../../../docs/features/workforce/decisions-1b-rules-frontend.md).

Routes (thin shells in `app/app/workforce/rules/`): `/app/workforce/rules?tab=<slug>&site=<id>`, `/history?tab=&site=`, `/who-edits-what`. Public face: `index.ts` (`RulesScreen`, `HistoryScreen`, `AccessScreen`).

## Folders

| Folder | What the person does there |
|---|---|
| `components/` | The page (`rules-screen`), one row panel for every tab (`rule-rows`), the Change link with its padlock popover (`change-link`), "Who changes it" and the side panels, the scheduled and waiting banners, the Confirm dialog |
| `change/` | The one Change dialog (`change-dialog`: NOW, NEW, FROM, Applies to, Why, impact, PIN, who is told), the live preview (`use-change-preview`), the generic numbers and choice editors, `rule-number-input` |
| `tabs/` | The ten tabs. Simple ones are a list of row definitions (`tab-types.ts`) plus a numbers or choice editor; `leave/`, `statutory/`, `holidays/` hold the three that need their own tables and dialogs |
| `history/` | Version history with site select and pager; the Withdraw dialog |
| `access/` | Who edits what (from the server) |
| `hooks/ lib/ services/ types/` | Data hooks; words, dates, error codes, tab table, Statutory helpers; one service function per endpoint (R2 to R8); wire types |

## Rules the screens follow

- A button follows the server's answer for the row (`canChange`, `lockedReason.whoCan`, `kind`), never a role name. A locked Change is a real button that opens "You can read this but not change it" (never `disabled`); a Fixed row says Fixed.
- A save sends only the rows to set, `expectedVersion` or `expectedSiteVersion` (the page returns them), and an `idempotencyKey`. A stale answer (from the preview or the save) reads "Someone changed this rule a moment ago", reloads the tab, keeps what was typed and clears the PIN.
- A wrong PIN is `403 PIN_INVALID`: the field turns red, is cleared, the dialog stays. Five wrong tries lock signing and the words say so.
- Pay changes are told without figures (the caption comes from `toldWithoutFigures`); impact rows are only what the server returns, then "Becomes: Version N, from <day>".
- No he or she; names appear only as "Name, Role" or the role alone.

## Endpoints used

R2 (access table), R3 (the tab), R4 (history), R5 (preview), R6 (save), R7 (confirm), R8 (withdraw). R1 is for the system. Also, read only: People's `lookups` and `roster` (departments and head counts for Casual and minimum cover) and the rota's shift templates (Week and breaks).

## Edits to files other sessions also touch (line level, for the merge)

| File | Change |
|---|---|
| `components/app/shell/nav-table.ts` | `wf-rules`: `notBuilt: true` removed, `match: ['/app/workforce/rules']` added. New line after it: `wf-rules-admin` (System Admin, same href) |
| `components/app/shell/nav-table.test.ts` | Three expectations (Settings group now present; the flag test and the System Admin test list the Rules rows) |
| `lib/route-access.ts` | One block (Rules, six roles) before "My time, My rota" |
| `lib/route-access.workforce.test.ts` | One test |
| `features/workforce/_shared/components/panel-parts.tsx` | `SettingRow` gained optional `action` and `tinted`; the title block grows (`grow`) |
| `features/workforce/rota/index.ts` | Three export lines (`rotaReads`, `TemplateView`) |
| `_shared/lib/capabilities.ts`, `_shared/hooks/use-workforce-permissions.ts`, the Home card registry | **Not touched** |

## Parity manifest

Paper's desktop app did not answer during this session (the Paper MCP timed out), so **no screenshot was put beside the build**. Every row below was built from the spec's values and seen in the browser (Director 1440 wide and 917 wide, Accountant, Branch Manager). Nothing was compared with an automated diff.

| Spec part (Paper) | Built | States seen in the browser | Verdict |
|---|---|---|---|
| Lateness, step 01 | `tabs/lateness-tab` | rows, padlock (Branch Manager, deduction cap), Own rule, scheduled banner, sites panel | by values |
| Change dialog, steps 02, 08, 19, 20 | `change/` | open, valid, stale, wrong PIN, saving, saved, pending-confirmation note, two-number block, "<Site> only" | by values |
| Overtime, step 03 | `tabs/overtime-tab` | confirmed by (Accountant view), waiting banner, locked rows | by values |
| Attendance, Probation, Conduct, Week and breaks | their tab files | each opened as the Director and read; Week seen with the live break table | by values; their Change dialogs use the same numbers editor as Lateness (seen) |
| Leave (Chapter 10 steps 18 to 20) | `tabs/leave/` | Director view (padlocked types, site chips, minimum cover) | by values; the leave-type and cover dialogs were not opened |
| Casual work, Statutory, Holidays | their tab files | Casual (departments, Not set), Holidays (empty year, rate not set), Statutory empty (Director) and the Add PAYE bands dialog (Accountant) | by values; the Holidays and Casual dialogs were not opened |
| Version history, step 12 | `history/` | scheduled rows, withdrawn row, pager, Withdraw dialog | by values |
| Who edits what, step 13 | `access/` | the ten rows read from the server | by values |

## Built beyond Paper

The scheduled-version banner and Withdraw; the waiting-confirmation banner and Confirm dialog; Add and Remove for holidays, bands and leave types; the year switch on Holidays; the Branch Manager's own-site view and "Use the company rule again"; loading, empty, error, offline, stale and wrong-PIN states; the "Why:" line in history. Full list with reasons: the decisions file (F1 to F32).

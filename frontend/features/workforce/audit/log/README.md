# Workforce · Audit log (company log, entry drawer, export, Check the chain)

Status: built and walked in a real browser (21 Oct 2026, branch `feat/workforce-6b-shared-frontend`, not pushed). Spec: `6a-audit-and-security-spec.md` A1 to A3 (Paper 14.1). Back end: `backend/src/modules/workforce/audit/`. Decisions: `decisions-6b-shared-frontend.md`.

## Screens
| Screen | Where | Who |
|---|---|---|
| **Audit log** (search, Flagged only, Area, Event, Site, dates, sort, numbered pager, rows per page 25/50/100) | `/app/workforce/audit-log` | the roles the access table gives `audit.read.*`; the API decides what each sees |
| **Entry drawer** (What changed Before/After, Proof: entry number, hash, follows; Check the chain) | row click, `?entry=` | same |
| **Export this view** (CSV, capped at 50,000 rows, writes `audit.exported`) | page header | same |
| **Who looked at this log** | side panel | Director |

The Signed documents tab (`?tab=documents`) is the `documents/index` sub-module.

## Public API (`index.ts` of `audit/`)
`AuditLogPage` and the pieces named there.

## Endpoints
`GET /workforce/audit/entries`, `/entries/:id`, `/facets`, `/actors?q=`, `/viewers`, `GET .../export`, `POST .../chain/check { fromSeq, toSeq }`.

## Things to know
- **Wire names.** The API still says `organization` for a site: the list answer's `facets.organizations`, a row's `organizationId` and `organizationName`. The types here use those names (a wrong guess crashed the screen in the browser walk, 21 Oct 2026). Filters may be sent as `siteId` or `organizationId`; the API accepts both.
- A count over 50,000 reads "more than 50,000". Check the chain: once a minute (429 `CHECK_TOO_SOON`), shown plainly; a break writes its own entry.
- Chips and the keyboard: `/` focuses the search; each row title is one tab stop (no arrow-key grid, decisions F12).
- The footer shows the spec's "Showing 1 to N of M" line under the pager's own range; both are intended.

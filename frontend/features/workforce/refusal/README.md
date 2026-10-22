# Workforce · Refusal screen

**Status:** built and walked in a real browser (22 Oct 2026, branch `feat/workforce-1-people-batch-2a`, not pushed). Spec: Paper frames 10.1 and 10.2 (page "Workforce · Final pass designs"); design notes round 2, group 4. Back end: `GET /workforce/page-for` (`backend/src/modules/workforce/home/page-for.ts`, `docs/API_CONTRACT.md` section 47).

## What it does
One "Not available for your role" screen at `/app/not-available?from=<path>` for every blocked page, in place of a silent redirect. The route guard (`middleware.ts` through `lib/route-access.ts`) sends a refused person here; the screen asks the server who the page is for, taken from the access table, and shows:
- the page name and "<Page> is for HR, the Director, ..." (or "the person it belongs to" for a personal page);
- a button to a page the person may use instead, when there is one (My payslips, My team), and "Go to Overview" or "Go to Home";
- a reference code (`WF-` and four characters, the same for the same person and page) and "Nothing was changed."

`from` is accepted only when it is a path inside `/app/` (`safeFrom`), so the screen cannot be used to bounce to another site.

## Public API (`index.ts`)
`RefusalScreen`, `safeFrom`, `refusalBody`, `refusalCaption`, `refusalFooter`, `NOT_AVAILABLE_PATH`.

## States
While the server answers, and if the call fails, the screen takes the page name from the path (`pageNameFromPath`: "/app/workforce/leave-calendar" becomes "Leave calendar") and says "<Page> is not available for your role." with no reference code, since the code is the server's; never a blank page. Phone: the shell's top bar with the menu and the bell, the same content in one column with 44 px buttons.

## Coupling
Adding a page to the access table is enough for its refusal to name the right roles. The "instead" lines live in `page-for.ts` (`insteadOf`).

## Tests
`lib/refusal-words.test.ts`; back end `page-for.test.ts`; route guard in `lib/route-access` tests.

# Timesheets · requests (the manager's inbox)

**Spec:** Paper Chapter 9 draws the person's side; this is the other half. **Status:** built, awaiting review (19 Oct 2026). **Endpoints:** R1 (the inbox), R2 (answer).

`/app/workforce/requests`: Report a problem and "clocked out by mistake" requests for the branch, oldest first, with the chips Waiting / Answered / All and a search. Each opens a dialog: what the system recorded beside what the person says it should be, their one line, and Approve or Decline (declining needs a reason). **Approving a clock request makes the correction through Attendance's fix door**, so the old time stays in the history and the person sees was and now; a closed month refuses it in words (HR reopens first). A request nobody answered in three days shows as gone to HR. Read-only for anyone who may not answer (the Director, the Accountant, a department head on a clock correction); the server decides and its words show.

| Piece | File |
|---|---|
| Page | `components/requests-screen.tsx` |
| Answer dialog | `components/request-dialog.tsx` |
| Waiting and escalation words, decline reasons, what approving does | `lib/request-view.ts` |

**Coupling:** `_shared/lib/request-compare.ts` (before and after, shared with the phone), the branch chooser; Home's Waiting for you and HR's Needs your attention read the waiting list through `index.ts`.

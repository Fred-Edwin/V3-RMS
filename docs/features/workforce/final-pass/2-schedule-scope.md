# Schedule: the whole scope of work, in plain words

Written 24 Oct 2026 by the orchestrator. It lists **everything** that came out of the Schedule review and watch (Shifts and Attendance), grouped so you can decide what to build. Nothing here is built yet. Item numbers (W1 to W65, M, K, G) point to `2-schedule-change-log.md` and `2-schedule-carry-forward.md` if you want the detail.

**Sizes:** S = small (a few files), M = medium, L = large (a full session or more). **Design** = needs a Paper drawing before any building.

## At a glance
| # | Group | Items | Size | Design? | What it is |
|---|---|---|---|---|---|
| A | Words and names | 11 | S | No | Wrong or confusing wording, mainly "Rota" |
| B | Small fixes | 19 | S to M | No | Small things that look or behave wrongly |
| C | Access and safety | 6 | S | No | Who may open what, and what happens when it fails |
| D | **The new shift-end and overtime flow** | 7 | **L** | Yes | A new way to end a shift: clock-out, hand-over, overtime asked beforehand |
| E | **Lateness actions** | 3 | **L** | Yes | What a manager can do about someone who is late |
| F | **The fast planner** and past days | 2 | **L** | Yes | Set a whole week or month of shifts quickly |
| G | **New Homes and the clock card** | 7 | **L** | Yes | The head's, the staff's, HR's, the Director's and the System Admin's Homes |
| H | The employee file's Time tab | 1 | L | Yes | Show a person's real attendance on their file |
| I | A purpose line on every page | 2 | M | Small | One plain sentence under each page title |
| J | Moved to other sections | 6 | n/a | n/a | Not built here |
| K | Tests and documents | 1 | M | No | Proof and notes for each delivery |
| | **Numbered changes** | **65** | | | |
| M | Screens the design never drew | 12 | | | See below |
| N | Known gaps carried from earlier | 11 | | | See below |
| O | Simplification ideas | 4 | | | See below |
| Q | Questions waiting for you | 7 | | | See `2-schedule-decisions.md` |

Some items overlap (for example the Home redesign appears in three lists). The 65 numbered changes above are counted once each.

---

## A. Words and names (11 items, small, no design)
| Item | In plain words |
|---|---|
| W20 | "Rota" becomes **"Shifts"** everywhere: menu, titles, breadcrumb, print page, notices, refusal messages |
| W12, W21 | The **"Start from last week"** button is unclear to a new user: explain what "last week" means and what "Left out, need you" is |
| W22 | Remove "Arrives with Leave" from the Today board, and the wrong "TODAY" heading on a past day |
| W27 | Past-day wording on the Today board ("expected by 00:00", "ON SHIFT NOW" on a day that has ended) |
| W29 | The "thin" count in the footer counts only the thin department; dates in words ("Wed 28 Oct") |
| W31 | Print page: leave days print "Leave", not "off"; headings say Shifts |
| W37 | A head's pages are named for their department ("Barista team today") |
| W40, W47 | The "Not available" text names the right roles for each page, and points heads to Team today |
| W53 | The switch page is titled "Attendance switch" |

## B. Small fixes (19 items, no design)
| Item | In plain words |
|---|---|
| W14 | **Cells on the Shifts grid show timings** (06–14), not shift names; the name stays in the tooltip and legend |
| W15 | **The reason is optional** when editing a shift (the leave-override reason stays required) |
| W23 | The **person label** (name, position, site) everywhere; a head reads "Barista · Head" |
| W24 | Home's "Needs you" and Latest show only what concerns that role, and name the person |
| W25 | Edit time dialog: clock-in listed before clock-out; amber underlined Edit and Remove; no old overtime sentence |
| W28 | A week nobody has started says "Not started", not "14 thin days"; the legend lists the branch's shifts |
| W30 | Shift colours match the design |
| W32 | The cell picker tells you a person is on leave before you choose a shift |
| W33 | "Show retired" count matches the retired number |
| W34 | The Today board gets the bell, like Home |
| W35 | Fix a console error that appears on every page (a duplicate key in the sidebar) |
| W38 | **One meaning of "on shift"** on My team, Team today, Home and Organisation |
| W39 | Phone Shifts view: one back arrow, "Needs 2 · Has 4", today marked, timings in cells |
| W42 | "Leave days left" shows the real balance, not a dash |
| W43 | The phone menu closes after you choose a row; the footer shows position and site |
| W44 | **My shifts** (was My rota): days not planned read "Not planned yet", not "Day off" |
| W51 | Company-wide roles open Shifts on the first branch and remember the last one chosen |
| W56 | Hide the Central Store where it has no shifts (your Q7) |
| W62 | The System Admin's Home lists only what the admin can decide |

## C. Access and safety (6 items, no design)
| Item | In plain words |
|---|---|
| W36 | A **department head may clock someone in** for their own department (decided). Not themselves (your Q6). |
| W57 | **The Director may open the attendance switch**: the page gate is older than your 21 Oct decision |
| W59 | Rule for builders: when an access decision changes, update the page gate and the menu in the same change, with a test |
| W61 | Switch screen polish: plain dates, the admin's **PIN** to switch a branch on or off, what happens to someone clocked in |
| W63 | **One refusal pattern:** a page a role may not use shows the "Not available for your role" screen, never an in-page message |
| W64 | A failed request **never leaves "Still loading" forever**; after a few seconds it shows the standard error with a reference and Try again |

---

## D. The new shift-end and overtime flow (7 items, large, design needed)
**What it does, in plain words.** Ten minutes before a shift ends, the phone shows what is still open for that person (unpaid tables, unfinished tickets, unpacked dispatches) and offers three choices: **Finish them**, **Hand over** to someone on the next shift or the head, or **Ask for overtime** with a reason. The head approves or declines. At the scheduled end the system **clocks the person out** unless overtime was approved beforehand. Anything left open goes to **"Needs an owner"** on the head's list, and after 30 minutes with nobody taking it, becomes **"Unaccounted"**, which the Branch Manager, Director and Accountant can see. **The system never deducts anything.**

| Item | In plain words | Where |
|---|---|---|
| W10 | Back end: overtime requests, hand-over records, the clock-out at the scheduled end, the "Unaccounted" check, notifications, access and audit | S2 (back end) |
| W11 | The flow **reads** open items from Orders, Prep and Dispatch; it never changes them (your Q3) | S2 |
| W16 | Retire the old "closed by the phone" notice and dialog | S2 |
| W5 | The phone screens: the warning, Finish, Hand over, Ask for overtime, the result | Design, then build |
| W6 | The head's approval screen and the "Needs an owner" list | Design, then build |
| W7 | What the person receiving a hand-over sees | Design, then build |
| W8 | The Unaccounted lists for the Branch Manager, Director and Accountant (the Accountant sets Open, Explained, Recovered or Written off) | Design, then build |

## E. Lateness actions (3 items, large, design needed)
**In plain words.** Each late person on the Today board and each late day on the timesheet gets actions: **Excuse** (with a reason), **Counts** (the default), **Make up the time**, a **"3rd late in 30 days"** button that starts a Conduct note by hand, and **Clock in for them**. Nothing is deducted automatically. The person is told what was decided.
| Item | In plain words |
|---|---|
| W17 | The actions themselves, on the board and the timesheet |
| W26 | Flag an early clock-out on the board ("Left 2 h 40 min early, no reason") so it can get an action |
| W52 | "Late" reads one way everywhere ("Late in the last 30 days" includes today) |

## F. The fast planner and past days (2 items, large, design needed)
| Item | In plain words |
|---|---|
| W18 | **Today and past days on the grid:** a Today column marked amber, past columns muted and read-only, small dots for what happened |
| W19 | **Plan shifts mode:** a palette of shifts you paint over cells; repeat a person's week; saved week patterns per branch with a preview of clashes; apply to a week or a month; undo for ten minutes. **First version only** (your Q1); the month grid and "fill the gaps" come later. |

## G. The Homes and the clock card (7 items, large, design needed)
| Item | In plain words |
|---|---|
| W1 | **The department head's Home** (desktop and phone): own clock, team today, shifts, overtime requests, items needing an owner, probation reports, requisitions |
| W2 | **The staff Home** (desktop and phone) |
| W3 | **A compact clock card**, including the ten-minute warning state |
| W4 | A redesigned **"This week" card** |
| W45 | A "No shift today. Next shift: Monday 26 Oct" card, so the page never looks empty |
| W50 | **HR, Director and System Admin Homes show attendance:** late and not in today, thin days, items needing an owner, Unaccounted items |
| W41 | The overall Home redesign that W1 to W4 belong to (counted here for completeness) |

## H. The employee file's Time tab (1 item, large, design needed)
W54: the greyed **Time** tab on a person's file becomes real: their days, lateness, overtime and unaccounted items. The overview tiles ("On time", "Overtime", "Leave left") show real figures. Leave data comes with section 7.

## I. A purpose line on every page (2 items, medium)
W48, W49: one plain sentence under each page title ("Plan who works when. Click a day to pick a shift; changes save as you go."), a "?" only on complex screens, dialogs that start with what will happen, one copy file per feature with a test, and the rule added to `UI_BUILD_RULES.md`. Piloted on the Schedule screens (about 20 pages and dialogs).

## J. Moved to other sections (6 items)
| Item | In plain words | Goes to |
|---|---|---|
| W9 | Overtime evidence (hours and completed orders) on the timesheet | Section 3 |
| W65 | The Accountant reads timesheets from the menu | Section 3 |
| W46 | The phone sign-in skips the PIN step after "Trust this device" | Section 9 (security) |
| W55 | "Home" and "Workforce / Overview" both open the same page | Leave as designed |
| W58 | Route the "closed by the system" item to the right owner | Retired by the new flow |
| W60 | What the System Admin does in Schedule | Your Q4: acts as a user |

## K. Tests and documents (1 item)
W13: the clean-database tests for every rule in the new flow, and the documents for both modules.

---

## M. Screens the design never drew (12 items)
| # | Missing screen or state | In plain words | Built here? |
|---|---|---|---|
| M1 | The switch screen | Built without a design; the System Admin's only screen here | Design in group F or G |
| M2 | A refused clock on the phone | Outside the branch, not rostered today, clock not open yet, shift already done: nine refusal reasons, none drawn | Design |
| M3 | An offline tap that fails | Only the happy offline note is drawn | Design |
| M4 | The phone-closed shift from the person's side | Becomes unnecessary when the new flow clocks people out | Retired by D19 |
| M5 | The Today board and Home cards for a branch whose clock is off | No "why not" message | Design (one state) |
| M6 | An empty week, a person on loan, "sent to another site" | Only a full week is drawn | Part of W28 |
| M7 | Two shifts in one day | Paper draws it, the build left it out | Decision |
| M8 | The Today board on a past day and on a phone | Not drawn | Design |
| M9 | "Mark absent today" and "Wait" | Drawn but they do nothing | Remove (your Q2) |
| M10 | A request for a clock-out mistake | The dialog exists; the request is section 3 | Section 3 |
| M11 | Acting as another user over the clock | | Section 9 |
| M12 | A person disputing a clock-in a manager made for them | | Section 3 |

## N. Known gaps carried from earlier (11 items)
| # | Gap | In plain words | What to do |
|---|---|---|---|
| K1 | Shift change notices | Held in memory for 5 minutes; a restart loses one that is waiting | Move to the queue, or accept |
| K2 | Background jobs | The worker must run in production or an unanswered shift never closes | Add to the deployment check |
| K3 | Old lateness report | Wrong on a UTC server | Fix, or retire the old figures; tell Branch Managers |
| K4 | The old clock bridge | Switching on and off carries records both ways | Watch it live; plan what to tell the branch |
| K5 | Notices only logged | Until the Notifications module exists | Confirm in section 9 |
| K6 | Pay-period lock | No period is ever closed until Timesheets | Check the wording until section 3 |
| K7 | Leave lookup | Returns nothing until section 7, so leave warnings can't appear | Use real leave data in the demo |
| K8 | "Hours last week" and per-site "needs a look" | Left out | Back-end fields, medium |
| K9 | Standing pattern API | Has no screen | Delete or keep (the planner may use it) |
| K10 | Shift colours | Only five of six can be picked | Add a swatch or retire it |
| K11 | The attendance switch is on in the demo lane | Method says never leave it on elsewhere | Leave on here only |

## O. Simplification ideas (4 items, from your request)
| # | Idea | My recommendation |
|---|---|---|
| G1 | One fix path for "closed by the phone", "clocked out by mistake" and a missed clock-in | Yes, in the design |
| G2 | Remove "Mark absent today" and "Wait, they have told me" | Yes |
| G3 | One line per open item in the shift-end list | Yes |
| G4 | Remove the per-branch switch and the old-clock bridge once every branch is live | Later, after the rollout |

---

## How the work would be delivered (for you to confirm)
| Delivery | Groups | Who | Design first? |
|---|---|---|---|
| **S1: quick fixes** | A, B, C, I (the mechanism) | Lane 2, one lean session | No |
| **S2: back end of the new flow, lateness and planner** | D (W10, W11, W16), E and F back end | Lane 4 | No |
| **S3: the screens** | D screens, E, F, G, H, I (placement), M2, M3, M5, M8 | Lane 3 designs in three groups, then lanes 2 and 4 build | Yes |
| **Section 3** | W9, W65, the timesheet side of lateness | Later | |

**Cut options if time matters:** F's month view, H's Time tab content beyond lateness, and E's "make up the time" could each move to after the pilot. Say which you would cut.

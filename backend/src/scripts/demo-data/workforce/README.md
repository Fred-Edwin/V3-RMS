# Workforce demo data (fictional)

A made-up Wendo for the section videos, on the throwaway **lane 6** database (`wendo_rms_lane6`). Nothing here is real: names are invented, bank and ID numbers are obviously fake, emails end in `demo.wendo.test`, and the avatars are inline initials. It refuses to reset any database whose name does not end in `_laneN`.

```bash
cd backend
pnpm demo:seed            # seeds once; does nothing if the demo is already there
pnpm demo:seed --reset    # empties the lane database (keeps the company and 11 positions), then seeds again
pnpm demo:seed --wipe     # empties it and stops
```

**Password for every login: `WendoDemo#2026`. PIN for every login: `4321`.**

| Who | Email | Role |
|---|---|---|
| Alex Njoroge | admin@demo.wendo.test | System Admin |
| Mercy Akinyi | hr@demo.wendo.test | HR Manager |
| Anne Muthoni | accountant@demo.wendo.test | Accountant |
| Charles Ndungu | director@demo.wendo.test | Director |
| Lucy Wangari | store.manager@demo.wendo.test | Store Manager (Central Store) |
| Kevin Mutua | kevin.mutua@demo.wendo.test | Store Attendant |
| Faith Wambui | bm.town@demo.wendo.test | Branch Manager, Nyeri Town |
| Kelvin Mwai | kelvin.mwai@demo.wendo.test | Chef, Kitchen head (Town) |
| Joseph Maina | joseph.maina@demo.wendo.test | Chef, Pastry head (Town) |
| Victor Mutua | victor.mutua@demo.wendo.test | Barista, Barista head (Town) |
| Susan Wafula | susan.wafula@demo.wendo.test | Waiter, Service head (Town) |
| Peter Kamau, Mary Njeri | peter.kamau@, mary.njeri@ | Chefs (Town) |
| Cynthia Muthoni, Brian Kiprop | cynthia.muthoni@, brian.kiprop@ | Baristas (Town) |
| Naomi Jepkorir, Paul Odhiambo, Isaac Kimani | naomi.jepkorir@, paul.odhiambo@, isaac.kimani@ | Waiters (Town) |
| Daniel Gitau | daniel.gitau@demo.wendo.test | Steward (Town) |
| James Karanja | bm.highway@demo.wendo.test | Branch Manager, Nyeri Highway |
| Esther Wambui | esther.wambui@demo.wendo.test | Chef, Kitchen head (Highway) |
| Faith Chebet | faith.chebet@demo.wendo.test | Barista, Barista head (Highway) |
| Beatrice Atieno | beatrice.atieno@demo.wendo.test | Waiter, Service head (Highway) |
| Samuel Kariuki | samuel.kariuki@demo.wendo.test | Chef (Highway) |
| Dennis Otieno | dennis.otieno@demo.wendo.test | Barista (Highway) |
| Victor Njoroge, Joy Chepkoech | victor.njoroge@, joy.chepkoech@ | Waiters (Highway); Joy joined 14 Sep |

(Every address ends in `@demo.wendo.test`.)

## What is seeded (stage one: written straight to the database)
Company, two branches and the Central Store; 26 people with logins, positions, departments, department heads, reporting lines, bank-only pay profiles with approved pay history, KRA/NSSF/SHA numbers, active contracts and photos; shift templates; a rota and clock events for 1 Aug to 20 Oct 2026 (a few late arrivals, eight overtime days to decide, four absences, one open shift on 20 Oct); the attendance switch on for both branches. "Today" in the demo is 21 Oct 2026.

## What is seeded (stage two: the flows, driven through the real API)
`flows.ts` and `flows-people.ts` sign in as the demo people and use the app's own routes, with the PIN, so every rule and audit entry applies. **The API on port 4106 must be running** (and Redis on 6406) when you seed; set `API=` to use another address.
- **Rules:** annual leave 21 days (sick 14, emergency 3); tax tables and overtime rates, confirmed by the Accountant.
- **Timesheets:** August and September approved at both branches by their Branch Managers, with the overtime days decided (one declined with a reason).
- **Payroll:** **August is Paid** (20 payslips; reviewed by HR, approved by the Accountant, published, bank file downloaded, marked paid). **September is calculated and In review** (21 people, a few lines to tick). October is open.
- **Leave:** a balance top-up and requests in every state: 2 approved, 1 declined, 1 cancelled, 2 waiting for a manager.
- **Conduct:** one written warning to Isaac Kimani, signed by him, with an appeal waiting for HR to decide.
- **Casual:** daily rate set, two casual workers, 20 Oct recorded, sent, approved (CPS-0001), one worker signed.
- **Documents:** the signed notice, the published payslips, approved leave and the approved casual sheet produce the documents; the seed only checks that the register answers, so look at its contents in the app.

Two things are set in the lane database directly because the app refuses them: rule start dates (a rule cannot start in the past, and August's tax tables must) and the August and September timesheet sheets (the app only opens the current month).

## Known gaps
The Central Store staff show "Job details missing" because the departments exist per branch only. The flows were checked through the API and the database, not yet by eye in the app.

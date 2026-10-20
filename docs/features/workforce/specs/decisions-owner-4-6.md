# Owner decisions on the Segment 4 to 6 specs (20 Oct 2026)

The owner answered the four questions raised by the Leave, Conduct and Shared-parts specs. Back-end and front-end sessions treat these as final.

| # | Question | Decision | Touches |
|---|---|---|---|
| O1 | How annual leave days arrive | **All at the start of the year** (21 days on 1 January, as the approved Paper example shows). Not built up monthly. Prorate only for people who join mid-year. The Rules Leave tab must be read as "granted in full at the start"; one Rules change switches it later. | Leave spec L8 |
| O2 | PINs on leave | **Declining needs no PIN; adjusting a balance needs a PIN**, a reason and an audit entry. | Leave L24, L25 |
| O3 | QR verify page | **Role and date only**: number, version, date, the signer's role, replaced or not. Never a name, a figure or a head count. Differs from Paper Chapter 17 on purpose. | Shared parts SD (verify), Leave L28, Conduct C26 |
| O4 | Conduct notice for a person with no login | **Yes**: printed, handed over, recorded as not signed with a witness. | Conduct C9 |

## What the owner added about casual workers
Casual workers are waitresses, baristas and chefs **on probation who have no contract yet**, paid daily. **Some of them have logins.** Consequences recorded:
- Conduct (O4) works both ways: a casual with a login signs with their PIN like anyone; one without gets the paper route. The spec's wording "a person with no login (a casual)" is too narrow: the rule is the login, not the casual status.
- **Open, to settle in the back-end brief for Leave:** whether casual (probation) workers have leave entitlement and balances. The Leave spec does not mention them. Recommended default until the owner says otherwise: no balance and no leave requests for a casual; leave starts when the contract starts; the Leave screens show nothing for them rather than a broken page.
- **Open, for the Conduct back-end brief:** a notice to someone on probation counts toward the ladder the same way (recommended), and the notice does not by itself end probation.

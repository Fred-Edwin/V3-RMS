/** The words of the payslip and casual-pay screens that the states kit has no row for (spec S1 to S11). One place, so a wording change is one edit. */
export const PAYSLIP_COPY = {
  screen: 'My payslips',
  offline: 'No signal. Your payslips need a connection to open.',
  notFound: 'We could not find that payslip.',
  loadError: 'We could not open your payslips. Nothing was changed.',
  empty: { title: 'No payslip yet', line: 'Your first one appears here when your pay is published.' },
  emptyBranchNotMoved: { title: 'No payslip yet', line: 'Your first payslip will be here once your branch moves to the new payslips.' },
  oldCard: { title: 'Your payslips are still on the old screen', button: 'Open old payslips' },
  oldRow: 'Before October 2026',
  footer: 'Your own code opens each payslip. Nobody else can open it.',
  questionsCall: 'Questions? Call HR.',
  questionsAsk: 'Questions? Ask HR.',
  downloadFailed: 'Could not download. Try again.',
  p9Failed: 'Could not prepare your tax card. Try again.',
  p9Waiting: 'Waiting for the Accountant to confirm the P9 format.',
  notYou: "This wasn't me",
} as const;

export const CODE_COPY = {
  title: 'Your code opens your payslip',
  line: 'Nobody else can open it, and each time it is opened it is recorded.',
  reassure: 'A wrong code never locks you out. Each try is recorded, and after 3 wrong tries you are told.',
  fieldLabel: 'Your code, four digits',
  setTitle: 'Choose your code',
  setLine: 'You will use it to open your payslips. Four digits.',
  setFirst: 'Choose a code',
  setAgain: 'Type it again',
  setButton: 'Save my code',
  warningBody: (who: string) => `If you are not ${who}, stop here. Every opening is recorded with the phone and the time. On a phone that is not confirmed, the System Admin is told too.`,
} as const;

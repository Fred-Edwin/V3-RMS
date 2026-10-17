/**
 * Words on Home that the States kit table does not cover (Paper draws no empty Home). Built beyond Paper, in the States kit's voice:
 * never blames the person, says what happens next. Listed in the README's "Built beyond Paper" table.
 */
export const HOME_COPY = {
  /** Nothing registered for this person has anything to show. */
  empty: { title: 'Nothing needs you right now', line: 'Cards appear here when there is something to look at: approvals, people who are late, dates coming up.' },
  /** The permissions answer failed. The rest of the app stays usable. */
  permissionsError: { title: 'We could not load your Home', line: 'Nothing was changed. Try again in a moment.' },
  /** One card failed; the others stay. */
  cardError: (title: string): { title: string; line: string } => ({ title: `We could not load ${title.toLowerCase()}`, line: 'The rest of Home is fine. Nothing was changed.' }),
} as const;

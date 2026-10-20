const WHOLE = /^[+-]?\d+$/;
export const ADJUST_LIMIT = 60;

export type AddParse = { kind: 'empty' } | { kind: 'invalid'; message: string } | { kind: 'ok'; value: number };

/** The ADD box: a whole number from -60 to 60 that is not zero. Words are the spec's ("Use a whole number such as 2 or -1."). */
export function parseAdd(text: string): AddParse {
  const trimmed = text.trim();
  if (trimmed === '') return { kind: 'empty' };
  if (!WHOLE.test(trimmed)) return { kind: 'invalid', message: 'Use a whole number such as 2 or -1.' };
  const value = Number(trimmed);
  if (value === 0) return { kind: 'invalid', message: 'Nothing to change yet.' };
  if (Math.abs(value) > ADJUST_LIMIT) return { kind: 'invalid', message: `Use a number from -${ADJUST_LIMIT} to ${ADJUST_LIMIT}.` };
  return { kind: 'ok', value };
}

/** Why Adjust balance cannot be pressed yet, as the text under the buttons; null when everything needed is there. */
export function adjustBlocker(args: { hasPerson: boolean; hasType: boolean; add: AddParse; hasReason: boolean; otherNeedsNote: boolean }): string | null {
  if (!args.hasPerson) return 'Choose a person.';
  if (!args.hasType) return 'Choose the kind of leave.';
  if (args.add.kind !== 'ok') return 'Add or take off some days.';
  if (!args.hasReason) return 'Choose a reason.';
  if (args.otherNeedsNote) return 'Say why, in a few words.';
  return null;
}

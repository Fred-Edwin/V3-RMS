import { ApiError } from '@/types/api';

/** What the code screen says for each way an attempt can end. Never how phones are recognised. */
export type CodeProblem =
  | { kind: 'wrong'; waitSeconds: number | null }
  | { kind: 'slowed'; waitSeconds: number }
  | { kind: 'noCode' }
  | { kind: 'offline' }
  | { kind: 'other'; message: string };

const waitOf = (details: unknown): number | null => {
  const wait = typeof details === 'object' && details !== null ? (details as { waitSeconds?: unknown }).waitSeconds : null;
  return typeof wait === 'number' && wait > 0 ? Math.ceil(wait) : null;
};

export function problemOf(error: unknown): CodeProblem {
  if (!(error instanceof ApiError)) return { kind: 'other', message: 'That did not go through. Try again.' };
  if (error.code === 'CODE_WRONG') return { kind: 'wrong', waitSeconds: waitOf(error.details) };
  if (error.code === 'CODE_SLOWED') return { kind: 'slowed', waitSeconds: waitOf(error.details) ?? 2 };
  if (error.code === 'NO_CODE_SET') return { kind: 'noCode' };
  if (error.code === 'NETWORK') return { kind: 'offline' };
  return { kind: 'other', message: error.message };
}

export const WRONG_LINE = 'That code is not right.';
export const slowedLine = (seconds: number): string => `Wait ${seconds} ${seconds === 1 ? 'second' : 'seconds'}, then try again.`;
export const MISMATCH_LINE = 'The two codes are different.';

/** The row chosen on the code screen; with none chosen, the newest (the list is newest first). */
export function chosenRow<T extends { id: string }>(rows: readonly T[], chosenId: string | null): T | null {
  return rows.find((r) => r.id === chosenId) ?? rows[0] ?? null;
}

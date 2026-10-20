import type { AppealReasonKey } from '../../_shared/types/conduct-types';
import { APPEAL_TEXT_MAX, APPEAL_TEXT_MIN } from '../../_shared/lib/conduct-words';

/** Why the Send button waits, in the spec's words, or null when the appeal can go. A reason chip and the written reason are both required. */
export function appealProblem(reasonKey: AppealReasonKey | null, text: string): string | null {
  if (!reasonKey) return 'Choose why you disagree.';
  const length = text.replace(/\s+/g, ' ').trim().length;
  if (length < APPEAL_TEXT_MIN) return `Tell HR what happened (at least ${APPEAL_TEXT_MIN} characters).`;
  if (length > APPEAL_TEXT_MAX) return `Keep it to ${APPEAL_TEXT_MAX} characters.`;
  return null;
}

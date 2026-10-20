import { ConflictError } from '../../../../utils/errors';
import { suggestLevel, type LadderNotice } from '../_shared/conduct-ladder';
import type { ConductLevel } from '../_shared/conduct-model';

/**
 * The ladder as a refusal (C7). A final warning already on file blocks every new notice ("Speak to HR"); a Final needs an active
 * Written. Legacy rows never reach this function.
 */
export function assertLevelAllowed(active: readonly LadderNotice[], level: ConductLevel): void {
  const advice = suggestLevel(active);
  if (advice.finalAlreadyActive) throw new ConflictError('A final written warning is already on file. Speak to HR.', 'FINAL_ALREADY_ACTIVE');
  if (level === 'FINAL_WRITTEN_WARNING' && !advice.finalAllowed) throw new ConflictError('A final written warning needs an active written warning on the file.', 'FINAL_NEEDS_WRITTEN');
}

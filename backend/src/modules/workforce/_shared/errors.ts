import { AppError, ValidationError } from '../../../utils/errors';

/** A call that needs a later slice. It fails loudly (HTTP 501) instead of returning a wrong answer. */
export class NotBuiltYetError extends AppError {
  constructor(functionName: string, slice: number) {
    super(501, 'NOT_BUILT_YET', `${functionName} is not built yet (Workforce slice ${slice}).`);
  }
}

/** Decision D5: no overnight shifts. A shift's end must be later than its start on the same date. */
export class OvernightShiftError extends ValidationError {
  constructor(message = 'A shift must end later than it starts on the same day') {
    super(message, 'OVERNIGHT_SHIFT');
  }
}

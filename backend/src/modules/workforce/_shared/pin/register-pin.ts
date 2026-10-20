import { setPinTryStore } from './pin-door';
import { pinTriesRepository } from './pin-tries-repository';

/** Called once at start-up (routes/index.ts): wrong PIN tries are stored in `workforce_pin_tries`, so a restart does not clear the pause. */
export function registerPinTries(): void {
  setPinTryStore(pinTriesRepository);
}

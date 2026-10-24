import { setTracksTimeResolver } from '../../_shared/tracks-time';
import { fileTracksTimeResolver } from '../rules/tracks-time-resolver';

let registered = false;

/** Called once where `routes/index.ts` builds the routers. Idempotent. */
export function registerPeople(): void {
  setTracksTimeResolver(fileTracksTimeResolver);
  registered = true;
}

export const isPeopleRegistered = (): boolean => registered;

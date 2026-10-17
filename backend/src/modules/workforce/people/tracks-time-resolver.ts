import { defaultTracksTime } from '../_shared/workforce-access';
import type { TracksTimeResolver } from '../_shared/tracks-time';
import { employeesRepository } from './employees/employees-repository';

/**
 * The real "does this person clock in" answer (slice 1): the employee file's value for the login, else the role default
 * (decision D2) for a login with no file. Casuals have no login and are reached by employee id in later slices.
 */
export const fileTracksTimeResolver: TracksTimeResolver = async (subject) => {
  const fromFile = await employeesRepository.tracksTimeOfUser(subject.id);
  return fromFile ?? defaultTracksTime(subject.role);
};

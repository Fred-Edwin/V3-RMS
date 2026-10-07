import { ForbiddenError } from '../../../utils/errors';
import { defaultTracksTime, type AccessSubject } from './workforce-access';

export type TracksTimeResolver = (subject: Pick<AccessSubject, 'id' | 'role'>) => Promise<boolean>;

const defaultResolver: TracksTimeResolver = async (subject) => defaultTracksTime(subject.role);
let resolver: TracksTimeResolver = defaultResolver;

/** Slice 1 (Employee) registers the real lookup here at start-up. Passing null restores the role default. */
export const setTracksTimeResolver = (next: TracksTimeResolver | null): void => {
  resolver = next ?? defaultResolver;
};

export const tracksTime = (subject: Pick<AccessSubject, 'id' | 'role'>): Promise<boolean> => resolver(subject);

export const requireTracksTime = async (subject: Pick<AccessSubject, 'id' | 'role'>): Promise<void> => {
  if (!(await tracksTime(subject))) throw new ForbiddenError('This person does not clock in');
};

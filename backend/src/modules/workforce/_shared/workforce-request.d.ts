import type { AccessSubject } from './workforce-access';

declare global {
  namespace Express {
    interface Request {
      /** Set by attachWorkforceSubject (people/people-subject.ts); requireCapability prefers it over req.user. */
      workforceSubject?: AccessSubject;
    }
  }
}

export {};

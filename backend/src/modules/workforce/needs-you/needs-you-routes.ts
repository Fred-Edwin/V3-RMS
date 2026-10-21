import { Router, type NextFunction, type Request, type Response } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { NotFoundError } from '../../../utils/errors';
import { workforceCan, type AccessSubject, type Capability } from '../_shared/workforce-access';
import { attachWorkforceSubject } from '../people/people-subject';
import { needsYouController as c } from './needs-you-controller';

/** The Needs you card, its badge counts, the Director's Overdue list and reminders (6b N1 to N5). */
const P = '/workforce/needs-you';
const router = Router();

/** Without the capability the whole feature answers 404, so its existence is not revealed (6b X). Still the one access table. */
const hiddenUnless = (capability: Capability) => (req: Request, _res: Response, next: NextFunction): void => {
  if (!workforceCan(req.workforceSubject ?? (req.user as AccessSubject), capability)) throw new NotFoundError('Not found');
  next();
};
const reads = [authenticate, attachWorkforceSubject, hiddenUnless('needs_you.read')] as const;
const remindsToo = [authenticate, attachWorkforceSubject, hiddenUnless('needs_you.remind')] as const;

router.get(P, ...reads, c.list);
router.get(`${P}/counts`, ...reads, c.counts);
router.get(`${P}/page`, ...reads, c.page); // See all (Paper 1.12): search, group chip, site, pager
router.get(`${P}/attention`, ...reads, c.attention);
router.post(`${P}/seen`, ...reads, c.seen);
router.get(`${P}/overdue`, ...remindsToo, c.overdue);
router.post(`${P}/:id/remind`, ...remindsToo, c.remind);
router.post(`${P}/:id/undo`, ...reads, c.undo);

export default router;

import { Router, type Request, type Response } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { attachWorkforceSubject } from '../people/people-subject';
import { ok, subjectOf } from '../rota/rota-http';
import { homeView } from './home-service';

/** Home for every signed-in person: GET /workforce/home. What it holds is decided by the access table, so no capability guard here. */
const router = Router();

router.get('/workforce/home', authenticate, attachWorkforceSubject, async (req: Request, res: Response): Promise<void> => ok(res, await homeView(subjectOf(req))));

export default router;

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../../middleware/authenticate';
import { attachWorkforceSubject } from '../people/people-subject';
import { ok, subjectOf } from '../rota/rota-http';
import { pageFor } from './page-for';

const query = z.object({ path: z.string().trim().min(1).max(200).regex(/^\/app\/[A-Za-z0-9/_-]*$/) }).strict();

/** GET /workforce/page-for?path=/app/workforce/payroll: who a page is for, from the access table, for the refusal screen. Any signed-in person may ask. */
const router = Router();
router.get('/workforce/page-for', authenticate, attachWorkforceSubject, (req: Request, res: Response): void => {
  ok(res, pageFor(query.parse(req.query).path, subjectOf(req)));
});

export default router;

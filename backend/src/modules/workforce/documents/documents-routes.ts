import { Router, type Request, type Response } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { ok, subjectOf } from '../rota/rota-http';
import { attachWorkforceSubject } from '../people/people-subject';
import { documentPanel, documentsQuery, listDocuments, numberParam, recordOpened, versionQuery } from './documents-service';

/** The Signed documents index (6c D2). Visibility is per type inside the service; a person who reads no type gets a 404. */
const router = Router();
const signedIn = [authenticate, attachWorkforceSubject] as const;

router.get('/workforce/documents', ...signedIn, async (req: Request, res: Response) => ok(res, await listDocuments(subjectOf(req), documentsQuery.parse(req.query))));
router.get('/workforce/documents/:number', ...signedIn, async (req: Request, res: Response) =>
  ok(res, await documentPanel(subjectOf(req), numberParam.parse(req.params).number, versionQuery.parse(req.query).v)),
);
router.post('/workforce/documents/:number/open', ...signedIn, async (req: Request, res: Response) =>
  ok(res, await recordOpened(subjectOf(req), numberParam.parse(req.params).number, versionQuery.parse(req.query).v)),
);

export default router;

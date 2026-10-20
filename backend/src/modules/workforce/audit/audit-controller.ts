import type { Request, Response } from 'express';
import { ok, subjectOf } from '../rota/rota-http';
import { phoneLabelOf, placeLabelOf } from '../security';
import { actorsQuery, answerBody, chainBody, exportQuery, idParam, listQuery, myRecordQuery } from './audit-validators';
import { checkChain } from './chain-service';
import { prepareExport } from './export-service';
import { entryDetail, findActors, listEntries, listFacets, readerOf } from './list-service';
import { logViewers } from './log-views';
import { answerEntry, myRecord, myRecordEntry } from './my-record/my-record-service';

const labelsOf = (req: Request) => ({ deviceLabel: phoneLabelOf(req.header('user-agent')), placeLabel: placeLabelOf((name) => req.header(name)) });

export const auditController = {
  list: async (req: Request, res: Response): Promise<void> => ok(res, await listEntries(subjectOf(req), listQuery.parse(req.query))),
  detail: async (req: Request, res: Response): Promise<void> => ok(res, await entryDetail(subjectOf(req), idParam.parse(req.params).id)),
  facets: async (req: Request, res: Response): Promise<void> => ok(res, await listFacets(await readerOf(subjectOf(req)))),
  actors: async (req: Request, res: Response): Promise<void> => ok(res, await findActors(subjectOf(req), actorsQuery.parse(req.query).q)),
  viewers: async (req: Request, res: Response): Promise<void> => ok(res, await logViewers(subjectOf(req))),
  chain: async (req: Request, res: Response): Promise<void> => ok(res, await checkChain(subjectOf(req), chainBody.parse(req.body))),

  /** A4. The file is written in pieces; the audit entry is committed before the first byte (see prepareExport). */
  export: async (req: Request, res: Response): Promise<void> => {
    const file = await prepareExport(subjectOf(req), exportQuery.parse(req.query));
    res.status(200);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Export-Rows', String(file.rows));
    for await (const chunk of file.chunks()) {
      if (!res.write(chunk)) await new Promise<void>((resolve) => res.once('drain', resolve));
    }
    res.end();
  },

  mine: async (req: Request, res: Response): Promise<void> => ok(res, await myRecord(subjectOf(req), myRecordQuery.parse(req.query))),
  mineOne: async (req: Request, res: Response): Promise<void> => ok(res, await myRecordEntry(subjectOf(req), idParam.parse(req.params).id)),
  answer: async (req: Request, res: Response): Promise<void> => ok(res, await answerEntry(subjectOf(req), idParam.parse(req.params).id, answerBody.parse(req.body), labelsOf(req))),
};

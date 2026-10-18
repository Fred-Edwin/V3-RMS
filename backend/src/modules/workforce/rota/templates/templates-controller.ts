import type { Request, Response } from 'express';
import { IdParamsSchema } from '../rota-fields';
import { ok, subjectOf } from '../rota-http';
import { templatesService } from './templates-service';
import { templatesUpdateService } from './templates-update-service';
import { TemplateCreateSchema, TemplatesQuerySchema, TemplateUpdateSchema } from './templates-validators';

const idOf = (req: Request): string => IdParamsSchema.parse(req.params).id;

/** Thin HTTP layer for shift templates (T1 to T5): parse, call the service, wrap the answer. No logic here. */
export const templatesController = {
  list: async (req: Request, res: Response): Promise<void> => {
    ok(res, await templatesService.list(subjectOf(req), TemplatesQuerySchema.parse(req.query)));
  },
  create: async (req: Request, res: Response): Promise<void> => {
    ok(res, await templatesService.create(subjectOf(req), TemplateCreateSchema.parse(req.body)), 201);
  },
  update: async (req: Request, res: Response): Promise<void> => {
    ok(res, await templatesUpdateService.update(subjectOf(req), idOf(req), TemplateUpdateSchema.parse(req.body)));
  },
  retire: async (req: Request, res: Response): Promise<void> => {
    ok(res, await templatesService.retire(subjectOf(req), idOf(req)));
  },
  restore: async (req: Request, res: Response): Promise<void> => {
    ok(res, await templatesService.restore(subjectOf(req), idOf(req)));
  },
};

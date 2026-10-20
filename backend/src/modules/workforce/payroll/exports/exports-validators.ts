import { z } from 'zod';
import { FORMATS_OF } from './export-model';

/** `kind` and `format` must go together (S9): the register is a PDF or an Excel, the others have one format. */
export const exportBody = z
  .object({
    kind: z.enum(['REGISTER', 'SUMMARY', 'STATUTORY', 'PAYSLIPS']),
    format: z.enum(['pdf', 'xlsx', 'zip']),
    idempotencyKey: z.string().trim().min(8).max(80),
  })
  .strict()
  .superRefine((body, ctx) => {
    if (!FORMATS_OF[body.kind].includes(body.format)) ctx.addIssue({ code: 'custom', path: ['format'], message: `This one is only available as ${FORMATS_OF[body.kind].join(' or ')}` });
  });
export type ExportBody = z.infer<typeof exportBody>;

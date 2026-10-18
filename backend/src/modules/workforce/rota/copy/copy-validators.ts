import { z } from 'zod';
import { idField, nairobiDateField, reasonField } from '../rota-fields';

export const CopySchema = z.object({
  siteId: idField.optional(),
  /** The week to fill; it is copied from the seven days before it. */
  weekStart: nairobiDateField,
  departmentId: idField.optional(),
  reason: reasonField.optional(),
});
export type CopyBody = z.infer<typeof CopySchema>;

import { z } from 'zod';

export const FileIdParamSchema = z.object({ id: z.string().uuid() });

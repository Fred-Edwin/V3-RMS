import { z } from 'zod';
import { addDepartmentInputSchema, listDepartmentsQuerySchema, renameDepartmentInputSchema } from './_shared/departments-contract';

export { addDepartmentInputSchema, listDepartmentsQuerySchema, renameDepartmentInputSchema };

export const departmentParamsSchema = z.object({ id: z.string().uuid() });

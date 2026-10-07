import type { z } from 'zod';
import type { CheckResult, CountDetail, SaveLinesResult, SignPreview, StartOptions } from '../_shared/counting-contract';
import type { checkInputSchema, saveLinesInputSchema, sectionOrderInputSchema, signInputSchema, startCountInputSchema, startOptionsQuerySchema } from './record-validators';

export type { CheckResult, CountDetail, SaveLinesResult, SignPreview, StartOptions };
export type StartOptionsQuery = z.infer<typeof startOptionsQuerySchema>;
export type StartCountInput = z.infer<typeof startCountInputSchema>;
export type SaveLinesInput = z.infer<typeof saveLinesInputSchema>;
export type CheckInput = z.infer<typeof checkInputSchema>;
export type SignInput = z.infer<typeof signInputSchema>;
export type SectionOrderInput = z.infer<typeof sectionOrderInputSchema>;

/** C9 and C13 answer 201/200 depending on whether the request was a replay of one already done. */
export type CountOutcome = { detail: CountDetail; replayed: boolean };

export type SectionOrderResult = { sectionIds: string[]; appliesTo: string };

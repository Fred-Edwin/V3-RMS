import type { z } from 'zod';
import type { ApprovePreview, CountDetail } from '../_shared/counting-contract';
import type { approveInputSchema, decisionInputSchema, seenInputSchema } from './review-validators';

export type { ApprovePreview, CountDetail };
export type DecisionInput = z.infer<typeof decisionInputSchema>;
export type ApproveInput = z.infer<typeof approveInputSchema>;
export type SeenInput = z.infer<typeof seenInputSchema>;

/** C29 answers 200 either way; a retried key returns the approved count again. */
export type ApproveOutcome = { detail: CountDetail; replayed: boolean };
export type SeenResult = { seen: number };

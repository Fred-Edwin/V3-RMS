import type { z } from 'zod';
import type { ThresholdsSchema, UpdateDirectorThresholdSchema, UpdateStoreThresholdsSchema } from './thresholds-validators';

export type Thresholds = z.infer<typeof ThresholdsSchema>;
export type UpdateStoreThresholdsInput = z.infer<typeof UpdateStoreThresholdsSchema>;
export type UpdateDirectorThresholdInput = z.infer<typeof UpdateDirectorThresholdSchema>;

import type { z } from 'zod';
import type { CountSettings, SettingsPreview } from '../_shared/counting-contract';
import type { settingsPreviewQuerySchema, updateDirectorAlertInputSchema, updateSettingsInputSchema } from './settings-validators';

export type { CountSettings, SettingsPreview };
export type SettingsPreviewQuery = z.infer<typeof settingsPreviewQuerySchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsInputSchema>;
export type UpdateDirectorAlertInput = z.infer<typeof updateDirectorAlertInputSchema>;

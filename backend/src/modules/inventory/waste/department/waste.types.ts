/**
 * Inventory — Milestone Six, Session 1 (Waste)
 * FROZEN API CONTRACT — TypeScript types, inferred from `waste-validators.ts`.
 * Mirrored (by hand) in `frontend/features/inventory/types/waste.ts`.
 */
import type { z } from 'zod';

import type {
  AttendantCreateWasteResultSchema,
  AttendantWasteItemOptionListSchema,
  CreateWasteResultSchema,
  CreateWasteSchema,
  ListWasteQuerySchema,
  WasteEntrySchema,
  WasteItemOptionListSchema,
  WasteItemsQuerySchema,
  WasteListSchema,
  wasteReasonSchema,
} from './waste-validators';

export type WasteReasonValue = z.infer<typeof wasteReasonSchema>;

export type CreateWasteInput = z.infer<typeof CreateWasteSchema>;
export type WasteEntry = z.infer<typeof WasteEntrySchema>;
export type CreateWasteResult = z.infer<typeof CreateWasteResultSchema>;
export type AttendantCreateWasteResult = z.infer<typeof AttendantCreateWasteResultSchema>;

export type ListWasteQuery = z.infer<typeof ListWasteQuerySchema>;
export type WasteList = z.infer<typeof WasteListSchema>;

export type WasteItemsQuery = z.infer<typeof WasteItemsQuerySchema>;
export type WasteItemOptionList = z.infer<typeof WasteItemOptionListSchema>;
export type AttendantWasteItemOptionList = z.infer<typeof AttendantWasteItemOptionListSchema>;

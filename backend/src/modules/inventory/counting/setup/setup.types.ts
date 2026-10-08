import type { z } from 'zod';
import type { AddItemsList, LayoutInput, MoveView, SectionItems, SetupView } from '../_shared/counting-contract';
import type { addItemsInputSchema, addItemsQuerySchema, addSectionInputSchema, moveItemInputSchema } from './setup-validators';

export type { AddItemsList, LayoutInput, MoveView, SectionItems, SetupView };
export type AddItemsQuery = z.infer<typeof addItemsQuerySchema>;
export type AddItemsInput = z.infer<typeof addItemsInputSchema>;
export type AddSectionInput = z.infer<typeof addSectionInputSchema>;
export type MoveItemInput = z.infer<typeof moveItemInputSchema>;

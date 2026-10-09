/**
 * The waste reason values the stock screens still label (`stock-format.ts`). The old `/inventory/waste` request and response types
 * are deleted with their endpoints (Block 3); the live ones are `waste/_shared/types/waste-contract.ts`.
 */

export type WasteReasonValue = 'SPOILAGE' | 'EXPIRY' | 'DAMAGE_IN_STORE' | 'PREP_ERROR';

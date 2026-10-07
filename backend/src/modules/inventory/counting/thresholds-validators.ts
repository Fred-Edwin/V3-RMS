// kept for the branch-day refactor: delete when branch day is redone
/**
 * Inventory — Milestone Six, Session 2 (Counting thresholds)
 * FROZEN API CONTRACT. Source of truth for `API_CONTRACT.md` §26.2
 * (thresholds rows). Plan §1.9. Values are whole KES, 0…1,000,000; 0 = "always".
 *
 * The write schema is chosen by role in the service/controller, so a Store
 * Manager cannot send branch-only fields (`.strict()` → 400) and vice versa.
 */
import { z } from 'zod';
import { THRESHOLD_MAX_KES, THRESHOLD_MIN_KES } from './counting-thresholds';

const isoDate = z.string().datetime({ offset: true });
const kes = z.number().int().min(THRESHOLD_MIN_KES).max(THRESHOLD_MAX_KES);

export const ThresholdsSchema = z.object({
  reasonRequiredKes: z.number().int(),
  /** Branch rows only; null on the hub row. */
  overnightAlertKes: z.number().int().nullable(),
  /** Company-wide, read from the hub row. Read-only here; the Director sets it. */
  directorAlertKes: z.number().int(),
  /** True when no row exists yet and the defaults apply. */
  isDefault: z.boolean(),
  updatedBy: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
  updatedAt: isoDate.nullable(),
  directorUpdatedBy: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
  directorUpdatedAt: isoDate.nullable(),
});

/** Store Manager — the Central Store's reason threshold only. */
export const UpdateStoreThresholdsSchema = z.object({ reasonRequiredKes: kes }).strict();

/** Branch Manager — their own branch's reason and overnight thresholds. */
export const UpdateBranchThresholdsSchema = z.object({ reasonRequiredKes: kes, overnightAlertKes: kes }).strict();

/** Director — the company-wide alert amount (API only this milestone). */
export const UpdateDirectorThresholdSchema = z.object({ directorAlertKes: kes }).strict();

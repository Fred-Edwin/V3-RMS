import type { HrDocumentType, UserRole } from '@prisma/client';

/**
 * Roles that never get an EmployeeProfile:
 * - DIRECTOR / HR_MANAGER / SYSTEM_ADMIN: org-level, no branch duties
 * - KITCHEN_DISPLAY / BARISTA_DISPLAY: shared display accounts, not individual staff
 *
 * Single source of truth — used by staff-service auto-creation and the
 * seed-employee-profiles backfill script. Keep them in sync by importing this.
 */
export const PROFILE_EXCLUDED_ROLES: UserRole[] = [
  'DIRECTOR',
  'HR_MANAGER',
  'SYSTEM_ADMIN',
  'KITCHEN_DISPLAY',
  'BARISTA_DISPLAY',
];

/**
 * Document types staff may upload to their own profile.
 * CONTRACT / WARNING_LETTER / INCIDENT_REPORT are HR-issued records and stay HR-only.
 */
export const SELF_UPLOADABLE_DOCUMENT_TYPES: HrDocumentType[] = [
  'ID_COPY',
  'CERTIFICATE',
  'MEDICAL_CERTIFICATE',
  'OTHER',
];

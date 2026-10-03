/**
 * Back-compat re-export. `SignSheetDialog`/`SignedBySignature` were promoted
 * to `components/app/shell/sign-sheet.tsx` — genuinely shared (receiving
 * signs, requisitions sign, Milestone Five's dispatch will sign too), and it
 * makes no API call. Import from `@/components/app/shell/sign-sheet` (or the
 * `features/inventory` barrel) in new code; this file only exists so
 * Milestone Two's receiving screens didn't need an import-path edit.
 */
export { SignSheetDialog, SignedBySignature } from '@/components/app/shell/sign-sheet';
export type {
  SignSheetDialogProps,
  SignSheetDocumentSummary,
  SignedBySignatureProps,
} from '@/components/app/shell/sign-sheet';

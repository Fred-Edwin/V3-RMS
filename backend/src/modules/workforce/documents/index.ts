/**
 * THE door of the Signed documents index (Segment 6b, 6c D1 and D2).
 *   workforceDocumentsRouter     mounted once in routes/index.ts
 *   registerDocuments()          start-up: where the built issuers' documents come from
 *   reconcileDocuments()         index every already-issued number (deploy, nightly)
 * Leave and Conduct call `registerDocument` / `withdrawDocument` from the module door, inside their signing transaction.
 */
export { default as workforceDocumentsRouter } from './documents-routes';
export { registerDocuments } from './register-documents';
export { reconcileDocuments, type ReconcileResult } from './reconcile';

import type { DocumentKind } from './document-kinds';
import type { DocumentSource } from './documents.types';

/**
 * Who has issued documents already. The built issuers (payroll, payslips, casual, timesheets, P9) register a source at start-up; the
 * reconciliation reads each source and writes what is missing through `registerDocument`. Leave and Conduct register no source:
 * they call `registerDocument` from their own signing transaction.
 */
const sources = new Map<DocumentKind, DocumentSource>();

export function registerDocumentSource(kind: DocumentKind, source: DocumentSource): void {
  sources.set(kind, source);
}

export const documentSources = (): ReadonlyMap<DocumentKind, DocumentSource> => sources;

/** Test seam. */
export function clearDocumentSources(): void {
  sources.clear();
}

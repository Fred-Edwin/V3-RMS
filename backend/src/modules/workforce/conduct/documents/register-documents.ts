import type { AccessSubject } from '../../_shared/workforce-access';
import { noticeDocument, type RenderedDocument } from './document-service';

/** What the documents door (back end B) needs to list and serve a Conduct letter. */
export interface ConductDocumentProvider {
  kind: 'conduct-notice';
  open(subject: AccessSubject, noticeId: string, version: 'latest' | number, origin: string, deviceLabel: string | null): Promise<RenderedDocument>;
}

export const conductDocumentProvider: ConductDocumentProvider = { kind: 'conduct-notice', open: noticeDocument };

/** Hands the Conduct provider to the documents door. Called once at start-up by whoever builds that door. */
export function registerConductDocuments(register: (provider: ConductDocumentProvider) => void): void {
  register(conductDocumentProvider);
}

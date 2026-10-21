'use client';

import * as React from 'react';

import { PdfViewer, WorkforceDrawer } from '../../../_shared';
import { openDocument } from '../services/documents-services';
import type { DocumentPanelData } from '../types/documents-types';

/**
 * The Document view for the index: the stored PDF drawn in a drawer by the kit's `PdfViewer`. Opening writes `document.opened` (the API
 * does it in the same call). A file that fails to open shows the kit's error with "Try again"; the button on the panel stays usable.
 * The spoken name carries the number and title only, never an amount.
 */
export function DocumentViewer({ doc, onClose }: { doc: DocumentPanelData | null; onClose: () => void }) {
  const load = React.useCallback(() => (doc ? openDocument(doc) : Promise.reject(new Error('none'))), [doc]);
  return (
    <WorkforceDrawer open={doc !== null} onOpenChange={(open) => !open && onClose()} title={doc ? `${doc.number}` : 'Document'} subtitle={doc ? `${doc.title} · ${doc.about}` : undefined}>
      {doc ? (
        <div className="h-[70vh] min-h-[360px]">
          <PdfViewer key={`${doc.number}.${doc.version}`} load={load} name={`${doc.title} ${doc.number}`} hint="Scroll to read · use the buttons to zoom" />
        </div>
      ) : null}
    </WorkforceDrawer>
  );
}

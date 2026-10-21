import type { StatusTagTone } from '../../../_shared';
import { formatDayMonth, formatDayMonthYear } from '../../_shared/lib/people-dates';
import type { DocumentRow, EmployeeFile } from '../../_shared/types/people-types';
import { firstName, REQUEST_LABELS } from './file-model';

/** The Documents tab: what is on file, what is missing, and what was asked of the person. One list, in that order of urgency. */

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  CONTRACT: 'Employment contract',
  ID_COPY: 'ID copy',
  NATIONAL_ID_FRONT: 'National ID, front',
  NATIONAL_ID_BACK: 'National ID, back',
  CERTIFICATE: 'Certificate',
  MEDICAL_CERTIFICATE: 'Medical certificate',
  INCIDENT_REPORT: 'Incident report',
  WARNING_LETTER: 'Warning letter',
  OTHER: 'Other document',
};

export interface DocumentLine {
  key: string;
  title: string;
  detail: string;
  detailTone: 'muted' | 'warning';
  status: { label: string; tone: StatusTagTone };
  /** Set only for a real file, which can be opened. */
  documentId: string | null;
}

export function documentLines(file: EmployeeFile, documents: DocumentRow[]): DocumentLine[] {
  const first = firstName(file.name);
  const lines: DocumentLine[] = [];
  const hasContract = documents.some((d) => d.documentType === 'CONTRACT') || file.contractStatus === 'ACTIVE';
  if (file.employment === 'MONTHLY' && !hasContract && file.status !== 'EXITED') {
    const by = file.probation && !file.probation.confirmedOn ? ` before probation ends on ${formatDayMonth(file.probation.endsOn)}` : '';
    lines.push({ key: 'missing-contract', title: 'Employment contract', detail: `Needed${by}`, detailTone: 'warning', status: { label: 'Missing', tone: 'warning' }, documentId: null });
  }
  // A recorded contract with no scanned copy still shows here, so Documents and Overview agree (finding 19).
  const recorded = file.timeline.find((e) => e.kind === 'CONTRACT');
  if (recorded && !documents.some((d) => d.documentType === 'CONTRACT')) {
    const type = typeof recorded.detail.type === 'string' ? `${recorded.detail.type}, ` : '';
    lines.push({ key: 'recorded-contract', title: 'Employment contract', detail: `${type}recorded ${formatDayMonthYear(recorded.on)}. No signed copy uploaded yet.`, detailTone: 'muted', status: { label: 'Recorded', tone: 'neutral' }, documentId: null });
  }
  for (const step of file.nextSteps) {
    if (step.code !== 'FILE_REQUEST' || !step.fileRequestKind) continue;
    const when = step.fileRequestAskedOn ? ` on ${formatDayMonth(step.fileRequestAskedOn)}` : '';
    lines.push({ key: `ask-${step.fileRequestId}`, title: REQUEST_LABELS[step.fileRequestKind], detail: `Asked of ${first}${when}`, detailTone: 'warning', status: { label: `Waiting for ${first}`, tone: 'warning' }, documentId: null });
  }
  for (const d of documents) {
    lines.push({
      key: d.id,
      title: DOCUMENT_TYPE_LABELS[d.documentType] ?? d.documentType,
      detail: `${d.fileName} · uploaded by ${d.uploadedByName ?? 'someone'}, ${formatDayMonthYear(d.uploadedOn)}`,
      detailTone: 'muted',
      status: { label: 'On file', tone: 'neutral' },
      documentId: d.id,
    });
  }
  return lines;
}

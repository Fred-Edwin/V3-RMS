import type { TableCopy } from '@/components/ui2/data-table/data-table';
import type { RequisitionTab } from '../types/requisitions-contract';

const error = { errorTitle: "Couldn't load requisitions", errorDescription: 'Check your connection and try again.' } as const;
const filtered = { filteredEmptyTitle: 'No requisition matches', filteredEmptyDescription: 'Clear the search or a filter to see more.' } as const;

const copy = (emptyTitle: string, emptyDescription: string): TableCopy => ({ emptyTitle, emptyDescription, ...filtered, ...error });

/** Per-screen wording on the shared States kit (Paper step 21): one table, never an artboard per screen. */
export const LIST_COPY: Record<RequisitionTab | 'history', TableCopy> = {
  collecting: copy('Nothing being collected', 'Start this cycle’s requisition and the heads can begin filling theirs.'),
  'to-approve': copy('Nothing waiting for you', 'When a requisition needs your signature it shows up here.'),
  'to-pack': copy('Nothing to pack', 'Approved requisitions show up here for the Central Store to pack.'),
  'on-the-way': copy('Nothing on the way', 'Packed deliveries show up here until the branch counts them.'),
  'to-confirm': copy('Nothing to confirm', 'Deliveries waiting to be counted at a branch show up here.'),
  discrepancies: copy('No discrepancies', 'A gap between what was sent and what a branch counted shows up here.'),
  closed: copy('Nothing closed yet', 'Requisitions that are closed or cancelled show up here.'),
  history: copy('Nothing in this range', 'Closed and cancelled requisitions show up here. Try a wider date range.'),
};

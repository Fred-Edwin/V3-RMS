export { PrintableRequisition as default } from './printable-requisition';
export type { PrintableRequisitionProps } from './printable-requisition';

/** sessionStorage key shared between the approval screen (writer) and the print route (reader). */
export const PRINT_HANDOFF_KEY = 'requisitions:approval:print-draft';

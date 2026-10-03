import { useCallback } from 'react';

import { getSupplierApDetail } from '../../services';
import {
  getSupplierCatalogSummary,
  getSupplierDetail,
  getSupplierSummary,
  listSupplierCatalog,
  listSupplierDocuments,
  listSupplierPackMismatches,
  listSupplierPayMethodHistory,
} from '../../services';
import { useLoader } from '../../_shared/hooks/use-async';

/**
 * Everything one supplier page reads. The supplier itself decides whether the page loads (an error there is the
 * page's error); the tabs' data each have their own status, so one failing tab does not take the others down.
 * The counts on the tab labels come from the same data the tabs show.
 */
export function useSupplierPage(supplierId: string | null, can: { paymentDetails: boolean; payables: boolean } = { paymentDetails: true, payables: true }) {
  const detail = useLoader(supplierId, () => getSupplierDetail(supplierId as string), 'Could not load this supplier.');
  const ready = detail.status === 'ready' ? supplierId : null;
  const catalog = useLoader(ready, () => listSupplierCatalog(ready as string), 'Could not load what this supplier sells.');
  const catalogSummary = useLoader(ready, () => getSupplierCatalogSummary(ready as string), 'Could not load the catalog numbers.');
  const mismatches = useLoader(ready, () => listSupplierPackMismatches(ready as string), 'Could not load the pack check.');
  const documents = useLoader(ready, () => listSupplierDocuments(ready as string), 'Could not load the documents.');
  const summary = useLoader(ready, () => getSupplierSummary(ready as string), 'Could not load the purchase numbers.');
  // Only the roles that may see them: what we owe, and the history of payment-detail changes.
  const owing = useLoader(can.payables ? ready : null, () => getSupplierApDetail(ready as string), 'Could not load what we owe.');
  const history = useLoader(can.paymentDetails ? ready : null, () => listSupplierPayMethodHistory(ready as string), 'Could not load the change history.');

  const { reload: reloadDetail } = detail;
  const { reload: reloadCatalog } = catalog;
  const { reload: reloadCatalogSummary } = catalogSummary;
  const { reload: reloadMismatches } = mismatches;
  const { reload: reloadHistory } = history;
  const { reload: reloadDocuments } = documents;
  const { reload: reloadOwing } = owing;
  /** A price or line changed: the lines, their strip and the pack check. */
  const reloadCatalogAll = useCallback(async () => {
    await Promise.all([reloadCatalog(), reloadCatalogSummary(), reloadMismatches()]);
  }, [reloadCatalog, reloadCatalogSummary, reloadMismatches]);
  /** Payment details changed: the supplier (its methods and checklist) and the history under them. */
  const reloadPayments = useCallback(async () => {
    await Promise.all([reloadDetail(), reloadHistory()]);
  }, [reloadDetail, reloadHistory]);

  /** An invoice or payment was recorded: what we owe, the strip numbers and the documents list. */
  const reloadMoney = useCallback(async () => {
    await Promise.all([reloadDetail(), reloadOwing(), reloadDocuments()]);
  }, [reloadDetail, reloadOwing, reloadDocuments]);

  return { detail, catalog, catalogSummary, mismatches, documents, summary, history, owing, reloadCatalogAll, reloadPayments, reloadMoney };
}

'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { Topbar } from '@/components/app/shell/topbar';
import { PermissionDeniedState } from '@/components/app/shell/shell-states';
import { Skeleton } from '@/components/ui2/skeleton';
import { formatApiErrorMessage } from '@/types/api';
import { useAuthStore } from '@/store/authStore';
import { useCategoryOptions } from '../../../catalog/hooks/use-item-form';
import { useSupplierPage } from '../../hooks/use-supplier-page';
import { confirmSupplierPreferred, updateSupplierContact } from '../../../services';
import type { SupplierCatalogLine, SupplierContact, SupplierPayMethod } from '../../types/supplier';
import { PROFILE_TOTAL, profileChecklist, type ProfileKey } from '../../lib/supplier-logic';
import { StockErrorCard } from '../../../_shared/components/stock-states';
import { DrawerHost } from '../../../catalog/components/drawer-parts';
import { AddItemsView } from '../add-items-view';
import { AddOneView } from '../add-one-view';
import { CatalogTab } from '../catalog-tab';
import { ContactView } from '../contact-view';
import { ContactsTab } from '../contacts-tab';
import { DocumentsTab } from '../documents-tab';
import { DetailsCards, NothingBoughtCard, OverviewStrip, OwedCard, ProfileCard } from '../overview-tab';
import { AddPayMethodView, ChangePayMethodView } from '../pay-method-views';
import { PaymentTab } from '../payment-tab';
import { SupplierFormView } from '../supplier-form-view';
import { SupplierStatusDialogs } from '../supplier-status-dialogs';
import { MOVE_LABEL, movesFor, type StatusMove } from '../../lib/supplier-status';
import { SupplierTabs, SupplierTitle, type SupplierTab } from '../supplier-page-header';
import { InlineNotice } from '../supplier-ui';
import { UploadView } from '../upload-view';
import { RecordSupplierInvoiceDrawer } from '../../../purchasing/components/screens/record-supplier-invoice-drawer';
import { RecordSupplierPaymentDrawer } from '../../../purchasing/components/screens/record-supplier-payment-drawer';

const ROLES_THAT_READ = new Set(['STORE_MANAGER', 'ACCOUNTANT', 'DIRECTOR']);

type DrawerView =
  | { kind: 'edit' }
  | { kind: 'addContact' }
  | { kind: 'editContact'; contact: SupplierContact }
  | { kind: 'addMethod' }
  | { kind: 'changeMethod'; method: SupplierPayMethod }
  | { kind: 'addSeveral' }
  | { kind: 'addOne'; presetItemId?: string }
  | { kind: 'upload' };

const DRAWER_LABEL: Record<DrawerView['kind'], string> = {
  edit: 'Edit supplier',
  addContact: 'Add contact',
  editContact: 'Edit contact',
  addMethod: 'Add a payment method',
  changeMethod: 'Change payment details',
  addSeveral: 'Add several items',
  addOne: 'Add one',
  upload: 'Upload file',
};

function PageSkeleton() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-[18px]">
      <span className="sr-only">Loading supplier</span>
      <Skeleton className="h-8 w-[320px]" />
      <Skeleton className="h-3 w-[420px]" />
      <Skeleton className="mt-2 h-24 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

/**
 * One supplier — Paper "Chapter 5 · Keep a supplier current". Overview, Contacts, Payment, Catalog and Documents are the
 * five tabs; the drawers (edit, payment details, add items, contacts, upload) open over whichever tab asked. The Store
 * Manager reads and writes; the Accountant also changes payment details, uploads documents and records payments;
 * Directors read. Put on hold, Archive and Make active open the chapter 8 dialogs.
 */
export function SupplierPageScreen({ id }: { id: string }) {
  const role = useAuthStore((s) => s.role);
  const canRead = role !== null && ROLES_THAT_READ.has(role);
  const isManager = role === 'STORE_MANAGER';
  const canEditPayments = role === 'STORE_MANAGER' || role === 'ACCOUNTANT';

  const [tab, setTab] = React.useState<SupplierTab>('overview');
  const [drawer, setDrawer] = React.useState<DrawerView | null>(null);
  const [invoiceOpen, setInvoiceOpen] = React.useState(false);
  const [paymentOpen, setPaymentOpen] = React.useState(false);
  const [flash, setFlash] = React.useState<string | null>(null);
  const [statusMove, setStatusMove] = React.useState<StatusMove | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [makingPrimaryId, setMakingPrimaryId] = React.useState<string | null>(null);
  const [savingPreferredId, setSavingPreferredId] = React.useState<string | null>(null);

  const page = useSupplierPage(canRead ? id : null);
  const { categories } = useCategoryOptions(drawer?.kind === 'edit');
  const supplier = page.detail.data;
  const { reload: reloadDetail } = page.detail;
  const { reload: reloadDocuments } = page.documents;
  const { reloadCatalogAll, reloadPayments } = page;

  // The drawer keeps its last content while it slides closed.
  const [lastDrawer, setLastDrawer] = React.useState<DrawerView | null>(null);
  React.useEffect(() => {
    if (drawer) setLastDrawer(drawer);
  }, [drawer]);
  const closeDrawer = React.useCallback(() => setDrawer(null), []);

  React.useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 6000);
    return () => clearTimeout(timer);
  }, [flash]);

  const soldItemIds = React.useMemo(() => new Set((page.catalog.data ?? []).map((l) => l.inventoryItemId)), [page.catalog.data]);

  if (!canRead) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Topbar breadcrumb={{ section: 'Central Store', screen: 'Suppliers', sectionHref: '/app/inventory/suppliers' }} hideSearch className="shrink-0" />
        <div className="flex flex-1 items-center justify-center">
          <PermissionDeniedState description="Suppliers are visible to the Store Manager, the Accountant and Directors only." />
        </div>
      </div>
    );
  }

  const profile = supplier ? profileChecklist(supplier) : { done: PROFILE_TOTAL };
  const owed = page.owing.data?.row.outstanding ?? null;
  const neverBought = page.catalog.status === 'ready' && (page.catalog.data?.length ?? 0) === 0;
  const counts = {
    contacts: supplier ? supplier.contacts.length : null,
    payment: supplier ? supplier.paymentMethods.length : null,
    catalog: page.catalog.data ? page.catalog.data.length : null,
    documents: page.documents.data ? page.documents.data.length : null,
  };

  const addFromChecklist = (key: ProfileKey) => {
    if (key === 'contact') setDrawer({ kind: 'addContact' });
    else if (key === 'payment') setDrawer({ kind: 'addMethod' });
    else setDrawer({ kind: 'edit' });
  };

  const makePrimary = async (contact: SupplierContact) => {
    setMakingPrimaryId(contact.id);
    setProblem(null);
    try {
      await updateSupplierContact(id, contact.id, { isPrimary: true });
      await reloadDetail();
      setFlash(`${contact.name} is now the primary contact.`);
    } catch (err) {
      setProblem(formatApiErrorMessage(err, 'Could not change the primary contact.'));
    } finally {
      setMakingPrimaryId(null);
    }
  };

  const setPreferred = async (line: SupplierCatalogLine) => {
    setSavingPreferredId(line.id);
    setProblem(null);
    try {
      await confirmSupplierPreferred(id, line.inventoryItemId, line.id);
      await reloadCatalogAll();
      setFlash(`${line.itemName} is preferred from this supplier.`);
    } catch (err) {
      setProblem(formatApiErrorMessage(err, 'Could not set the preferred supplier.'));
    } finally {
      setSavingPreferredId(null);
    }
  };

  const shown = drawer ?? lastDrawer;
  const drawerBody = (() => {
    if (!supplier || !shown) return null;
    switch (shown.kind) {
      case 'edit':
        return (
          <SupplierFormView
            supplier={supplier}
            categories={categories}
            onCancel={closeDrawer}
            onSaved={() => {
              closeDrawer();
              void reloadDetail();
              setFlash('Supplier saved.');
            }}
          />
        );
      case 'addContact':
      case 'editContact':
        return (
          <ContactView
            supplierId={id}
            supplierName={supplier.name}
            contact={shown.kind === 'editContact' ? shown.contact : undefined}
            onCancel={closeDrawer}
            onSaved={() => {
              closeDrawer();
              void reloadDetail();
              setFlash(shown.kind === 'editContact' ? 'Contact saved.' : 'Contact added.');
            }}
          />
        );
      case 'addMethod':
        return (
          <AddPayMethodView
            supplierId={id}
            supplierName={supplier.name}
            onCancel={closeDrawer}
            onAdded={() => {
              closeDrawer();
              void reloadPayments();
              setFlash('Payment method added. The Accountant has been told.');
            }}
          />
        );
      case 'changeMethod':
        return (
          <ChangePayMethodView
            supplierId={id}
            supplierName={supplier.name}
            method={shown.method}
            onCancel={closeDrawer}
            onSaved={() => {
              closeDrawer();
              void reloadPayments();
              setFlash('Payment details changed. The Accountant has been told.');
            }}
          />
        );
      case 'addSeveral':
        return (
          <AddItemsView
            supplierId={id}
            supplierName={supplier.name}
            soldItemIds={soldItemIds}
            onCancel={closeDrawer}
            onAdded={(count) => {
              closeDrawer();
              void reloadCatalogAll();
              setFlash(count === 1 ? '1 item added.' : `${count} items added.`);
            }}
          />
        );
      case 'addOne':
        return (
          <AddOneView
            supplierId={id}
            supplierName={supplier.name}
            presetItemId={shown.presetItemId}
            onCancel={closeDrawer}
            onAdded={() => {
              closeDrawer();
              void reloadCatalogAll();
              setFlash('Item added.');
            }}
          />
        );
      case 'upload':
        return (
          <UploadView
            supplierId={id}
            supplierName={supplier.name}
            onCancel={closeDrawer}
            onUploaded={() => {
              closeDrawer();
              void reloadDocuments();
              setFlash('File uploaded.');
            }}
          />
        );
    }
  })();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar
        breadcrumb={
          supplier
            ? { root: 'Central Store', section: 'Suppliers', sectionHref: '/app/inventory/suppliers', screen: supplier.name }
            : { section: 'Central Store', screen: 'Suppliers', sectionHref: '/app/inventory/suppliers' }
        }
        hideSearch
        actions={
          isManager && supplier ? (
            <div className="flex items-center gap-2">
              {movesFor(supplier.status).map((move) => (
                <Button key={move} variant="secondary" className="px-3.5" onClick={() => setStatusMove(move)}>
                  {MOVE_LABEL[move]}
                </Button>
              ))}
              <Button variant="secondary" className="px-3.5" onClick={() => setDrawer({ kind: 'edit' })}>
                Edit supplier
              </Button>
            </div>
          ) : null
        }
        className="shrink-0"
      />
      <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-8 py-[26px]">
        {page.detail.status === 'error' ? (
          <StockErrorCard title="Couldn’t load this supplier" description={page.detail.error ?? 'Check your connection and try again.'} onRetry={() => void page.detail.reload()} />
        ) : !supplier ? (
          <PageSkeleton />
        ) : (
          <>
            <SupplierTitle supplier={supplier} />
            <SupplierTabs active={tab} counts={counts} onChange={setTab} />
            {flash ? <InlineNotice tone="info">{flash}</InlineNotice> : null}
            {problem ? <InlineNotice>{problem}</InlineNotice> : null}
            <div role="tabpanel" id={`supplier-panel-${tab}`} aria-labelledby={`supplier-tab-${tab}`} className="flex flex-col gap-[18px]">
              {tab === 'overview' ? (
                <>
                  {profile.done < PROFILE_TOTAL ? <ProfileCard supplier={supplier} canEdit={isManager} onAdd={addFromChecklist} /> : null}
                  {neverBought ? (
                    <NothingBoughtCard supplierName={supplier.name} canEdit={isManager} onAdd={() => setDrawer({ kind: 'addSeveral' })} />
                  ) : (
                    <>
                      <OverviewStrip summary={page.summary.data} spend90Days={page.catalogSummary.data?.spend90Days ?? null} />
                      <DetailsCards supplier={supplier} />
                    </>
                  )}
                  {!neverBought || Number.parseFloat(owed ?? '0') > 0 ? (
                    <OwedCard
                      owed={owed}
                      ap={page.owing.data}
                      canRecordInvoice={isManager}
                      canRecordPayment={canEditPayments}
                      onRecordInvoice={() => setInvoiceOpen(true)}
                      onRecordPayment={() => setPaymentOpen(true)}
                    />
                  ) : null}
                </>
              ) : null}
              {tab === 'contacts' ? (
                <ContactsTab
                  supplierName={supplier.name}
                  contacts={supplier.contacts}
                  canEdit={isManager}
                  makingPrimaryId={makingPrimaryId}
                  onAdd={() => setDrawer({ kind: 'addContact' })}
                  onEdit={(contact) => setDrawer({ kind: 'editContact', contact })}
                  onMakePrimary={(contact) => void makePrimary(contact)}
                />
              ) : null}
              {tab === 'payment' ? (
                <PaymentTab
                  supplierId={id}
                  methods={supplier.paymentMethods}
                  history={page.history.data}
                  historyError={page.history.status === 'error' ? page.history.error : null}
                  onRetryHistory={() => void page.history.reload()}
                  canEdit={canEditPayments}
                  onAdd={() => setDrawer({ kind: 'addMethod' })}
                  onChange={(method) => setDrawer({ kind: 'changeMethod', method })}
                  onRemoved={() => {
                    void reloadPayments();
                    setFlash('Payment method removed.');
                  }}
                />
              ) : null}
              {tab === 'catalog' ? (
                page.catalog.status === 'error' ? (
                  <StockErrorCard title="Couldn’t load the catalog" description={page.catalog.error ?? 'Try again.'} onRetry={() => void page.catalog.reload()} />
                ) : (
                  <CatalogTab
                    supplierName={supplier.name}
                    lines={page.catalog.data ?? []}
                    summary={page.catalogSummary.data}
                    mismatches={page.mismatches.data ?? []}
                    canEdit={isManager}
                    savingPreferredId={savingPreferredId}
                    onAddOne={(itemId) => setDrawer({ kind: 'addOne', presetItemId: itemId })}
                    onAddSeveral={() => setDrawer({ kind: 'addSeveral' })}
                    onSetPreferred={(line) => void setPreferred(line)}
                  />
                )
              ) : null}
              {tab === 'documents' ? (
                page.documents.status === 'error' ? (
                  <StockErrorCard title="Couldn’t load the documents" description={page.documents.error ?? 'Try again.'} onRetry={() => void page.documents.reload()} />
                ) : (
                  <DocumentsTab supplierId={id} entries={page.documents.data ?? []} canUpload={canEditPayments} onUpload={() => setDrawer({ kind: 'upload' })} />
                )
              ) : null}
            </div>
          </>
        )}
      </div>

      {supplier ? (
        <>
          <DrawerHost open={drawer !== null} onOpenChange={(open) => !open && closeDrawer()} label={shown ? DRAWER_LABEL[shown.kind] : 'Supplier'}>
            {drawerBody}
          </DrawerHost>
          <RecordSupplierInvoiceDrawer
            supplierId={id}
            supplierName={supplier.name}
            open={invoiceOpen}
            onOpenChange={setInvoiceOpen}
            onRecorded={() => void page.reloadMoney()}
            variant="desktop"
          />
          <RecordSupplierPaymentDrawer
            supplierId={id}
            supplierName={supplier.name}
            open={paymentOpen}
            onOpenChange={setPaymentOpen}
            onRecorded={() => void page.reloadMoney()}
            variant="desktop"
          />
          <SupplierStatusDialogs
            move={statusMove}
            supplier={supplier}
            invoices={page.owing.data?.invoices ?? null}
            onClose={() => setStatusMove(null)}
            onChanged={(status) => {
              setFlash(status === 'ACTIVE' ? `${supplier.name} is active.` : status === 'ON_HOLD' ? `${supplier.name} is on hold.` : `${supplier.name} is archived.`);
              void page.reloadMoney();
            }}
            onSeeOwed={() => setTab('overview')}
          />
        </>
      ) : null}
    </div>
  );
}

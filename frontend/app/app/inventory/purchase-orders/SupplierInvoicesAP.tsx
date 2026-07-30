'use client';

import { useCallback, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { ArrowLeft, FileText, Plus, Search } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ExcelTable,
  FormField,
  Input,
  Modal,
  Select,
  type ExcelColumn,
  type SelectOption,
} from '@/components/ui';
import {
  createSupplierInvoice,
  listPurchaseOrders,
  listSupplierInvoices,
  listSuppliers,
  recordSupplierPayment,
} from '@/services/inventoryService';
import { useToast } from '@/hooks/useToast';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/cn';
import type {
  PurchaseOrder,
  SupplierInvoice,
  SupplierPaymentMethod,
  SupplierWithItemCount,
} from '@/types/inventory';

type SupplierInvoicesAPProps = {
  mode: 'desktop' | 'mobile';
  onMobileDetailChange?: (hasDetail: boolean) => void;
};

type InvoiceStatus = SupplierInvoice['status'];

interface InvoiceRow extends Record<string, unknown> {
  invoice: SupplierInvoice;
}

interface SupplierTotal {
  supplierId: string;
  supplierName: string;
  totalInvoiced: number;
  totalPaid: number;
  outstanding: number;
  openCount: number;
}

const PAYMENT_METHODS: SelectOption[] = [
  { value: 'MPESA', label: 'M-Pesa' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'HOUSE_ACCOUNT', label: 'House Account' },
  { value: 'CORPORATE_ACCOUNT', label: 'Corporate Account' },
];

const STATUS_FILTERS: SelectOption[] = [
  { value: '', label: 'All Statuses' },
  { value: 'UNPAID', label: 'Unpaid' },
  { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
  { value: 'PAID', label: 'Paid' },
];

const invoiceStatusTone: Record<InvoiceStatus, 'success' | 'warning' | 'neutral'> = {
  PAID: 'success',
  PARTIALLY_PAID: 'warning',
  UNPAID: 'neutral',
};

const statusLabel = (status: InvoiceStatus): string => status.replace('_', ' ');

const formatKes = (value: string | number): string => {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return `Ksh ${Number.isFinite(n) ? n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}`;
};

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Nairobi' });

const poTotal = (po: PurchaseOrder): number =>
  po.lines.reduce((sum, line) => sum + parseFloat(line.orderedQty) * parseFloat(line.unitPrice), 0);

const outstandingAmount = (invoice: SupplierInvoice): number =>
  Math.max(0, parseFloat(invoice.amount) - parseFloat(invoice.amountPaid));

const daysOutstanding = (invoice: SupplierInvoice): number => {
  const start = new Date(invoice.invoiceDate).getTime();
  const now = Date.now();
  if (!Number.isFinite(start) || start > now) return 0;
  return Math.floor((now - start) / 86_400_000);
};

const paymentAgeLabel = (days: number, status: InvoiceStatus): string => {
  if (status === 'PAID') return 'Settled';
  if (days <= 7) return '0-7 days';
  if (days <= 30) return '8-30 days';
  return '31+ days';
};

const paymentAgeTone = (days: number, status: InvoiceStatus): 'success' | 'warning' | 'danger' | 'neutral' => {
  if (status === 'PAID') return 'success';
  if (days <= 7) return 'neutral';
  if (days <= 30) return 'warning';
  return 'danger';
};

export function SupplierInvoicesAP({ mode, onMobileDetailChange }: SupplierInvoicesAPProps): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierWithItemCount[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | ''>('');

  const [selectedInvoice, setSelectedInvoice] = useState<SupplierInvoice | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    supplierId: '',
    purchaseOrderId: '',
    referenceNumber: '',
    amount: '',
    invoiceDate: '',
  });
  const [isSavingInvoice, setIsSavingInvoice] = useState(false);

  const [paymentTarget, setPaymentTarget] = useState<SupplierInvoice | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    method: 'MPESA' as SupplierPaymentMethod,
    paidAt: '',
  });
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const [invoiceResult, supplierResult, poResult] = await Promise.all([
        listSupplierInvoices(accessToken),
        listSuppliers(accessToken, true),
        listPurchaseOrders(accessToken),
      ]);
      setInvoices(invoiceResult);
      setSuppliers(supplierResult);
      setPurchaseOrders(poResult);
      setSelectedInvoice((current) => invoiceResult.find((invoice) => invoice.id === current?.id) ?? current);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load supplier invoices', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (mode !== 'mobile' || !onMobileDetailChange) return;
    onMobileDetailChange(Boolean(selectedInvoice));
    return () => onMobileDetailChange(false);
  }, [mode, onMobileDetailChange, selectedInvoice]);

  const poById = useMemo(() => new Map(purchaseOrders.map((po) => [po.id, po])), [purchaseOrders]);

  const supplierOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', label: 'Select supplier' },
      ...suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name })),
    ],
    [suppliers],
  );

  const purchaseOrderOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', label: 'No PO reference' },
      ...purchaseOrders
        .filter((po) => po.status !== 'CANCELLED')
        .map((po) => ({
          value: po.id,
          label: `${po.poNumber} - ${po.supplier.name} (${formatKes(poTotal(po))})`,
        })),
    ],
    [purchaseOrders],
  );

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices
      .filter((invoice) => !statusFilter || invoice.status === statusFilter)
      .filter((invoice) => {
        const po = invoice.purchaseOrderId ? poById.get(invoice.purchaseOrderId) : undefined;
        return (
          !q ||
          invoice.referenceNumber.toLowerCase().includes(q) ||
          invoice.supplier.name.toLowerCase().includes(q) ||
          Boolean(po?.poNumber.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const openSort = Number(b.status !== 'PAID') - Number(a.status !== 'PAID');
        if (openSort !== 0) return openSort;
        return new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime();
      });
  }, [invoices, poById, search, statusFilter]);

  const supplierTotals = useMemo<SupplierTotal[]>(() => {
    const grouped = new Map<string, SupplierTotal>();
    for (const invoice of invoices) {
      const existing = grouped.get(invoice.supplierId) ?? {
        supplierId: invoice.supplierId,
        supplierName: invoice.supplier.name,
        totalInvoiced: 0,
        totalPaid: 0,
        outstanding: 0,
        openCount: 0,
      };
      const outstanding = outstandingAmount(invoice);
      existing.totalInvoiced += parseFloat(invoice.amount);
      existing.totalPaid += parseFloat(invoice.amountPaid);
      existing.outstanding += outstanding;
      if (outstanding > 0.005) existing.openCount += 1;
      grouped.set(invoice.supplierId, existing);
    }
    return Array.from(grouped.values()).sort((a, b) => b.outstanding - a.outstanding);
  }, [invoices]);

  const paymentAgeBuckets = useMemo(() => {
    const buckets = [
      { label: '0-7 days', min: 0, max: 7, total: 0, count: 0, tone: 'neutral' as const },
      { label: '8-30 days', min: 8, max: 30, total: 0, count: 0, tone: 'warning' as const },
      { label: '31+ days', min: 31, max: Infinity, total: 0, count: 0, tone: 'danger' as const },
    ];
    for (const invoice of invoices) {
      const outstanding = outstandingAmount(invoice);
      if (outstanding <= 0.005) continue;
      const days = daysOutstanding(invoice);
      const bucket = buckets.find((candidate) => days >= candidate.min && days <= candidate.max);
      if (bucket) {
        bucket.total += outstanding;
        bucket.count += 1;
      }
    }
    return buckets;
  }, [invoices]);

  const totalOutstanding = supplierTotals.reduce((sum, supplier) => sum + supplier.outstanding, 0);
  const totalInvoiced = supplierTotals.reduce((sum, supplier) => sum + supplier.totalInvoiced, 0);
  const openInvoiceCount = invoices.filter((invoice) => outstandingAmount(invoice) > 0.005).length;

  const openInvoiceModal = () => {
    setInvoiceForm({
      supplierId: '',
      purchaseOrderId: '',
      referenceNumber: '',
      amount: '',
      invoiceDate: new Date().toISOString().slice(0, 10),
    });
    setIsInvoiceModalOpen(true);
  };

  const selectPurchaseOrder = (purchaseOrderId: string) => {
    const po = poById.get(purchaseOrderId);
    setInvoiceForm((current) => ({
      ...current,
      purchaseOrderId,
      supplierId: po?.supplierId ?? current.supplierId,
      amount: po ? poTotal(po).toFixed(2) : current.amount,
    }));
  };

  const handleSaveInvoice = async () => {
    if (!accessToken) return;
    if (!invoiceForm.supplierId || !invoiceForm.referenceNumber.trim() || !invoiceForm.amount || !invoiceForm.invoiceDate) {
      toast({ variant: 'error', title: 'Missing details', message: 'Supplier, reference number, amount, and invoice date are required.' });
      return;
    }
    if (parseFloat(invoiceForm.amount) <= 0) {
      toast({ variant: 'error', title: 'Check invoice amount', message: 'Invoice amount must be greater than zero.' });
      return;
    }
    setIsSavingInvoice(true);
    try {
      await createSupplierInvoice(
        {
          supplierId: invoiceForm.supplierId,
          purchaseOrderId: invoiceForm.purchaseOrderId || undefined,
          referenceNumber: invoiceForm.referenceNumber.trim(),
          amount: invoiceForm.amount,
          invoiceDate: new Date(invoiceForm.invoiceDate).toISOString(),
        },
        accessToken,
      );
      toast({ variant: 'success', title: 'Invoice recorded', message: `${invoiceForm.referenceNumber.trim()} was added.` });
      setIsInvoiceModalOpen(false);
      await load();
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to record invoice', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSavingInvoice(false);
    }
  };

  const openPaymentModal = (invoice: SupplierInvoice) => {
    setPaymentForm({
      amount: outstandingAmount(invoice).toFixed(2),
      method: 'MPESA',
      paidAt: new Date().toISOString().slice(0, 10),
    });
    setPaymentTarget(invoice);
  };

  const handleRecordPayment = async () => {
    if (!accessToken || !paymentTarget) return;
    const amount = parseFloat(paymentForm.amount);
    const outstanding = outstandingAmount(paymentTarget);
    if (!paymentForm.amount || !paymentForm.paidAt || amount <= 0) {
      toast({ variant: 'error', title: 'Check payment details', message: 'Amount and payment date are required.' });
      return;
    }
    if (amount > outstanding + 0.005) {
      toast({ variant: 'error', title: 'Payment is too high', message: `The outstanding balance is ${formatKes(outstanding)}.` });
      return;
    }
    setIsSavingPayment(true);
    try {
      await recordSupplierPayment(
        paymentTarget.id,
        { amount: paymentForm.amount, method: paymentForm.method, paidAt: new Date(paymentForm.paidAt).toISOString() },
        accessToken,
      );
      toast({ variant: 'success', title: 'Payment recorded', message: `Payment of ${formatKes(paymentForm.amount)} was recorded.` });
      setPaymentTarget(null);
      await load();
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to record payment', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSavingPayment(false);
    }
  };

  const rows = useMemo<InvoiceRow[]>(() => filteredInvoices.map((invoice) => ({ invoice })), [filteredInvoices]);

  const columns = useMemo<ExcelColumn<InvoiceRow>[]>(
    () => [
      {
        key: 'reference',
        label: 'Invoice',
        render: (row) => (
          <button type="button" onClick={() => setSelectedInvoice(row.invoice)} className="font-semibold text-office-ink hover:underline">
            {row.invoice.referenceNumber}
          </button>
        ),
      },
      { key: 'supplier', label: 'Supplier', render: (row) => row.invoice.supplier.name },
      {
        key: 'po',
        label: 'PO Reference',
        render: (row) => row.invoice.purchaseOrderId ? (poById.get(row.invoice.purchaseOrderId)?.poNumber ?? 'Linked PO') : <span className="text-stone-400">None</span>,
      },
      { key: 'amount', label: 'Amount', numeric: true, render: (row) => formatKes(row.invoice.amount) },
      { key: 'paid', label: 'Paid', numeric: true, render: (row) => formatKes(row.invoice.amountPaid) },
      { key: 'outstanding', label: 'Outstanding', numeric: true, render: (row) => formatKes(outstandingAmount(row.invoice)) },
      { key: 'status', label: 'Status', render: (row) => <Badge tone={invoiceStatusTone[row.invoice.status]}>{statusLabel(row.invoice.status)}</Badge> },
      {
        key: 'age',
        label: 'Days Unpaid',
        numeric: true,
        render: (row) => row.invoice.status === 'PAID' ? <span className="text-stone-500">Settled</span> : daysOutstanding(row.invoice),
      },
    ],
    [poById],
  );

  const invoiceModal = (
    <Modal
      isOpen={isInvoiceModalOpen}
      onClose={() => setIsInvoiceModalOpen(false)}
      title="Record Supplier Invoice"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setIsInvoiceModalOpen(false)}>Cancel</Button>
          <Button onClick={() => void handleSaveInvoice()} isLoading={isSavingInvoice}>Record Invoice</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <FormField label="PO Reference" htmlFor={`${mode}-invoice-po`}>
          <Select id={`${mode}-invoice-po`} options={purchaseOrderOptions} value={invoiceForm.purchaseOrderId} onChange={(event) => selectPurchaseOrder(event.target.value)} />
        </FormField>
        <FormField label="Supplier" htmlFor={`${mode}-invoice-supplier`} required>
          <Select id={`${mode}-invoice-supplier`} options={supplierOptions} value={invoiceForm.supplierId} onChange={(event) => setInvoiceForm((current) => ({ ...current, supplierId: event.target.value }))} />
        </FormField>
        <FormField label="Reference Number" htmlFor={`${mode}-invoice-ref`} required>
          <Input id={`${mode}-invoice-ref`} value={invoiceForm.referenceNumber} onChange={(event) => setInvoiceForm((current) => ({ ...current, referenceNumber: event.target.value }))} placeholder="e.g. SINV57141" />
        </FormField>
        <FormField label="Amount (Ksh)" htmlFor={`${mode}-invoice-amount`} required>
          <Input id={`${mode}-invoice-amount`} inputMode="decimal" value={invoiceForm.amount} onChange={(event) => setInvoiceForm((current) => ({ ...current, amount: event.target.value }))} />
        </FormField>
        <FormField label="Invoice Date" htmlFor={`${mode}-invoice-date`} required>
          <Input id={`${mode}-invoice-date`} type="date" value={invoiceForm.invoiceDate} onChange={(event) => setInvoiceForm((current) => ({ ...current, invoiceDate: event.target.value }))} />
        </FormField>
      </div>
    </Modal>
  );

  const paymentModal = (
    <Modal
      isOpen={Boolean(paymentTarget) && mode === 'desktop'}
      onClose={() => setPaymentTarget(null)}
      title={`Record Payment - ${paymentTarget?.referenceNumber ?? ''}`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setPaymentTarget(null)}>Cancel</Button>
          <Button onClick={() => void handleRecordPayment()} isLoading={isSavingPayment}>Record Payment</Button>
        </div>
      }
    >
      <PaymentFields
        mode={mode}
        paymentTarget={paymentTarget}
        paymentForm={paymentForm}
        setPaymentForm={setPaymentForm}
      />
    </Modal>
  );

  if (mode === 'mobile') {
    return (
      <>
        {selectedInvoice ? (
          <MobileInvoiceDetail
            invoice={selectedInvoice}
            poNumber={selectedInvoice.purchaseOrderId ? poById.get(selectedInvoice.purchaseOrderId)?.poNumber : undefined}
            onBack={() => setSelectedInvoice(null)}
            onPay={openPaymentModal}
          />
        ) : (
          <div className="px-4 py-4">
            <div className="mb-4 grid grid-cols-2 gap-2">
              <MobileMetric label="Outstanding" value={formatKes(totalOutstanding)} tone={totalOutstanding > 0 ? 'danger' : 'default'} />
              <MobileMetric label="Open invoices" value={openInvoiceCount} />
            </div>
            <div className="relative mb-3">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search invoices or suppliers..."
                className="h-11 w-full rounded-md border border-stone-200 bg-white pl-9 pr-3 text-body-md text-stone-900 placeholder:text-stone-400 focus:border-espresso focus:outline-none"
              />
            </div>
            <div className="mb-4">
              <Select options={STATUS_FILTERS} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as InvoiceStatus | '')} />
            </div>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-md bg-stone-100" />)}
              </div>
            ) : filteredInvoices.length === 0 ? (
              <EmptyState
                icon={<FileText size={40} />}
                heading="No supplier invoices found"
                body={invoices.length === 0 ? 'Record the first supplier invoice after receiving a delivery.' : 'Try another search or status filter.'}
              />
            ) : (
              <div className="space-y-2.5">
                {filteredInvoices.map((invoice) => {
                  const outstanding = outstandingAmount(invoice);
                  const days = daysOutstanding(invoice);
                  return (
                    <button key={invoice.id} type="button" onClick={() => setSelectedInvoice(invoice)} className="block w-full text-left">
                      <Card className="p-3.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-body-md font-semibold text-stone-900">{invoice.referenceNumber}</p>
                            <p className="truncate text-label-md text-stone-500">{invoice.supplier.name}</p>
                          </div>
                          <Badge tone={invoiceStatusTone[invoice.status]} size="lg" className="shrink-0">{statusLabel(invoice.status)}</Badge>
                        </div>
                        <div className="mt-3 flex items-end justify-between gap-3">
                          <div>
                            <p className="text-heading-sm font-bold tabular-nums text-stone-900">{formatKes(invoice.amount)}</p>
                            {outstanding > 0.005 ? (
                              <p className="text-label-sm font-medium tabular-nums text-danger">{formatKes(outstanding)} due</p>
                            ) : (
                              <p className="text-label-sm font-medium text-success">Fully paid</p>
                            )}
                          </div>
                          <Badge tone={paymentAgeTone(days, invoice.status)}>{paymentAgeLabel(days, invoice.status)}</Badge>
                        </div>
                      </Card>
                    </button>
                  );
                })}
              </div>
            )}
            <button
              type="button"
              onClick={openInvoiceModal}
              className="fixed bottom-24 right-4 z-40 flex h-14 items-center gap-2 rounded-full bg-amber px-5 text-label-lg font-semibold text-espresso shadow-lg"
            >
              <Plus size={20} />
              Record Invoice
            </button>
          </div>
        )}

        {invoiceModal}

        {paymentTarget && mode === 'mobile' && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => setPaymentTarget(null)}>
            <div className="rounded-t-2xl bg-white p-5" onClick={(event) => event.stopPropagation()}>
              <p className="text-heading-sm font-semibold text-stone-900">Record Payment - {paymentTarget.referenceNumber}</p>
              <PaymentFields
                mode={mode}
                paymentTarget={paymentTarget}
                paymentForm={paymentForm}
                setPaymentForm={setPaymentForm}
              />
              <div className="mt-5 flex gap-3">
                <button type="button" onClick={() => setPaymentTarget(null)} className="h-12 flex-1 rounded-md border border-stone-200 text-label-lg font-semibold text-stone-700">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleRecordPayment()}
                  disabled={isSavingPayment}
                  className="h-12 flex-1 rounded-md bg-espresso text-label-lg font-semibold text-crema disabled:opacity-50"
                >
                  {isSavingPayment ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Card className="p-4">
              <p className="text-label-sm text-stone-500">Outstanding</p>
              <p className="mt-1 text-heading-md font-bold tabular-nums text-stone-900">{formatKes(totalOutstanding)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-label-sm text-stone-500">Open Invoices</p>
              <p className="mt-1 text-heading-md font-bold tabular-nums text-stone-900">{openInvoiceCount}</p>
            </Card>
            <Card className="p-4">
              <p className="text-label-sm text-stone-500">Total Invoiced</p>
              <p className="mt-1 text-heading-md font-bold tabular-nums text-stone-900">{formatKes(totalInvoiced)}</p>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-stone-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="w-full sm:w-52">
                <Select options={STATUS_FILTERS} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as InvoiceStatus | '')} />
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-80">
                  <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search invoice, supplier, or PO..." className="pl-9" />
                </div>
                <Button leftIcon={<Plus size={16} />} onClick={openInvoiceModal}>Record Invoice</Button>
              </div>
            </div>
            <ExcelTable
              columns={columns}
              rows={rows}
              rowKey={(row) => row.invoice.id}
              numbered
              isLoading={isLoading}
              headerTone="navy"
              emptyState={
                <div className="px-4 py-10 text-center text-body-sm text-stone-500">
                  {invoices.length === 0 ? 'No supplier invoices recorded yet.' : 'No invoices match your filters.'}
                </div>
              }
            />
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="border-b border-stone-100 px-4 py-3">
              <h2 className="text-heading-sm font-semibold text-stone-900">Totals by Supplier</h2>
            </div>
            {supplierTotals.length === 0 ? (
              <p className="px-4 py-8 text-center text-body-sm text-stone-500">Supplier totals will appear once invoices are recorded.</p>
            ) : (
              <ul className="max-h-[360px] divide-y divide-stone-100 overflow-y-auto">
                {supplierTotals.map((supplier, index) => (
                  <li key={supplier.supplierId} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-stone-100 text-label-sm font-semibold tabular-nums text-stone-500">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-sm font-semibold text-stone-900">{supplier.supplierName}</p>
                      <p className="text-label-sm text-stone-500">{supplier.openCount} open · {formatKes(supplier.totalPaid)} paid</p>
                    </div>
                    <p className={cn('shrink-0 text-right text-body-sm font-bold tabular-nums', supplier.outstanding > 0.005 ? 'text-danger' : 'text-stone-700')}>
                      {formatKes(supplier.outstanding)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-heading-sm font-semibold text-stone-900">Payment Age</h2>
              <span className="text-label-sm text-stone-500">{formatKes(totalOutstanding)} open</span>
            </div>
            <div className="space-y-3">
              {paymentAgeBuckets.map((bucket) => {
                const pct = totalOutstanding > 0.005 ? (bucket.total / totalOutstanding) * 100 : 0;
                return (
                  <div key={bucket.label}>
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <Badge tone={bucket.tone}>{bucket.label}</Badge>
                      <span className="text-label-sm tabular-nums text-stone-500">
                        {formatKes(bucket.total)} · {bucket.count} invoice{bucket.count === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          bucket.tone === 'danger' && 'bg-danger',
                          bucket.tone === 'warning' && 'bg-warning',
                          bucket.tone === 'neutral' && 'bg-stone-400',
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      {selectedInvoice && (
        <div className="fixed inset-0 z-40 flex justify-end bg-[rgba(28,25,23,0.4)]" onClick={() => setSelectedInvoice(null)}>
          <div className="flex h-full w-full max-w-lg flex-col bg-white shadow-xl animate-fade-up motion-reduce:animate-none" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-stone-100 px-6 py-4">
              <div>
                <h2 className="text-heading-md font-semibold text-stone-900">{selectedInvoice.referenceNumber}</h2>
                <p className="text-label-md text-stone-500">{selectedInvoice.supplier.name} · {formatDate(selectedInvoice.invoiceDate)}</p>
              </div>
              <Badge tone={invoiceStatusTone[selectedInvoice.status]}>{statusLabel(selectedInvoice.status)}</Badge>
            </div>
            <InvoiceDetailBody
              invoice={selectedInvoice}
              poNumber={selectedInvoice.purchaseOrderId ? poById.get(selectedInvoice.purchaseOrderId)?.poNumber : undefined}
              onPay={openPaymentModal}
            />
          </div>
        </div>
      )}

      {invoiceModal}
      {paymentModal}
    </>
  );
}

function PaymentFields({
  mode,
  paymentTarget,
  paymentForm,
  setPaymentForm,
}: {
  mode: 'desktop' | 'mobile';
  paymentTarget: SupplierInvoice | null;
  paymentForm: { amount: string; method: SupplierPaymentMethod; paidAt: string };
  setPaymentForm: Dispatch<SetStateAction<{ amount: string; method: SupplierPaymentMethod; paidAt: string }>>;
}): JSX.Element {
  return (
    <div className="mt-4 space-y-4">
      {paymentTarget && (
        <p className="rounded-md border border-stone-100 bg-stone-50 px-3 py-2 text-body-sm text-stone-600">
          Outstanding: <span className="font-semibold tabular-nums text-stone-900">{formatKes(outstandingAmount(paymentTarget))}</span>
        </p>
      )}
      <FormField label="Amount (Ksh)" htmlFor={`${mode}-payment-amount`} required>
        <Input id={`${mode}-payment-amount`} inputMode="decimal" value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} />
      </FormField>
      <FormField label="Method" htmlFor={`${mode}-payment-method`} required>
        <Select id={`${mode}-payment-method`} options={PAYMENT_METHODS} value={paymentForm.method} onChange={(event) => setPaymentForm((current) => ({ ...current, method: event.target.value as SupplierPaymentMethod }))} />
      </FormField>
      <FormField label="Payment Date" htmlFor={`${mode}-payment-date`} required>
        <Input id={`${mode}-payment-date`} type="date" value={paymentForm.paidAt} onChange={(event) => setPaymentForm((current) => ({ ...current, paidAt: event.target.value }))} />
      </FormField>
    </div>
  );
}

function InvoiceDetailBody({
  invoice,
  poNumber,
  onPay,
}: {
  invoice: SupplierInvoice;
  poNumber?: string;
  onPay: (invoice: SupplierInvoice) => void;
}): JSX.Element {
  const outstanding = outstandingAmount(invoice);
  const days = daysOutstanding(invoice);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <div className="grid grid-cols-2 gap-3">
        <DetailMetric label="Invoice Amount" value={formatKes(invoice.amount)} />
        <DetailMetric label="Paid" value={formatKes(invoice.amountPaid)} />
        <DetailMetric label="Outstanding" value={formatKes(outstanding)} tone={outstanding > 0.005 ? 'danger' : 'default'} />
        <DetailMetric label="Payment Age" value={paymentAgeLabel(days, invoice.status)} />
      </div>

      <div className="mt-5 rounded-md border border-stone-100">
        <DetailLine label="Supplier" value={invoice.supplier.name} />
        <DetailLine label="PO Reference" value={poNumber ?? 'None'} />
        <DetailLine label="Invoice Date" value={formatDate(invoice.invoiceDate)} />
      </div>

      <div className="mt-5">
        <p className="mb-2 text-label-sm font-semibold uppercase tracking-wide text-stone-500">Payments</p>
        {invoice.payments.length === 0 ? (
          <p className="rounded-md border border-stone-100 bg-stone-50 px-4 py-6 text-center text-body-sm text-stone-500">No payments recorded yet.</p>
        ) : (
          <ul className="divide-y divide-stone-100 rounded-md border border-stone-100">
            {invoice.payments.map((payment, index) => (
              <li key={payment.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-stone-100 text-label-sm font-semibold tabular-nums text-stone-500">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-semibold tabular-nums text-stone-900">{formatKes(payment.amount)}</p>
                  <p className="text-label-sm text-stone-500">{payment.method.replace('_', ' ')} · {formatDate(payment.paidAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {invoice.status !== 'PAID' && (
        <Button className="mt-5 w-full" onClick={() => onPay(invoice)}>Record Payment</Button>
      )}
    </div>
  );
}

function MobileInvoiceDetail({
  invoice,
  poNumber,
  onBack,
  onPay,
}: {
  invoice: SupplierInvoice;
  poNumber?: string;
  onBack: () => void;
  onPay: (invoice: SupplierInvoice) => void;
}): JSX.Element {
  return (
    <div className="min-h-full bg-crema">
      <div className="bg-espresso px-4 pb-4 pt-6 text-crema">
        <button type="button" onClick={onBack} className="mb-2 flex items-center gap-1 text-label-md text-crema/80">
          <ArrowLeft size={16} /> Invoices
        </button>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-display text-heading-md font-medium">{invoice.referenceNumber}</p>
            <p className="truncate text-label-md text-crema/70">{invoice.supplier.name}</p>
          </div>
          <Badge tone={invoiceStatusTone[invoice.status]} size="lg" className="shrink-0">{statusLabel(invoice.status)}</Badge>
        </div>
      </div>
      <InvoiceDetailBody invoice={invoice} poNumber={poNumber} onPay={onPay} />
    </div>
  );
}

function DetailMetric({ label, value, tone = 'default' }: { label: string; value: ReactNode; tone?: 'default' | 'danger' }): JSX.Element {
  return (
    <div className="rounded-md border border-stone-100 bg-stone-50 p-3">
      <p className="text-label-sm text-stone-500">{label}</p>
      <p className={cn('mt-1 text-body-md font-bold tabular-nums text-stone-900', tone === 'danger' && 'text-danger')}>{value}</p>
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: ReactNode }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-4 py-3 last:border-b-0">
      <p className="text-label-md text-stone-500">{label}</p>
      <p className="min-w-0 truncate text-right text-body-sm font-medium text-stone-900">{value}</p>
    </div>
  );
}

function MobileMetric({ label, value, tone = 'default' }: { label: string; value: ReactNode; tone?: 'default' | 'danger' }): JSX.Element {
  return (
    <Card className="p-3">
      <p className="text-label-sm text-stone-500">{label}</p>
      <p className={cn('mt-1 text-heading-sm font-bold tabular-nums text-stone-900', tone === 'danger' && 'text-danger')}>{value}</p>
    </Card>
  );
}

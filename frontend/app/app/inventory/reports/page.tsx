'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Banknote,
  ClipboardCheck,
  Coffee,
  Download,
  Package,
  TrendingUp,
  Utensils,
  Wallet,
} from 'lucide-react';
import { Button, Card, ExcelTable, PageHeader, PageLayout, TabBar, type ExcelColumn } from '@/components/ui';
import { PriceTrendChart } from '@/components/inventory/PriceTrendChart';
import { itemTypeLabel } from '@/components/inventory/item-type-icon';
import {
  getCentralStoreLocation,
  getCountDiscrepancyReport,
  getLowStockAlertsReport,
  getPrepYieldReport,
  getPriceHistoryReport,
  getStockValuationReport,
  getSupplierApAgingReport,
  getTrueCostPerPreppedItemReport,
  listInventoryItems,
} from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { useIsDesktopShell } from '@/lib/shell-context';
import { downloadCsv } from '@/lib/payroll-csv';
import { cn } from '@/lib/cn';
import type {
  CountDiscrepancyLine,
  InventoryItem,
  LowStockAlertLine,
  PrepYieldReport,
  PriceHistoryLine,
  StockValuationLine,
  SupplierApAgingLine,
  TrueCostPerPreppedItemLine,
} from '@/types/inventory';
import { Select, type SelectOption } from '@/components/ui';

type ReportTab = 'valuation' | 'low-stock' | 'price-history' | 'prep-yield' | 'discrepancy' | 'prepped-cost' | 'ap-aging';

const TABS: { value: ReportTab; label: string }[] = [
  { value: 'valuation', label: 'Stock Valuation' },
  { value: 'low-stock', label: 'Low Stock Alerts' },
  { value: 'price-history', label: 'Price History' },
  { value: 'prep-yield', label: 'Prep Yield' },
  { value: 'discrepancy', label: 'Count Discrepancy' },
  { value: 'prepped-cost', label: 'True Cost per Prepped Item' },
  { value: 'ap-aging', label: 'Supplier AP Aging' },
];

const formatKes = (value: string | number): string => {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return `Ksh ${Number.isFinite(n) ? n.toLocaleString('en-KE', { maximumFractionDigits: 2 }) : '0'}`;
};

const csvEscape = (value: unknown): string => {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const toCsv = (headers: string[], rows: (string | number)[][]): string =>
  [headers.map(csvEscape).join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\r\n');

// app/app/layout.tsx mounts {children} twice for STORE_MANAGER (dual desktop
// sidebar + CSS-hidden mobile shell) — each branch below checks its own
// shell context so only the visible copy ever fetches/renders.
export default function InventoryReportsPage(): JSX.Element {
  const isDesktop = useIsDesktopShell();
  if (isDesktop) return <InventoryReportsPageInner />;
  return <InventoryReportsMobile />;
}

function InventoryReportsPageInner(): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [tab, setTab] = useState<ReportTab>('valuation');
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<InventoryItem[]>([]);

  const [valuation, setValuation] = useState<StockValuationLine[]>([]);
  const [valuationTotal, setValuationTotal] = useState(0);
  const [lowStock, setLowStock] = useState<LowStockAlertLine[]>([]);
  const [priceHistoryItemId, setPriceHistoryItemId] = useState('');
  const [priceHistory, setPriceHistory] = useState<PriceHistoryLine[]>([]);
  const [prepYield, setPrepYield] = useState<PrepYieldReport[]>([]);
  const [discrepancy, setDiscrepancy] = useState<CountDiscrepancyLine[]>([]);
  const [preppedCost, setPreppedCost] = useState<TrueCostPerPreppedItemLine[]>([]);
  const [apAgingLines, setApAgingLines] = useState<SupplierApAgingLine[]>([]);
  const [apBySupplier, setApBySupplier] = useState<{ supplierId: string; supplierName: string; totalOutstanding: string }[]>([]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const location = await getCentralStoreLocation(accessToken);
      if (!location) {
        toast({ variant: 'error', title: 'Central Store not set up', message: 'No Central Store location was found for this organization.' });
        return;
      }
      const [itemList, valuationReport, lowStockReport, prepYieldReport, discrepancyReport, preppedCostReport, apAgingReport] = await Promise.all([
        listInventoryItems(accessToken, { isActive: true }),
        getStockValuationReport(location.id, accessToken),
        getLowStockAlertsReport(location.id, accessToken),
        getPrepYieldReport(accessToken),
        getCountDiscrepancyReport(accessToken, { locationId: location.id }),
        getTrueCostPerPreppedItemReport(accessToken),
        getSupplierApAgingReport(accessToken),
      ]);
      setItems(itemList);
      setValuation(valuationReport.lines);
      setValuationTotal(parseFloat(valuationReport.totalValue));
      setLowStock(lowStockReport);
      setPrepYield(Array.isArray(prepYieldReport) ? prepYieldReport : [prepYieldReport]);
      setDiscrepancy(discrepancyReport.filter((l) => l.countedQty !== null && parseFloat(l.gapQty) !== 0));
      setPreppedCost(preppedCostReport);
      setApAgingLines(apAgingReport.lines);
      setApBySupplier(apAgingReport.bySupplier);
      if (itemList.length > 0) setPriceHistoryItemId(itemList[0].id);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load reports', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!accessToken || !priceHistoryItemId) return;
    getPriceHistoryReport(priceHistoryItemId, accessToken).then(setPriceHistory).catch(() => setPriceHistory([]));
  }, [accessToken, priceHistoryItemId]);

  const itemOptions: SelectOption[] = useMemo(() => items.map((i) => ({ value: i.id, label: i.name })), [items]);

  const valuationColumns: ExcelColumn<StockValuationLine>[] = [
    { key: 'name', label: 'Item' },
    { key: 'type', label: 'Type', render: (row) => itemTypeLabel[row.type] },
    { key: 'onHandQty', label: 'On Hand', numeric: true, render: (row) => `${row.onHandQty} ${row.usageUnit}` },
    { key: 'currentCost', label: 'Unit Cost', numeric: true, render: (row) => formatKes(row.currentCost) },
    { key: 'value', label: 'Value', numeric: true, render: (row) => <span className="font-semibold">{formatKes(row.value)}</span> },
  ];

  const lowStockColumns: ExcelColumn<LowStockAlertLine>[] = [
    { key: 'name', label: 'Item' },
    { key: 'onHandQty', label: 'On Hand', numeric: true, render: (row) => `${row.onHandQty} ${row.usageUnit}` },
    { key: 'reorderLevel', label: 'Reorder Level', numeric: true, render: (row) => `${row.reorderLevel} ${row.usageUnit}` },
  ];

  const prepYieldRows = useMemo(
    () => prepYield.flatMap((report) => report.runs.map((run) => ({ ...run, outputItemName: report.outputItemName ?? report.outputItemId }))),
    [prepYield],
  );
  const prepYieldColumns: ExcelColumn<(typeof prepYieldRows)[number]>[] = [
    { key: 'outputItemName', label: 'Output Item' },
    { key: 'recordedAt', label: 'Date', render: (row) => new Date(row.recordedAt).toLocaleDateString('en-KE', { dateStyle: 'medium' }) },
    { key: 'totalInputQty', label: 'Input Qty', numeric: true },
    { key: 'actualYield', label: 'Actual Yield', numeric: true },
    { key: 'scaledExpectedYield', label: 'Expected (This Batch)', numeric: true, render: (row) => (row.scaledExpectedYield ? parseFloat(row.scaledExpectedYield).toFixed(2) : '—') },
    {
      key: 'variancePct',
      label: 'Variance',
      numeric: true,
      render: (row) => {
        if (!row.variancePct) return '—';
        const v = parseFloat(row.variancePct);
        return <span className={v < 0 ? 'font-semibold text-danger' : v > 0 ? 'font-semibold text-success' : 'text-stone-500'}>{v > 0 ? '+' : ''}{v.toFixed(1)}%</span>;
      },
    },
    { key: 'yieldRatio', label: 'Yield Ratio', numeric: true, render: (row) => (row.yieldRatio ? parseFloat(row.yieldRatio).toFixed(2) : '—') },
    { key: 'unitCost', label: 'Unit Cost', numeric: true, render: (row) => formatKes(row.unitCost) },
  ];

  const discrepancyColumns: ExcelColumn<CountDiscrepancyLine>[] = [
    { key: 'itemName', label: 'Item' },
    { key: 'stockCountLabel', label: 'Session' },
    { key: 'expectedQty', label: 'Expected', numeric: true, render: (row) => `${row.expectedQty} ${row.usageUnit}` },
    { key: 'countedQty', label: 'Counted', numeric: true, render: (row) => `${row.countedQty} ${row.usageUnit}` },
    {
      key: 'gapValue',
      label: 'Gap Value',
      numeric: true,
      render: (row) => <span className={parseFloat(row.gapValue) < 0 ? 'text-danger font-semibold' : 'text-success font-semibold'}>{formatKes(row.gapValue)}</span>,
    },
  ];

  const preppedCostColumns: ExcelColumn<TrueCostPerPreppedItemLine>[] = [
    { key: 'outputItemName', label: 'Item' },
    { key: 'mostRecentUnitCost', label: 'Most Recent Cost', numeric: true, render: (row) => (row.mostRecentUnitCost ? formatKes(row.mostRecentUnitCost) : '—') },
    { key: 'avgUnitCost', label: 'Average Cost', numeric: true, render: (row) => (row.avgUnitCost ? formatKes(row.avgUnitCost) : '—') },
    { key: 'sampleCount', label: 'Runs', numeric: true },
  ];

  const apAgingColumns: ExcelColumn<SupplierApAgingLine>[] = [
    { key: 'supplierName', label: 'Supplier' },
    { key: 'referenceNumber', label: 'Reference' },
    { key: 'outstanding', label: 'Outstanding', numeric: true, render: (row) => formatKes(row.outstanding) },
    { key: 'daysOutstanding', label: 'Days Outstanding', numeric: true },
    {
      key: 'bucket',
      label: 'Bucket',
      render: (row) => (
        <span className={row.bucket === '31+' ? 'font-semibold text-danger' : row.bucket === '8-30' ? 'font-semibold text-warning' : 'text-stone-600'}>
          {row.bucket} days
        </span>
      ),
    },
  ];

  const handleExport = () => {
    let csv = '';
    let filename = 'report.csv';
    if (tab === 'valuation') {
      csv = toCsv(['Item', 'Type', 'On Hand', 'Unit', 'Unit Cost', 'Value'], valuation.map((l) => [l.name, l.type, l.onHandQty, l.usageUnit, l.currentCost, l.value]));
      filename = 'stock-valuation.csv';
    } else if (tab === 'low-stock') {
      csv = toCsv(['Item', 'On Hand', 'Reorder Level', 'Unit'], lowStock.map((l) => [l.name, l.onHandQty, l.reorderLevel, l.usageUnit]));
      filename = 'low-stock-alerts.csv';
    } else if (tab === 'price-history') {
      csv = toCsv(['PO Number', 'Supplier', 'Unit Price', 'Invoice Price', 'Received Qty', 'Received At'], priceHistory.map((l) => [l.poNumber ?? '', l.supplierName ?? '', l.unitPrice, l.invoicePrice ?? '', l.receivedQty, l.receivedAt ?? '']));
      filename = 'price-history.csv';
    } else if (tab === 'prep-yield') {
      csv = toCsv(
        ['Output Item', 'Date', 'Input Qty', 'Actual Yield', 'Expected (This Batch)', 'Variance %', 'Yield Ratio', 'Unit Cost'],
        prepYieldRows.map((r) => [r.outputItemName, r.recordedAt, r.totalInputQty, r.actualYield, r.scaledExpectedYield ?? '', r.variancePct ?? '', r.yieldRatio ?? '', r.unitCost]),
      );
      filename = 'prep-yield.csv';
    } else if (tab === 'discrepancy') {
      csv = toCsv(['Item', 'Session', 'Expected', 'Counted', 'Gap Value'], discrepancy.map((l) => [l.itemName, l.stockCountLabel, l.expectedQty, l.countedQty ?? '', l.gapValue]));
      filename = 'count-discrepancy.csv';
    } else if (tab === 'prepped-cost') {
      csv = toCsv(['Item', 'Most Recent Cost', 'Average Cost', 'Runs'], preppedCost.map((l) => [l.outputItemName, l.mostRecentUnitCost ?? '', l.avgUnitCost ?? '', l.sampleCount]));
      filename = 'prepped-item-cost.csv';
    } else {
      csv = toCsv(['Supplier', 'Reference', 'Outstanding', 'Days Outstanding', 'Bucket'], apAgingLines.map((l) => [l.supplierName, l.referenceNumber, l.outstanding, l.daysOutstanding, l.bucket]));
      filename = 'supplier-ap-aging.csv';
    }
    downloadCsv(filename, csv);
  };

  const apOutstanding = apBySupplier.reduce((sum, s) => sum + parseFloat(s.totalOutstanding), 0);

  return (
    <PageLayout className="animate-fade-up">
      <PageHeader
        title="Reports"
        subtitle="Central Store performance and reconciliation"
        action={<Button variant="secondary" leftIcon={<Download size={16} />} onClick={handleExport}>Export CSV</Button>}
      />

      <TabBar tabs={TABS} active={tab} onChange={setTab} className="mb-5" />

      {tab === 'valuation' && (
        <Card className="overflow-hidden">
          <ExcelTable
            columns={valuationColumns}
            rows={valuation}
            rowKey={(row) => row.inventoryItemId}
            isLoading={isLoading}
            headerTone="navy"
            totalsRow={{ name: 'Total', value: formatKes(valuationTotal) }}
            emptyState={<div className="px-4 py-10 text-center text-body-sm text-stone-500">No items to value yet.</div>}
          />
        </Card>
      )}

      {tab === 'low-stock' && (
        <Card className="overflow-hidden">
          <ExcelTable
            columns={lowStockColumns}
            rows={lowStock}
            rowKey={(row) => row.inventoryItemId}
            isLoading={isLoading}
            headerTone="red"
            emptyState={<div className="px-4 py-10 text-center text-body-sm text-stone-500">Nothing running low right now.</div>}
          />
        </Card>
      )}

      {tab === 'price-history' && (
        <Card className="space-y-4 p-5">
          <div className="w-64">
            <Select options={itemOptions} value={priceHistoryItemId} onChange={(e) => setPriceHistoryItemId(e.target.value)} />
          </div>
          <PriceTrendChart points={priceHistory.map((l) => ({ date: l.receivedAt ?? '', price: parseFloat(l.invoicePrice ?? l.unitPrice), label: l.supplierName ?? undefined }))} />
        </Card>
      )}

      {tab === 'prep-yield' && (
        <Card className="overflow-hidden">
          <ExcelTable
            columns={prepYieldColumns}
            rows={prepYieldRows}
            rowKey={(row) => row.prepRecordId}
            isLoading={isLoading}
            headerTone="navy"
            emptyState={<div className="px-4 py-10 text-center text-body-sm text-stone-500">No prep records logged yet.</div>}
          />
        </Card>
      )}

      {tab === 'discrepancy' && (
        <Card className="overflow-hidden">
          <ExcelTable
            columns={discrepancyColumns}
            rows={discrepancy}
            rowKey={(row) => row.stockCountLineId}
            isLoading={isLoading}
            headerTone="red"
            emptyState={<div className="px-4 py-10 text-center text-body-sm text-stone-500">No variances to review — every approved count matched expected quantities.</div>}
          />
        </Card>
      )}

      {tab === 'prepped-cost' && (
        <Card className="overflow-hidden">
          <ExcelTable
            columns={preppedCostColumns}
            rows={preppedCost}
            rowKey={(row) => row.outputItemId}
            isLoading={isLoading}
            headerTone="navy"
            emptyState={<div className="px-4 py-10 text-center text-body-sm text-stone-500">No prepped items with recorded runs yet.</div>}
          />
        </Card>
      )}

      {tab === 'ap-aging' && (
        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-label-sm font-semibold uppercase tracking-wide text-stone-500">Total Outstanding</p>
            <p className="mt-1 text-display-lg font-semibold tabular-nums text-stone-900">{formatKes(apOutstanding)}</p>
          </Card>
          <Card className="overflow-hidden">
            <ExcelTable
              columns={apAgingColumns}
              rows={apAgingLines}
              rowKey={(row) => row.supplierInvoiceId}
              isLoading={isLoading}
              headerTone="red"
              emptyState={<div className="px-4 py-10 text-center text-body-sm text-stone-500">No outstanding invoices.</div>}
            />
          </Card>
        </div>
      )}
    </PageLayout>
  );
}

// ─── Manager mobile ─────────────────────────────────────────────────────────
// §8.1 row 13 mobile: "Single-metric summary cards... with tap-through to a
// simplified single-report mobile view. Not a priority to fully replicate
// every desktop report on mobile in v1 — flag any report that's desktop-only
// in the build notes when reached." Stock Valuation, Low Stock, and Price
// History get full simplified mobile views (list/sparkline — data shapes
// that read naturally on a phone). Prep Yield, Count Discrepancy, True Cost
// per Prepped Item, and Supplier AP Aging are flagged desktop-only for v1
// (per the session plan's As Built notes) — their summary card still shows
// the headline number, but tapping it explains that the full breakdown is
// on desktop rather than cramming an ExcelTable-shaped report onto a phone.
type MobileReportTab = ReportTab | null;

const DESKTOP_ONLY_REPORTS = new Set<ReportTab>(['prep-yield', 'discrepancy', 'prepped-cost', 'ap-aging']);

function InventoryReportsMobile(): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [valuation, setValuation] = useState<StockValuationLine[]>([]);
  const [valuationTotal, setValuationTotal] = useState(0);
  const [lowStock, setLowStock] = useState<LowStockAlertLine[]>([]);
  const [priceHistoryItemId, setPriceHistoryItemId] = useState('');
  const [priceHistory, setPriceHistory] = useState<PriceHistoryLine[]>([]);
  const [prepYieldCount, setPrepYieldCount] = useState(0);
  const [discrepancyCount, setDiscrepancyCount] = useState(0);
  const [preppedCostCount, setPreppedCostCount] = useState(0);
  const [apOutstanding, setApOutstanding] = useState(0);

  const [openTab, setOpenTab] = useState<MobileReportTab>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const location = await getCentralStoreLocation(accessToken);
      if (!location) {
        toast({ variant: 'error', title: 'Central Store not set up', message: 'No Central Store location was found for this organization.' });
        return;
      }
      const [itemList, valuationReport, lowStockReport, prepYieldReport, discrepancyReport, preppedCostReport, apAgingReport] = await Promise.all([
        listInventoryItems(accessToken, { isActive: true }),
        getStockValuationReport(location.id, accessToken),
        getLowStockAlertsReport(location.id, accessToken),
        getPrepYieldReport(accessToken),
        getCountDiscrepancyReport(accessToken, { locationId: location.id }),
        getTrueCostPerPreppedItemReport(accessToken),
        getSupplierApAgingReport(accessToken),
      ]);
      setItems(itemList);
      setValuation(valuationReport.lines);
      setValuationTotal(parseFloat(valuationReport.totalValue));
      setLowStock(lowStockReport);
      const yieldReports = Array.isArray(prepYieldReport) ? prepYieldReport : [prepYieldReport];
      setPrepYieldCount(yieldReports.reduce((sum, r) => sum + r.runs.length, 0));
      setDiscrepancyCount(discrepancyReport.filter((l) => l.countedQty !== null && parseFloat(l.gapQty) !== 0).length);
      setPreppedCostCount(preppedCostReport.length);
      setApOutstanding(apAgingReport.bySupplier.reduce((sum, s) => sum + parseFloat(s.totalOutstanding), 0));
      if (itemList.length > 0) setPriceHistoryItemId(itemList[0].id);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load reports', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!accessToken || !priceHistoryItemId) return;
    getPriceHistoryReport(priceHistoryItemId, accessToken).then(setPriceHistory).catch(() => setPriceHistory([]));
  }, [accessToken, priceHistoryItemId]);

  const lowStockCount = lowStock.length;

  const cards: { tab: ReportTab; label: string; value: string; icon: React.ElementType; tone: 'default' | 'warning' | 'danger' }[] = [
    { tab: 'valuation', label: 'Total Stock Value', value: formatKes(valuationTotal), icon: Wallet, tone: 'default' },
    { tab: 'low-stock', label: 'Items Low on Stock', value: String(lowStockCount), icon: Package, tone: lowStockCount > 0 ? 'warning' : 'default' },
    { tab: 'price-history', label: 'Price History', value: `${items.length} items tracked`, icon: TrendingUp, tone: 'default' },
    { tab: 'prep-yield', label: 'Prep Runs Logged', value: String(prepYieldCount), icon: Coffee, tone: 'default' },
    { tab: 'discrepancy', label: 'Count Variances', value: String(discrepancyCount), icon: ClipboardCheck, tone: discrepancyCount > 0 ? 'warning' : 'default' },
    { tab: 'prepped-cost', label: 'Prepped Items Costed', value: String(preppedCostCount), icon: Utensils, tone: 'default' },
    { tab: 'ap-aging', label: 'Owed to Suppliers', value: formatKes(apOutstanding), icon: Banknote, tone: apOutstanding > 0 ? 'danger' : 'default' },
  ];

  if (openTab) {
    return (
      <MobileReportDetail
        tab={openTab}
        onBack={() => setOpenTab(null)}
        isLoading={isLoading}
        items={items}
        valuation={valuation}
        valuationTotal={valuationTotal}
        lowStock={lowStock}
        priceHistoryItemId={priceHistoryItemId}
        onPriceHistoryItemChange={setPriceHistoryItemId}
        priceHistory={priceHistory}
        prepYieldCount={prepYieldCount}
        discrepancyCount={discrepancyCount}
        preppedCostCount={preppedCostCount}
        apOutstanding={apOutstanding}
      />
    );
  }

  return (
    <div className="min-h-full bg-crema pb-8">
      <div className="bg-espresso px-4 pb-5 pt-6 text-crema">
        <p className="font-display text-heading-lg font-medium">Reports</p>
        <p className="text-label-md text-crema/70">Central Store performance and reconciliation</p>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 py-4">
        {isLoading
          ? Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-md bg-stone-100" />)
          : cards.map(({ tab, label, value, icon: Icon, tone }) => (
              <button
                key={tab}
                type="button"
                onClick={() => setOpenTab(tab)}
                className={cn(
                  'flex flex-col items-start gap-2 rounded-md border p-3.5 text-left',
                  tone === 'warning' ? 'border-warning-border bg-warning-bg' : tone === 'danger' ? 'border-danger-border bg-danger-bg' : 'border-stone-200 bg-white',
                )}
              >
                <Icon size={18} className={tone === 'warning' ? 'text-warning' : tone === 'danger' ? 'text-danger' : 'text-espresso'} />
                <p className="text-label-sm text-stone-500">{label}</p>
                <p className="text-heading-sm font-bold tabular-nums text-stone-900">{value}</p>
                {DESKTOP_ONLY_REPORTS.has(tab) && <p className="text-label-sm text-stone-400">Full report on desktop</p>}
              </button>
            ))}
      </div>
    </div>
  );
}

function MobileReportDetail({
  tab,
  onBack,
  isLoading,
  items,
  valuation,
  valuationTotal,
  lowStock,
  priceHistoryItemId,
  onPriceHistoryItemChange,
  priceHistory,
  prepYieldCount,
  discrepancyCount,
  preppedCostCount,
  apOutstanding,
}: {
  tab: ReportTab;
  onBack: () => void;
  isLoading: boolean;
  items: InventoryItem[];
  valuation: StockValuationLine[];
  valuationTotal: number;
  lowStock: LowStockAlertLine[];
  priceHistoryItemId: string;
  onPriceHistoryItemChange: (id: string) => void;
  priceHistory: PriceHistoryLine[];
  prepYieldCount: number;
  discrepancyCount: number;
  preppedCostCount: number;
  apOutstanding: number;
}): JSX.Element {
  const title = TABS.find((t) => t.value === tab)?.label ?? 'Report';

  return (
    <div className="min-h-full bg-crema pb-8">
      <div className="bg-espresso px-4 pb-4 pt-6 text-crema">
        <button type="button" onClick={onBack} className="mb-2 flex items-center gap-1 text-label-md text-crema/80">
          <ArrowLeft size={16} /> Reports
        </button>
        <p className="font-display text-heading-md font-medium">{title}</p>
      </div>

      <div className="px-4 py-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-md bg-stone-100" />
            ))}
          </div>
        ) : tab === 'valuation' ? (
          <>
            <Card className="mb-3 p-3.5">
              <p className="text-label-sm text-stone-500">Total Value</p>
              <p className="text-heading-md font-bold tabular-nums text-stone-900">{formatKes(valuationTotal)}</p>
            </Card>
            <div className="space-y-2">
              {valuation.map((line) => (
                <div key={line.inventoryItemId} className="flex items-center justify-between rounded-md border border-stone-200 bg-white p-3">
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-semibold text-stone-900">{line.name}</p>
                    <p className="text-label-sm text-stone-500">{itemTypeLabel[line.type]} · {line.onHandQty} {line.usageUnit}</p>
                  </div>
                  <span className="shrink-0 text-body-sm font-semibold text-stone-700">{formatKes(line.value)}</span>
                </div>
              ))}
            </div>
          </>
        ) : tab === 'low-stock' ? (
          lowStock.length === 0 ? (
            <p className="py-10 text-center text-body-sm text-stone-500">Nothing running low right now.</p>
          ) : (
            <div className="space-y-2">
              {lowStock.map((line) => (
                <div key={line.inventoryItemId} className="flex items-center justify-between rounded-md border border-warning-border bg-warning-bg p-3">
                  <p className="truncate text-body-sm font-semibold text-stone-900">{line.name}</p>
                  <span className="shrink-0 text-label-md text-stone-600">{line.onHandQty} / {line.reorderLevel} {line.usageUnit}</span>
                </div>
              ))}
            </div>
          )
        ) : tab === 'price-history' ? (
          <>
            <div className="mb-3">
              <select
                value={priceHistoryItemId}
                onChange={(e) => onPriceHistoryItemChange(e.target.value)}
                className="h-11 w-full rounded-md border border-stone-200 bg-white px-3 text-body-md text-stone-900 focus:border-espresso focus:outline-none"
              >
                {items.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </div>
            <PriceTrendChart points={priceHistory.map((l) => ({ date: l.receivedAt ?? '', price: parseFloat(l.invoicePrice ?? l.unitPrice), label: l.supplierName ?? undefined }))} />
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-stone-300 px-4 py-10 text-center">
            <p className="text-body-sm font-semibold text-stone-700">
              {tab === 'prep-yield' && `${prepYieldCount} prep runs logged`}
              {tab === 'discrepancy' && `${discrepancyCount} count variances`}
              {tab === 'prepped-cost' && `${preppedCostCount} prepped items costed`}
              {tab === 'ap-aging' && formatKes(apOutstanding)}
            </p>
            <p className="max-w-xs text-label-md text-stone-500">
              The full breakdown for this report is available on the desktop app.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

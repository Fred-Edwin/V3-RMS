'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  FormField,
  Input,
  PageHeader,
  PageLayout,
  SkeletonTable,
} from '@/components/ui';
import { inventoryService } from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import type { StocktakeEntry, DiscrepancyEntry } from '@/types/inventory';

type Tab = 'shrinkage' | 'discrepancies';

const toYmd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const defaultFrom = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return toYmd(d);
};

export default function InventoryReportsPage() {
  const token = useAuthStore((s) => s.accessToken);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('shrinkage');
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(toYmd(new Date()));
  const [shrinkage, setShrinkage] = useState<StocktakeEntry[]>([]);
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const runReport = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      if (activeTab === 'shrinkage') {
        const data = await inventoryService.getShrinkageReport({ from, to }, token);
        setShrinkage(data);
      } else {
        const data = await inventoryService.getDiscrepancyReport({ from, to }, token);
        setDiscrepancies(data);
      }
      setLoaded(true);
    } catch {
      setError('Failed to load report data.');
    } finally {
      setIsLoading(false);
    }
  }, [token, activeTab, from, to]);

  return (
    <PageLayout>
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/app/admin/inventory')}>
          <ArrowLeft size={16} className="mr-1" />
          Back to Overview
        </Button>
      </div>
      <PageHeader title="Inventory Reports" subtitle="Shrinkage and discrepancy analysis" />

      {/* Tab selector */}
      <div className="mb-4 flex gap-1 rounded-lg bg-stone-100 p-1">
        {(['shrinkage', 'discrepancies'] as Tab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => { setActiveTab(tab); setLoaded(false); }}
            className={`flex-1 rounded-md py-2 text-label-sm font-medium capitalize transition-colors ${
              activeTab === tab ? 'bg-espresso text-white shadow-sm' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card className="mb-5 bg-parchment shadow-md">
        <CardBody>
          <div className="flex flex-wrap items-end gap-4">
            <FormField label="From" htmlFor="report-from">
              <Input id="report-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            </FormField>
            <FormField label="To" htmlFor="report-to">
              <Input id="report-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </FormField>
            <Button onClick={() => void runReport()} disabled={isLoading} isLoading={isLoading}>
              Run Report
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Results */}
      {isLoading ? (
        <SkeletonTable rows={8} />
      ) : error ? (
        <EmptyState icon={<AlertTriangle size={40} className="text-stone-400" />} heading="Error" body={error ?? undefined} action={<Button onClick={() => void runReport()}>Retry</Button>} />
      ) : !loaded ? (
        <EmptyState icon={<AlertTriangle size={40} className="text-stone-400" />} heading="Run a report" body="Select a date range and click Run Report to see results." />
      ) : activeTab === 'shrinkage' ? (
        <Card className="bg-parchment shadow-md">
          <CardHeader>
            <h2 className="font-display text-xl text-stone-900">Shrinkage Report</h2>
          </CardHeader>
          <CardBody>
            {shrinkage.length === 0 ? (
              <p className="text-body-sm text-stone-500">No shrinkage entries found for this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-left">
                      <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Item</th>
                      <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Station</th>
                      <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Expected</th>
                      <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Actual</th>
                      <th className="pb-2 text-label-sm font-medium text-stone-500">Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shrinkage.map((entry) => (
                      <tr key={entry.id} className="border-b border-stone-100 last:border-0">
                        <td className="py-2 pr-4 text-stone-900">{entry.menuItem?.name ?? '—'}</td>
                        <td className="py-2 pr-4 text-stone-500">{entry.station}</td>
                        <td className="py-2 pr-4 text-stone-600">{entry.expectedQty}</td>
                        <td className="py-2 pr-4 text-stone-600">{entry.actualQty}</td>
                        <td className={`py-2 font-semibold ${entry.variance < 0 ? 'text-red-600' : entry.variance > 0 ? 'text-green-600' : 'text-stone-500'}`}>
                          {entry.variance > 0 ? '+' : ''}{entry.variance}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      ) : (
        <Card className="bg-parchment shadow-md">
          <CardHeader>
            <h2 className="font-display text-xl text-stone-900">Discrepancy Report</h2>
          </CardHeader>
          <CardBody>
            {discrepancies.length === 0 ? (
              <p className="text-body-sm text-stone-500">No discrepancies found for this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-left">
                      <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Date</th>
                      <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Branch</th>
                      <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Item</th>
                      <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Requested</th>
                      <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Dispatched</th>
                      <th className="pb-2 text-label-sm font-medium text-stone-500">Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {discrepancies.map((entry) => (
                      <tr key={entry.id} className="border-b border-stone-100 last:border-0">
                        <td className="py-2 pr-4 text-stone-600">
                          {new Date(entry.requisition.submittedAt).toLocaleDateString('en-GB')}
                        </td>
                        <td className="py-2 pr-4 text-stone-600">{entry.requisition.organization.name}</td>
                        <td className="py-2 pr-4 font-medium text-stone-900">{entry.menuItem.name}</td>
                        <td className="py-2 pr-4 text-stone-600">{entry.requestedQty}</td>
                        <td className="py-2 pr-4 text-stone-600">{entry.dispatchedQty ?? '—'}</td>
                        <td className="py-2 font-semibold text-amber-700">{entry.receivedQty ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </PageLayout>
  );
}

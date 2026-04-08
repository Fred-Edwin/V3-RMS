'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Info } from 'lucide-react';
import { EmptyState, PageHeader, PageLayout, PriceDisplay, SkeletonTable, Table, type TableColumn } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { reportService } from '@/services/reportService';
import { env } from '@/lib/env';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type {
  OutstandingBalancesReport,
  OutstandingHouseAccountRow,
  OutstandingCorporateAccountRow,
  OutstandingCustomerCreditRow,
} from '@/types/report';

type HouseRow = Record<string, unknown> & OutstandingHouseAccountRow;
type CorporateRow = Record<string, unknown> & OutstandingCorporateAccountRow;
type CreditRow = Record<string, unknown> & OutstandingCustomerCreditRow;

export default function OutstandingBalancesPage(): JSX.Element {
  const router = useRouter();
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);

  useEffect(() => {
    if (!env.creditAccounts) router.replace('/app/manage/dashboard');
  }, [router]);

  const [report, setReport] = useState<OutstandingBalancesReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'house' | 'corporate' | 'credit'>('house');

  const loadReport = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const data = await reportService.getOutstandingBalances(accessToken);
      setReport(data);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load outstanding balances.';
      toast({ variant: 'error', title: 'Load failed', message });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const houseColumns: TableColumn<HouseRow>[] = [
    { key: 'userName', label: 'Name' },
    {
      key: 'userRole',
      label: 'Role',
      render: (value) => (
        <span className="text-body-sm capitalize text-stone-500">{String(value).toLowerCase().replace('_', ' ')}</span>
      ),
    },
    {
      key: 'currentBalance',
      label: 'Balance (KES)',
      render: (value) => <PriceDisplay amount={Number.parseFloat(String(value))} />,
    },
    {
      key: 'creditLimit',
      label: 'Credit Limit',
      render: (value) =>
        value ? (
          <PriceDisplay amount={Number.parseFloat(String(value))} />
        ) : (
          <span className="text-body-sm text-stone-400">Uncapped</span>
        ),
    },
  ];

  const corporateColumns: TableColumn<CorporateRow>[] = [
    { key: 'companyName', label: 'Company' },
    { key: 'contactName', label: 'Contact' },
    { key: 'contactPhone', label: 'Phone' },
    {
      key: 'currentBalance',
      label: 'Balance (KES)',
      render: (value) => <PriceDisplay amount={Number.parseFloat(String(value))} />,
    },
    {
      key: 'creditLimit',
      label: 'Credit Limit',
      render: (value) =>
        value ? (
          <PriceDisplay amount={Number.parseFloat(String(value))} />
        ) : (
          <span className="text-body-sm text-stone-400">Uncapped</span>
        ),
    },
  ];

  const creditColumns: TableColumn<CreditRow>[] = [
    { key: 'customerName', label: 'Customer' },
    { key: 'customerPhone', label: 'Phone' },
    {
      key: 'currentBalance',
      label: 'Balance (KES)',
      render: (value) => <PriceDisplay amount={Number.parseFloat(String(value))} />,
    },
    {
      key: 'creditLimit',
      label: 'Credit Limit',
      render: (value) => <PriceDisplay amount={Number.parseFloat(String(value))} />,
    },
  ];

  const tabs = [
    { key: 'house' as const, label: 'House Accounts', count: report?.staffBenefits?.length ?? 0 },
    { key: 'corporate' as const, label: 'Corporate', count: report?.corporateAccounts?.length ?? 0 },
    { key: 'credit' as const, label: 'Customer Credit', count: report?.customerCreditAccounts?.length ?? 0 },
  ];

  return (
    <PageLayout className="animate-fade-up space-y-6">
      <PageHeader
        title="Outstanding Balances"
        titleClassName="font-display text-display-lg font-semibold text-espresso"
        subtitle="Credit accounts with unpaid balances across all types."
      />

      {/* Summary cards — AR only; house accounts excluded from totals */}
      {report && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: 'Corporate', value: report.totals.corporateAccounts },
            { label: 'Customer Credit', value: report.totals.customerCreditAccounts },
            { label: 'Total Owed', value: report.totals.grandTotal, highlight: true },
          ].map((card) => (
            <div
              key={card.label}
              className={`rounded-xl border p-4 shadow-sm ${card.highlight ? 'border-espresso/20 bg-espresso/5' : 'border-stone-200 bg-white'}`}
            >
              <p className="text-label-sm text-stone-500">{card.label}</p>
              <p className={`mt-1 text-display-sm font-bold ${card.highlight ? 'text-espresso' : 'text-stone-800'}`}>
                <PriceDisplay amount={Number.parseFloat(card.value)} />
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <section className="rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="flex border-b border-stone-200">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-label-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-b-2 border-espresso text-espresso'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-caption font-semibold text-stone-600">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-5">
          {isLoading ? (
            <SkeletonTable columns={4} rows={5} />
          ) : !report ? null : activeTab === 'house' ? (
            <>
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <Info size={16} className="mt-0.5 shrink-0 text-amber-600" />
                <p className="text-body-sm text-amber-800">
                  House account consumption is tracked for cap enforcement only — it is not included in the accounts receivable total above.
                </p>
              </div>
              {(report.staffBenefits?.length ?? 0) === 0 ? (
                <EmptyState icon={<AlertCircle size={24} />} heading="No outstanding house accounts" body="All house accounts have a zero balance." />
              ) : (
                <Table columns={houseColumns} data={(report.staffBenefits ?? []) as HouseRow[]} keyField="id" />
              )}
            </>
          ) : activeTab === 'corporate' ? (
            report.corporateAccounts.length === 0 ? (
              <EmptyState icon={<AlertCircle size={24} />} heading="No outstanding corporate accounts" body="All corporate accounts are settled." />
            ) : (
              <Table columns={corporateColumns} data={report.corporateAccounts as CorporateRow[]} keyField="id" />
            )
          ) : report.customerCreditAccounts.length === 0 ? (
            <EmptyState icon={<AlertCircle size={24} />} heading="No outstanding customer credit accounts" body="All customer credit accounts are settled." />
          ) : (
            <Table columns={creditColumns} data={report.customerCreditAccounts as CreditRow[]} keyField="id" />
          )}
        </div>
      </section>
    </PageLayout>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Info } from 'lucide-react';
import { EmptyState, ExcelTable, PageHeader, PageLayout, PriceDisplay, SkeletonTable, TabBar, type ExcelColumn } from '@/components/ui';
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

  const houseColumns: ExcelColumn<HouseRow>[] = [
    { key: 'userName', label: 'Name', render: (row) => row.userName },
    {
      key: 'userRole',
      label: 'Role',
      render: (row) => (
        <span className="text-body-sm capitalize text-stone-500">{row.userRole.toLowerCase().replace('_', ' ')}</span>
      ),
    },
    {
      key: 'currentBalance',
      label: 'Balance (KES)',
      numeric: true,
      render: (row) => <PriceDisplay amount={Number.parseFloat(String(row.currentBalance))} />,
    },
    {
      key: 'creditLimit',
      label: 'Credit Limit',
      numeric: true,
      render: (row) =>
        row.creditLimit ? (
          <PriceDisplay amount={Number.parseFloat(String(row.creditLimit))} />
        ) : (
          <span className="text-body-sm text-stone-400">Uncapped</span>
        ),
    },
  ];

  const corporateColumns: ExcelColumn<CorporateRow>[] = [
    { key: 'companyName', label: 'Company', render: (row) => row.companyName },
    { key: 'contactName', label: 'Contact', render: (row) => row.contactName },
    { key: 'contactPhone', label: 'Phone', render: (row) => row.contactPhone },
    {
      key: 'currentBalance',
      label: 'Balance (KES)',
      numeric: true,
      render: (row) => <PriceDisplay amount={Number.parseFloat(String(row.currentBalance))} />,
    },
    {
      key: 'creditLimit',
      label: 'Credit Limit',
      numeric: true,
      render: (row) =>
        row.creditLimit ? (
          <PriceDisplay amount={Number.parseFloat(String(row.creditLimit))} />
        ) : (
          <span className="text-body-sm text-stone-400">Uncapped</span>
        ),
    },
  ];

  const creditColumns: ExcelColumn<CreditRow>[] = [
    { key: 'customerName', label: 'Customer', render: (row) => row.customerName },
    { key: 'customerPhone', label: 'Phone', render: (row) => row.customerPhone },
    {
      key: 'currentBalance',
      label: 'Balance (KES)',
      numeric: true,
      render: (row) => <PriceDisplay amount={Number.parseFloat(String(row.currentBalance))} />,
    },
    {
      key: 'creditLimit',
      label: 'Credit Limit',
      numeric: true,
      render: (row) => <PriceDisplay amount={Number.parseFloat(String(row.creditLimit))} />,
    },
  ];

  const tabs = [
    { value: 'house' as const, label: `House Accounts${report?.staffBenefits?.length ? ` (${report.staffBenefits.length})` : ''}` },
    { value: 'corporate' as const, label: `Corporate${report?.corporateAccounts?.length ? ` (${report.corporateAccounts.length})` : ''}` },
    { value: 'credit' as const, label: `Customer Credit${report?.customerCreditAccounts?.length ? ` (${report.customerCreditAccounts.length})` : ''}` },
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
        <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab} variant="underline" className="px-2" />

        <div className="p-4 sm:p-5">
          {isLoading ? (
            <SkeletonTable columns={4} rows={5} />
          ) : !report ? null : activeTab === 'house' ? (
            <>
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning-border bg-warning-bg px-4 py-3">
                <Info size={16} className="mt-0.5 shrink-0 text-warning" />
                <p className="text-body-sm text-warning">
                  House account consumption is tracked for cap enforcement only — it is not included in the accounts receivable total above.
                </p>
              </div>
              {(report.staffBenefits?.length ?? 0) === 0 ? (
                <EmptyState icon={<AlertCircle size={24} />} heading="No outstanding house accounts" body="All house accounts have a zero balance." />
              ) : (
                <ExcelTable
                  columns={houseColumns}
                  rows={(report.staffBenefits ?? []) as HouseRow[]}
                  rowKey={(row) => row.id}
                  headerTone="gray"
                />
              )}
            </>
          ) : activeTab === 'corporate' ? (
            report.corporateAccounts.length === 0 ? (
              <EmptyState icon={<AlertCircle size={24} />} heading="No outstanding corporate accounts" body="All corporate accounts are settled." />
            ) : (
              <ExcelTable
                columns={corporateColumns}
                rows={report.corporateAccounts as CorporateRow[]}
                rowKey={(row) => row.id}
                headerTone="gray"
              />
            )
          ) : report.customerCreditAccounts.length === 0 ? (
            <EmptyState icon={<AlertCircle size={24} />} heading="No outstanding customer credit accounts" body="All customer credit accounts are settled." />
          ) : (
            <ExcelTable
              columns={creditColumns}
              rows={report.customerCreditAccounts as CreditRow[]}
              rowKey={(row) => row.id}
              headerTone="gray"
            />
          )}
        </div>
      </section>
    </PageLayout>
  );
}

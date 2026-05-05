'use client';

import { useCallback, useEffect, useState } from 'react';
import { Input, PageHeader, PageLayout, SkeletonTable } from '@/components/ui';
import { PayslipDetailModal } from '@/components/payslips/PayslipDetailModal';
import { PayslipTable } from '@/components/payslips/PayslipTable';
import { useToast } from '@/hooks/useToast';
import { payslipService } from '@/services/payslipService';
import { useAuthStore } from '@/store/authStore';
import type { Payslip } from '@/types/payslip';

export default function ManagerPayslipsPage(): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const branchId = useAuthStore((state) => state.organizationId);
  const { toast } = useToast();

  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPayPeriod, setSelectedPayPeriod] = useState('');

  const loadPayslips = useCallback(async () => {
    if (!accessToken || !branchId) return;
    setIsLoading(true);
    try {
      const result = await payslipService.listBranchPayslips(branchId, accessToken, {
        payPeriod: selectedPayPeriod || undefined,
        page: 1,
        perPage: 50,
      });
      setPayslips(result.items);
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Failed to load branch payslips',
        message: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, branchId, selectedPayPeriod, toast]);

  useEffect(() => {
    void loadPayslips();
  }, [loadPayslips]);

  return (
    <PageLayout className="animate-fade-up space-y-6">
      <PageHeader
        title="Branch Payslips"
        subtitle="Read-only branch payroll visibility for period checks, staff support, and print-ready review."
        titleClassName="font-display text-display-lg font-semibold text-espresso"
      />

      <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:max-w-[280px]">
          <Input label="Pay period" type="month" value={selectedPayPeriod} onChange={(event) => setSelectedPayPeriod(event.target.value)} />
        </div>
      </section>

      <section className="rounded-[24px] border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4">
          <h2 className="font-display text-heading-lg font-semibold text-espresso">Branch ledger</h2>
          <p className="mt-1 text-body-sm text-stone-500">No editing controls here. This view is for review, clarification, and print support only.</p>
        </div>

        {isLoading ? (
          <SkeletonTable rows={6} columns={6} />
        ) : (
          <PayslipTable
            payslips={payslips}
            emptyHeading="No branch payslips"
            emptyBody="Payslips for this branch and period will appear here when available."
            showBranch={false}
            onView={(payslip) => {
              setSelectedPayslip(payslip);
              setIsDetailOpen(true);
            }}
          />
        )}
      </section>

      <PayslipDetailModal
        payslip={selectedPayslip}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />
    </PageLayout>
  );
}

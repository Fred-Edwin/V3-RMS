'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Input, PageHeader, PageLayout, Select, SkeletonTable } from '@/components/ui';
import { PayslipDetailModal } from '@/components/payslips/PayslipDetailModal';
import { PayslipTable } from '@/components/payslips/PayslipTable';
import { useToast } from '@/hooks/useToast';
import { branchService, type BranchDto } from '@/services/branchService';
import { payslipService } from '@/services/payslipService';
import { useAuthStore } from '@/store/authStore';
import type { Payslip } from '@/types/payslip';

export default function AccountantPayslipsPage(): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedPayPeriod, setSelectedPayPeriod] = useState('');

  useEffect(() => {
    if (!accessToken) return;
    branchService.listBranches(accessToken)
      .then((rows) => setBranches(rows.filter((branch) => branch.isActive && !branch.isHub)))
      .catch(() => {
        // Non-critical: list still works without branch labels in the filter.
      });
  }, [accessToken]);

  const loadPayslips = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const result = selectedBranchId
        ? await payslipService.listBranchPayslips(selectedBranchId, accessToken, {
            payPeriod: selectedPayPeriod || undefined,
            page: 1,
            perPage: 50,
          })
        : await payslipService.listAccountantPayslips(accessToken, {
            payPeriod: selectedPayPeriod || undefined,
            page: 1,
            perPage: 50,
          });
      setPayslips(result.items);
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Failed to load accountant payslips',
        message: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, selectedBranchId, selectedPayPeriod, toast]);

  useEffect(() => {
    void loadPayslips();
  }, [loadPayslips]);

  const branchOptions = useMemo(
    () => [
      { value: '', label: 'All branches' },
      ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
    ],
    [branches],
  );

  return (
    <PageLayout className="animate-fade-up space-y-6">
      <PageHeader
        title="Payslips"
        subtitle="Cross-branch read-only payroll ledger for reconciliation, verification, and document print."
        titleClassName="font-display text-display-lg font-semibold text-espresso"
      />

      <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:max-w-[560px]">
          <Input label="Pay period" type="month" value={selectedPayPeriod} onChange={(event) => setSelectedPayPeriod(event.target.value)} />
          <Select label="Branch" value={selectedBranchId} onChange={(event) => setSelectedBranchId(event.target.value)} options={branchOptions} />
        </div>
      </section>

      <section className="rounded-[24px] border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4">
          <h2 className="font-display text-heading-lg font-semibold text-espresso">Payroll ledger</h2>
          <p className="mt-1 text-body-sm text-stone-500">A calmer financial surface for filtering, validating, and printing without HR mutation controls.</p>
        </div>

        {isLoading ? (
          <SkeletonTable rows={6} columns={7} />
        ) : (
          <PayslipTable
            payslips={payslips}
            emptyHeading="No payslips found"
            emptyBody="Try another branch or pay period."
            showBranch
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

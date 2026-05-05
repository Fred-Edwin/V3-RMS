'use client';

import { useCallback, useEffect, useState } from 'react';
import { Input, PageHeader, PageLayout, SkeletonCard } from '@/components/ui';
import { PayslipCardList } from '@/components/payslips/PayslipCardList';
import { PayslipDetailModal } from '@/components/payslips/PayslipDetailModal';
import { useToast } from '@/hooks/useToast';
import { payslipService } from '@/services/payslipService';
import { useAuthStore } from '@/store/authStore';
import type { Payslip } from '@/types/payslip';

export default function MyPayslipsPage(): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [selectedPayPeriod, setSelectedPayPeriod] = useState('');
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadPayslips = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const result = await payslipService.listMyPayslips(accessToken, {
        payPeriod: selectedPayPeriod || undefined,
        page: 1,
        perPage: 24,
      });
      setPayslips(result.items);
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Failed to load payslips',
        message: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, selectedPayPeriod, toast]);

  useEffect(() => {
    void loadPayslips();
  }, [loadPayslips]);

  return (
    <PageLayout className="animate-fade-up space-y-6">
      <PageHeader
        title="My Payslips"
        subtitle="A formal, print-ready record of your monthly pay statements."
        titleClassName="font-display text-display-lg font-semibold text-espresso"
      />

      <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm md:max-w-[280px]">
        <Input label="Pay period" type="month" value={selectedPayPeriod} onChange={(event) => setSelectedPayPeriod(event.target.value)} />
      </section>

      {isLoading ? (
        <div className="grid gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <PayslipCardList
          payslips={payslips}
          onSelect={(payslip) => {
            setSelectedPayslip(payslip);
            setIsDetailOpen(true);
          }}
        />
      )}

      <PayslipDetailModal
        payslip={selectedPayslip}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />
    </PageLayout>
  );
}

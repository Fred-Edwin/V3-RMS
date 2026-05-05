'use client';

import { ChevronRight } from 'lucide-react';
import { EmptyState } from '@/components/ui';
import type { Payslip } from '@/types/payslip';
import { formatCurrency, formatPayPeriod, formatShortDate } from './payslip-utils';
import { PayslipStatusBadge } from './PayslipStatusBadge';

interface PayslipCardListProps {
  payslips: Payslip[];
  onSelect: (payslip: Payslip) => void;
}

export function PayslipCardList({ payslips, onSelect }: PayslipCardListProps): JSX.Element {
  if (payslips.length === 0) {
    return (
      <div className="rounded-[24px] border border-stone-200 bg-white shadow-sm">
        <EmptyState
          icon={<ChevronRight size={22} />}
          heading="No payslips yet"
          body="When payroll records are available, they will appear here with a print-ready statement view."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {payslips.map((payslip) => (
        <button
          key={payslip.id}
          type="button"
          onClick={() => onSelect(payslip)}
          className="w-full rounded-[24px] border border-stone-200 bg-white p-5 text-left shadow-sm transition-transform duration-150 hover:-translate-y-0.5 hover:border-stone-300"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="font-display text-heading-md font-semibold text-espresso">{formatPayPeriod(payslip.payPeriod)}</p>
              <p className="mt-1 text-body-sm text-stone-500">Paid on {formatShortDate(payslip.payDate)}</p>
            </div>
            <PayslipStatusBadge isLocked={payslip.isLocked} />
          </div>

          <div className="mt-5 grid gap-4 border-t border-stone-100 pt-4 md:grid-cols-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-stone-500">Gross pay</p>
              <p className="mt-2 text-body-md font-semibold text-stone-900">{formatCurrency(payslip.grossPay)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-stone-500">Deductions</p>
              <p className="mt-2 text-body-md font-semibold text-stone-900">{formatCurrency(payslip.totalDeductions)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-stone-500">Net pay</p>
              <p className="mt-2 font-display text-heading-lg font-semibold text-espresso">{formatCurrency(payslip.netPay)}</p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

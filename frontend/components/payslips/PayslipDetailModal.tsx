'use client';

import { Printer } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import type { Payslip, PayslipLineItem } from '@/types/payslip';
import {
  formatCurrency,
  formatLongDate,
  formatPayPeriod,
  formatShortDate,
} from './payslip-utils';
import { PayslipStatusBadge } from './PayslipStatusBadge';

interface PayslipDetailModalProps {
  payslip: Payslip | null;
  isOpen: boolean;
  onClose: () => void;
}

interface SectionRow {
  label: string;
  amount: string | null;
}

const renderRows = (rows: SectionRow[]): JSX.Element[] =>
  rows
    .filter((row) => row.amount !== null)
    .map((row) => (
    <div key={row.label} className="flex items-center justify-between gap-4 border-b border-stone-100 py-3">
      <span className="text-body-sm text-stone-600">{row.label}</span>
      <span className="text-body-sm font-semibold text-stone-900">{formatCurrency(row.amount)}</span>
    </div>
    ));

const renderLineItems = (items: PayslipLineItem[] | null): JSX.Element[] =>
  (items ?? []).map((item, index) => (
    <div key={`${item.label}-${index}`} className="flex items-center justify-between gap-4 border-b border-stone-100 py-3">
      <span className="text-body-sm text-stone-600">{item.label}</span>
      <span className="text-body-sm font-semibold text-stone-900">{formatCurrency(item.amount)}</span>
    </div>
  ));

export function PayslipDetailModal({ payslip, isOpen, onClose }: PayslipDetailModalProps): JSX.Element {
  const footer = (
    <div className="flex items-center justify-end gap-3">
      <Button variant="ghost" onClick={onClose}>Close</Button>
      <Button leftIcon={<Printer size={16} />} onClick={() => window.print()}>
        Print payslip
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={payslip ? payslip.user.name : 'Payslip'}
      maxWidth="lg"
      className="print:max-w-none max-w-4xl rounded-2xl"
      footer={footer}
    >
      {!payslip ? null : (
        <div className="space-y-6 print:space-y-4">
          <style jsx global>{`
            @media print {
              @page {
                size: A4 portrait;
                margin: 12mm;
              }
              body * {
                visibility: hidden;
              }
              body {
                margin: 0 !important;
                background: white !important;
              }
              .payslip-print-root,
              .payslip-print-root * {
                visibility: visible;
              }
              .payslip-print-root {
                position: fixed !important;
                left: 0 !important;
                top: 0 !important;
                right: 0 !important;
                width: 186mm !important;
                max-width: 186mm !important;
                margin: 0 auto !important;
                padding: 0 !important;
                background: white !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                border: 0 !important;
              }
            }
          `}</style>

          <div className="payslip-print-root rounded-[20px] border border-stone-200 bg-gradient-to-b from-[#FCFAF6] to-white p-6 print:border-0 print:bg-white print:p-0">
            <div className="flex flex-col gap-4 border-b border-stone-200 pb-5 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">Wendo Coffee Bistro</p>
                <h3 className="mt-2 font-display text-display-lg font-semibold text-espresso">Payslip</h3>
                <p className="mt-2 text-body-md text-stone-600">
                  {payslip.user.name}
                  {payslip.user.employeeProfile?.jobTitle ? ` · ${payslip.user.employeeProfile.jobTitle}` : ''}
                </p>
              </div>
              <div className="space-y-3 text-left md:text-right">
                <PayslipStatusBadge isLocked={payslip.isLocked} />
                <div className="text-caption text-stone-500">
                  <div>{payslip.organization.name}</div>
                  <div>{formatPayPeriod(payslip.payPeriod)}</div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 rounded-2xl border border-stone-200 bg-[#FAF7F2] p-4 md:grid-cols-4 print:bg-white">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-stone-500">Pay date</p>
                <p className="mt-2 text-body-sm font-semibold text-stone-900">{formatLongDate(payslip.payDate)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-stone-500">Gross pay</p>
                <p className="mt-2 text-body-sm font-semibold text-stone-900">{formatCurrency(payslip.grossPay)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-stone-500">Deductions</p>
                <p className="mt-2 text-body-sm font-semibold text-stone-900">{formatCurrency(payslip.totalDeductions)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-stone-500">Net pay</p>
                <p className="mt-2 font-display text-heading-lg font-semibold text-espresso">{formatCurrency(payslip.netPay)}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Earnings</p>
                <div className="mt-3">
                  {renderRows([
                    { label: 'Basic Salary', amount: payslip.basicSalary },
                    { label: 'House Allowance', amount: payslip.houseAllowance },
                    { label: 'Transport Allowance', amount: payslip.transportAllowance },
                  ])}
                  {renderLineItems(payslip.otherAllowances)}
                </div>
              </section>

              <section>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Deductions</p>
                <div className="mt-3">
                  {renderRows([
                    { label: 'PAYE', amount: payslip.paye },
                    { label: 'SHA', amount: payslip.nssf },
                    { label: 'Housing Levy', amount: payslip.housingLevy },
                    { label: 'HELB', amount: payslip.helb },
                  ])}
                  {renderLineItems(payslip.otherDeductions)}
                </div>
              </section>
            </div>

            <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 print:border-stone-200">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Summary</p>
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between gap-4 border-b border-stone-100 pb-3">
                  <span className="text-body-sm text-stone-600">Gross Pay</span>
                  <span className="text-body-sm font-semibold text-stone-900">{formatCurrency(payslip.grossPay)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-stone-100 pb-3">
                  <span className="text-body-sm text-stone-600">Total Deductions</span>
                  <span className="text-body-sm font-semibold text-stone-900">{formatCurrency(payslip.totalDeductions)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-body-sm font-semibold text-stone-900">Net Pay</span>
                  <span className="font-display text-display-md font-semibold text-espresso">{formatCurrency(payslip.netPay)}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 text-caption text-stone-500">
              Created by {payslip.createdBy.name} on {formatShortDate(payslip.createdAt)}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

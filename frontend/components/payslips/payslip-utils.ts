import type { Payslip, PayslipCreateInput, PayslipLineItem } from '@/types/payslip';

export interface PayslipComputedTotals {
  grossPay: string;
  totalDeductions: string;
  netPay: string;
}

export const formatCurrency = (value: string | number | null | undefined): string => {
  const numericValue = Number(value ?? 0);
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numericValue) ? numericValue : 0);
};

export const formatPayPeriod = (payPeriod: string): string => {
  const [year, month] = payPeriod.split('-').map(Number);
  const date = new Date(year, (month || 1) - 1, 1);
  if (Number.isNaN(date.getTime())) return payPeriod;
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(date);
};

export const formatShortDate = (value: string): string =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));

export const formatLongDate = (value: string): string =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));

export const monthInputValue = (value?: string): string => value ?? '';

const sumLineItems = (items?: PayslipLineItem[] | null): number =>
  (items ?? []).reduce((total, item) => total + Number(item.amount || 0), 0);

export const computePayslipTotals = (input: Partial<PayslipCreateInput>): PayslipComputedTotals => {
  const basicSalary = Number(input.basicSalary || 0);
  const houseAllowance = Number(input.houseAllowance || 0);
  const transportAllowance = Number(input.transportAllowance || 0);
  const paye = Number(input.paye || 0);
  const nssf = Number(input.nssf || 0);
  const housingLevy = Number(input.housingLevy || 0);
  const helb = Number(input.helb || 0);

  const grossPay = basicSalary + houseAllowance + transportAllowance + sumLineItems(input.otherAllowances);
  const totalDeductions = paye + nssf + housingLevy + helb + sumLineItems(input.otherDeductions);
  const netPay = grossPay - totalDeductions;

  return {
    grossPay: grossPay.toFixed(2),
    totalDeductions: totalDeductions.toFixed(2),
    netPay: netPay.toFixed(2),
  };
};

export const toEditableInput = (payslip: Payslip): PayslipCreateInput => ({
  userId: payslip.userId,
  payPeriod: payslip.payPeriod,
  payDate: payslip.payDate.slice(0, 10),
  basicSalary: payslip.basicSalary,
  houseAllowance: payslip.houseAllowance ?? '',
  transportAllowance: payslip.transportAllowance ?? '',
  otherAllowances: payslip.otherAllowances ?? [],
  paye: payslip.paye,
  nssf: payslip.nssf,
  housingLevy: payslip.housingLevy,
  helb: payslip.helb ?? '',
  otherDeductions: payslip.otherDeductions ?? [],
});

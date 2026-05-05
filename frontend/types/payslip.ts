import type { AppRole } from './auth';

export interface PayslipLineItem {
  label: string;
  amount: string;
}

export interface PayslipOrganizationSummary {
  id: string;
  name: string;
}

export interface PayslipUserSummary {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  organizationId: string | null;
  employeeProfile?: {
    jobTitle: string | null;
  } | null;
}

export interface PayslipCreatorSummary {
  id: string;
  name: string;
  role: AppRole;
}

export interface Payslip {
  id: string;
  organizationId: string;
  userId: string;
  payPeriod: string;
  payDate: string;
  basicSalary: string;
  houseAllowance: string | null;
  transportAllowance: string | null;
  otherAllowances: PayslipLineItem[] | null;
  paye: string;
  nssf: string;
  housingLevy: string;
  helb: string | null;
  otherDeductions: PayslipLineItem[] | null;
  grossPay: string;
  totalDeductions: string;
  netPay: string;
  isLocked: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  organization: PayslipOrganizationSummary;
  user: PayslipUserSummary;
  createdBy: PayslipCreatorSummary;
}

export interface PayslipListPagination {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface PayslipListResult {
  items: Payslip[];
  pagination: PayslipListPagination;
}

export interface PayslipListFilters {
  payPeriod?: string;
  userId?: string;
  isLocked?: boolean;
  page?: number;
  perPage?: number;
}

export interface PayslipCreateInput {
  userId: string;
  payPeriod: string;
  payDate: string;
  basicSalary: string;
  houseAllowance?: string | null;
  transportAllowance?: string | null;
  otherAllowances?: PayslipLineItem[];
  paye: string;
  nssf: string;
  housingLevy: string;
  helb?: string | null;
  otherDeductions?: PayslipLineItem[];
}

export interface PayslipUpdateInput extends PayslipCreateInput {}

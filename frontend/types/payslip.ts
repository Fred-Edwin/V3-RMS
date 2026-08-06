import type { AppRole } from './auth';

export interface PayslipLineItem {
  label: string;
  amount: string;
}

export interface PayslipOrganizationSummary {
  id: string;
  name: string;
  kraPIN: string | null;
}

export interface PayslipEmployeeProfile {
  jobTitle: string | null;
  kraPIN: string | null;
  shifNhifNumber: string | null;
  nssfNumber: string | null;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  bankBranch: string | null;
}

export interface PayslipUserSummary {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  organizationId: string | null;
  employeeProfile?: PayslipEmployeeProfile | null;
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
  grossPay: string;
  paye: string;
  sha: string;
  nssfTier1: string;
  nssfTier2: string;
  housingLevy: string;
  helb: string | null;
  advance: string | null;
  incentives: string | null;
  overtime: string | null;
  allowances: string | null;
  otherDeductions: PayslipLineItem[] | null;
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
  organizationId?: string;
  isLocked?: boolean;
  page?: number;
  perPage?: number;
}

export interface BulkUpsertRow {
  userId: string;
  payDate: string;
  grossPay: string;
  paye: string;
  sha: string;
  nssfTier1: string;
  nssfTier2: string;
  housingLevy: string;
  helb?: string | null;
  advance?: string | null;
  incentives?: string | null;
  overtime?: string | null;
  allowances?: string | null;
  otherDeductions?: PayslipLineItem[];
}

export interface BulkUpsertInput {
  payPeriod: string;
  organizationId: string;
  rows: BulkUpsertRow[];
}

export interface BulkUpsertResult {
  saved: Payslip[];
  skipped: string[];
}

export interface PublishRevertInput {
  payPeriod: string;
  organizationId: string;
}

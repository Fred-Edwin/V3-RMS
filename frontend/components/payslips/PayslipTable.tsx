'use client';

import { Eye, Lock, Pencil } from 'lucide-react';
import { Button, EmptyState, Table, type TableColumn } from '@/components/ui';
import type { Payslip } from '@/types/payslip';
import { formatCurrency, formatPayPeriod } from './payslip-utils';
import { PayslipStatusBadge } from './PayslipStatusBadge';

interface PayslipTableProps {
  payslips: Payslip[];
  emptyHeading: string;
  emptyBody: string;
  showBranch?: boolean;
  canEdit?: boolean;
  canLock?: boolean;
  onView: (payslip: Payslip) => void;
  onEdit?: (payslip: Payslip) => void;
  onLock?: (payslip: Payslip) => void;
}

type PayslipTableRow = Payslip & {
  staffName: string;
};

export function PayslipTable({
  payslips,
  emptyHeading,
  emptyBody,
  showBranch = true,
  canEdit = false,
  canLock = false,
  onView,
  onEdit,
  onLock,
}: PayslipTableProps): JSX.Element {
  const columns: TableColumn<PayslipTableRow>[] = [
    {
      key: 'staffName',
      label: 'Staff',
      render: (_, row) => (
        <div className="min-w-[180px]">
          <div className="font-semibold text-stone-900">{row.user.name}</div>
          <div className="text-caption text-stone-500">
            {row.user.employeeProfile?.jobTitle ?? row.user.role.replace('_', ' ')}
          </div>
        </div>
      ),
    },
    ...(showBranch
      ? [{
          key: 'organization',
          label: 'Branch',
          render: (_, row) => row.organization.name,
        } satisfies TableColumn<PayslipTableRow>]
      : []),
    {
      key: 'payPeriod',
      label: 'Period',
      render: (value) => <span className="text-stone-700">{formatPayPeriod(String(value))}</span>,
    },
    {
      key: 'grossPay',
      label: 'Gross',
      render: (value) => <span className="font-medium text-stone-700">{formatCurrency(String(value))}</span>,
      className: 'whitespace-nowrap',
    },
    {
      key: 'totalDeductions',
      label: 'Deductions',
      render: (value) => <span className="font-medium text-stone-700">{formatCurrency(String(value))}</span>,
      className: 'whitespace-nowrap',
    },
    {
      key: 'netPay',
      label: 'Net Pay',
      render: (value) => <span className="font-semibold text-espresso">{formatCurrency(String(value))}</span>,
      className: 'whitespace-nowrap',
    },
    {
      key: 'isLocked',
      label: 'Status',
      render: (value) => <PayslipStatusBadge isLocked={Boolean(value)} />,
    },
    {
      key: 'actions',
      label: '',
      className: 'w-[220px]',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" leftIcon={<Eye size={14} />} onClick={() => onView(row)}>
            View
          </Button>
          {canEdit && !row.isLocked && onEdit ? (
            <Button variant="secondary" size="sm" leftIcon={<Pencil size={14} />} onClick={() => onEdit(row)}>
              Edit
            </Button>
          ) : null}
          {canLock && !row.isLocked && onLock ? (
            <Button size="sm" leftIcon={<Lock size={14} />} onClick={() => onLock(row)}>
              Lock
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const rows = payslips.map((payslip) => ({ ...payslip, staffName: payslip.user.name }));

  return (
    <Table
      columns={columns}
      data={rows}
      keyField="id"
      emptyState={(
        <EmptyState
          icon={<Eye size={22} />}
          heading={emptyHeading}
          body={emptyBody}
          className="py-16"
        />
      )}
    />
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Input, Modal, Select, type SelectOption } from '@/components/ui';
import type { StaffDto } from '@/services/staffService';
import type { AppRole } from '@/types/auth';
import type { Payslip, PayslipCreateInput, PayslipLineItem } from '@/types/payslip';
import { computePayslipTotals, formatCurrency, formatPayPeriod, toEditableInput } from './payslip-utils';

interface PayslipFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: PayslipCreateInput) => Promise<void>;
  isSubmitting: boolean;
  staffOptions: StaffDto[];
  initialPayslip?: Payslip | null;
}

const emptyInput: PayslipCreateInput = {
  userId: '',
  payPeriod: '',
  payDate: '',
  basicSalary: '0',
  houseAllowance: '',
  transportAllowance: '',
  otherAllowances: [],
  paye: '0',
  nssf: '0',
  housingLevy: '0',
  helb: '',
  otherDeductions: [],
};

const EXCLUDED_STAFF_ROLES = new Set<AppRole>(['KITCHEN_DISPLAY', 'BARISTA_DISPLAY']);

const formatRoleLabel = (role: AppRole): string =>
  role
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatStaffGroupLabel = (staff: StaffDto): string =>
  `${staff.organizationName ?? 'Branch'} - ${formatRoleLabel(staff.role)}`;

const staffToOptions = (staffMembers: StaffDto[]): SelectOption[] =>
  [...staffMembers]
    .filter((staff) => staff.isActive && !!staff.organizationId && !EXCLUDED_STAFF_ROLES.has(staff.role))
    .sort((left, right) => {
      const branchCompare = (left.organizationName ?? '').localeCompare(right.organizationName ?? '');
      if (branchCompare !== 0) return branchCompare;
      const roleCompare = formatRoleLabel(left.role).localeCompare(formatRoleLabel(right.role));
      if (roleCompare !== 0) return roleCompare;
      return left.name.localeCompare(right.name);
    })
    .map((staff) => ({
      value: staff.id,
      label: staff.name,
      group: formatStaffGroupLabel(staff),
    }));

const normalizeItems = (items: PayslipLineItem[]): PayslipLineItem[] =>
  items
    .map((item) => ({
      label: item.label.trim(),
      amount: item.amount.trim() === '' ? '0' : item.amount.trim(),
    }))
    .filter((item) => item.label.length > 0 || Number(item.amount) !== 0);

export function PayslipFormModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  staffOptions,
  initialPayslip,
}: PayslipFormModalProps): JSX.Element {
  const [form, setForm] = useState<PayslipCreateInput>(emptyInput);

  useEffect(() => {
    if (!isOpen) return;
    setForm(initialPayslip ? toEditableInput(initialPayslip) : { ...emptyInput });
  }, [initialPayslip, isOpen]);

  const totals = useMemo(() => computePayslipTotals(form), [form]);

  const employeeOptions = staffToOptions(staffOptions);

  const updateField = <K extends keyof PayslipCreateInput>(key: K, value: PayslipCreateInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateLineItem = (
    key: 'otherAllowances' | 'otherDeductions',
    index: number,
    field: keyof PayslipLineItem,
    value: string,
  ) => {
    setForm((current) => {
      const items = [...(current[key] ?? [])];
      items[index] = { ...items[index], [field]: value };
      return { ...current, [key]: items };
    });
  };

  const addLineItem = (key: 'otherAllowances' | 'otherDeductions') => {
    setForm((current) => ({
      ...current,
      [key]: [...(current[key] ?? []), { label: '', amount: '0' }],
    }));
  };

  const removeLineItem = (key: 'otherAllowances' | 'otherDeductions', index: number) => {
    setForm((current) => ({
      ...current,
      [key]: (current[key] ?? []).filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const handleSubmit = async () => {
    await onSubmit({
      ...form,
      houseAllowance: form.houseAllowance?.trim() ? form.houseAllowance : null,
      transportAllowance: form.transportAllowance?.trim() ? form.transportAllowance : null,
      helb: form.helb?.trim() ? form.helb : null,
      otherAllowances: normalizeItems(form.otherAllowances ?? []),
      otherDeductions: normalizeItems(form.otherDeductions ?? []),
    });
  };

  const title = initialPayslip ? `Edit ${initialPayslip.user.name}` : 'Add payslip';

  const footer = (
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
      <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
      <Button onClick={() => void handleSubmit()} isLoading={isSubmitting} disabled={!form.userId || !form.payPeriod || !form.payDate}>
        {initialPayslip ? 'Save changes' : 'Create payslip'}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="lg"
      className="max-w-5xl rounded-[24px]"
      footer={footer}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_320px]">
        <div className="space-y-6">
          <section className="rounded-[20px] border border-stone-200 bg-[#FAF7F2] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Identity</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Select
                label="Staff member"
                value={form.userId}
                onChange={(event) => updateField('userId', event.target.value)}
                options={employeeOptions}
                placeholder="Select staff member"
              />
              <Input
                label="Pay period"
                type="month"
                value={form.payPeriod}
                onChange={(event) => updateField('payPeriod', event.target.value)}
              />
              <Input
                label="Pay date"
                type="date"
                value={form.payDate}
                onChange={(event) => updateField('payDate', event.target.value)}
              />
            </div>
          </section>

          <section className="rounded-[20px] border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Earnings</p>
              <Button variant="ghost" size="sm" leftIcon={<Plus size={14} />} onClick={() => addLineItem('otherAllowances')}>
                Add allowance
              </Button>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Input label="Basic salary" prefix="KES" value={form.basicSalary} onChange={(event) => updateField('basicSalary', event.target.value)} />
              <Input label="House allowance" helperText="Leave blank to remove this allowance." prefix="KES" value={form.houseAllowance ?? ''} onChange={(event) => updateField('houseAllowance', event.target.value)} />
              <Input label="Transport allowance" helperText="Leave blank to remove this allowance." prefix="KES" value={form.transportAllowance ?? ''} onChange={(event) => updateField('transportAllowance', event.target.value)} />
            </div>
            <div className="mt-4 space-y-3">
              {(form.otherAllowances ?? []).map((item, index) => (
                <div key={`allowance-${index}`} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
                  <Input label={index === 0 ? 'Allowance label' : undefined} value={item.label} onChange={(event) => updateLineItem('otherAllowances', index, 'label', event.target.value)} />
                  <Input label={index === 0 ? 'Amount' : undefined} prefix="KES" value={item.amount} onChange={(event) => updateLineItem('otherAllowances', index, 'amount', event.target.value)} />
                  <div className="flex items-end">
                    <Button variant="ghost" size="sm" leftIcon={<Trash2 size={14} />} onClick={() => removeLineItem('otherAllowances', index)}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[20px] border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Deductions</p>
              <Button variant="ghost" size="sm" leftIcon={<Plus size={14} />} onClick={() => addLineItem('otherDeductions')}>
                Add deduction
              </Button>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Input label="PAYE" prefix="KES" value={form.paye} onChange={(event) => updateField('paye', event.target.value)} />
              <Input label="SHA" prefix="KES" value={form.nssf} onChange={(event) => updateField('nssf', event.target.value)} />
              <Input label="Housing levy" prefix="KES" value={form.housingLevy} onChange={(event) => updateField('housingLevy', event.target.value)} />
              <Input label="HELB" helperText="Leave blank to remove this deduction." prefix="KES" value={form.helb ?? ''} onChange={(event) => updateField('helb', event.target.value)} />
            </div>
            <div className="mt-4 space-y-3">
              {(form.otherDeductions ?? []).map((item, index) => (
                <div key={`deduction-${index}`} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
                  <Input label={index === 0 ? 'Deduction label' : undefined} value={item.label} onChange={(event) => updateLineItem('otherDeductions', index, 'label', event.target.value)} />
                  <Input label={index === 0 ? 'Amount' : undefined} prefix="KES" value={item.amount} onChange={(event) => updateLineItem('otherDeductions', index, 'amount', event.target.value)} />
                  <div className="flex items-end">
                    <Button variant="ghost" size="sm" leftIcon={<Trash2 size={14} />} onClick={() => removeLineItem('otherDeductions', index)}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[24px] border border-stone-200 bg-gradient-to-b from-white to-[#F8F3EB] p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Preview</p>
            <div className="mt-4">
              <p className="font-display text-display-sm font-semibold text-espresso">
                {formatCurrency(totals.netPay)}
              </p>
              <p className="mt-2 text-body-sm text-stone-500">
                Net pay
                {form.payPeriod ? ` - ${formatPayPeriod(form.payPeriod)}` : ''}
              </p>
            </div>
            <div className="mt-5 space-y-3 border-t border-stone-200 pt-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-body-sm text-stone-600">Gross pay</span>
                <span className="text-body-sm font-semibold text-stone-900">{formatCurrency(totals.grossPay)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-body-sm text-stone-600">Total deductions</span>
                <span className="text-body-sm font-semibold text-stone-900">{formatCurrency(totals.totalDeductions)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-stone-200 pt-3">
                <span className="text-body-sm font-semibold text-stone-900">Net pay</span>
                <span className="font-display text-heading-lg font-semibold text-espresso">{formatCurrency(totals.netPay)}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </Modal>
  );
}

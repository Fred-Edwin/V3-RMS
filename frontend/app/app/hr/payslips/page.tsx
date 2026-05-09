'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, Input, PageHeader, PageLayout, Select, SkeletonTable } from '@/components/ui';
import { PayslipDetailModal } from '@/components/payslips/PayslipDetailModal';
import { PayslipFormModal } from '@/components/payslips/PayslipFormModal';
import { PayslipTable } from '@/components/payslips/PayslipTable';
import { useToast } from '@/hooks/useToast';
import { branchService, type BranchDto } from '@/services/branchService';
import { payslipService } from '@/services/payslipService';
import { staffService, type StaffDto } from '@/services/staffService';
import { useAuthStore } from '@/store/authStore';
import type { AppRole } from '@/types/auth';
import type { Payslip, PayslipCreateInput } from '@/types/payslip';

const EXCLUDED_STAFF_ROLES = new Set<AppRole>(['KITCHEN_DISPLAY', 'BARISTA_DISPLAY']);

const formatRoleLabel = (role: AppRole): string =>
  role
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatStaffGroupLabel = (staff: StaffDto): string =>
  `${staff.organizationName ?? 'Branch'} - ${formatRoleLabel(staff.role)}`;

export default function HrPayslipsPage(): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffDto[]>([]);
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [editingPayslip, setEditingPayslip] = useState<Payslip | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPayPeriod, setSelectedPayPeriod] = useState('');

  const loadReferenceData = useCallback(async () => {
    if (!accessToken) return;
    const [branchRows, staffRows] = await Promise.all([
      branchService.listBranches(accessToken),
      staffService.listStaff(accessToken, { isActive: true }),
    ]);
    setBranches(branchRows.filter((branch) => branch.isActive && !branch.isHub));
    setStaffMembers(
      staffRows.filter((staff) => staff.isActive && !!staff.organizationId && !EXCLUDED_STAFF_ROLES.has(staff.role)),
    );
  }, [accessToken]);

  const loadPayslips = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const filters = {
        payPeriod: selectedPayPeriod || undefined,
        userId: selectedUserId || undefined,
        isLocked: selectedStatus === '' ? undefined : selectedStatus === 'LOCKED',
        page: 1,
        perPage: 50,
      };

      const result = selectedBranchId
        ? await payslipService.listBranchPayslips(selectedBranchId, accessToken, {
            payPeriod: filters.payPeriod,
            userId: filters.userId,
            page: filters.page,
            perPage: filters.perPage,
          })
        : await payslipService.listHrPayslips(accessToken, filters);

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
  }, [accessToken, selectedBranchId, selectedPayPeriod, selectedStatus, selectedUserId, toast]);

  useEffect(() => {
    void loadReferenceData();
  }, [loadReferenceData]);

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

  const staffOptions = useMemo(
    () => [
      { value: '', label: 'All staff' },
      ...[...staffMembers]
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
        })),
    ],
    [staffMembers],
  );

  const statusOptions = [
    { value: '', label: 'All statuses' },
    { value: 'DRAFT', label: 'Draft' },
    { value: 'LOCKED', label: 'Locked' },
  ];

  const openCreate = () => {
    setEditingPayslip(null);
    setIsFormOpen(true);
  };

  const openEdit = (payslip: Payslip) => {
    setEditingPayslip(payslip);
    setIsFormOpen(true);
  };

  const openDetail = (payslip: Payslip) => {
    setSelectedPayslip(payslip);
    setIsDetailOpen(true);
  };

  const handleSubmit = async (input: PayslipCreateInput) => {
    if (!accessToken) return;
    setIsSubmitting(true);
    try {
      const saved = editingPayslip
        ? await payslipService.updatePayslip(editingPayslip.id, input, accessToken)
        : await payslipService.createPayslip(input, accessToken);

      toast({
        variant: 'success',
        title: editingPayslip ? 'Payslip updated' : 'Payslip created',
        message: `${saved.user.name} - ${saved.payPeriod}`,
      });
      setIsFormOpen(false);
      setEditingPayslip(null);
      await loadPayslips();
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Unable to save payslip',
        message: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLock = async (payslip: Payslip) => {
    if (!accessToken) return;
    try {
      await payslipService.lockPayslip(payslip.id, accessToken);
      toast({
        variant: 'success',
        title: 'Payslip locked',
        message: `${payslip.user.name} - ${payslip.payPeriod}`,
      });
      await loadPayslips();
      if (selectedPayslip?.id === payslip.id) {
        const refreshed = await payslipService.getPayslip(payslip.id, accessToken);
        setSelectedPayslip(refreshed);
      }
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Unable to lock payslip',
        message: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  };

  return (
    <PageLayout className="animate-fade-up space-y-6">
      <PageHeader
        title="Payslips"
        subtitle="Structured payroll visibility across branches, with draft editing and formal print-ready detail."
        titleClassName="font-display text-display-lg font-semibold text-espresso"
        action={(
          <Button leftIcon={<Plus size={16} />} onClick={openCreate}>
            Add payslip
          </Button>
        )}
      />

      <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Input label="Pay period" type="month" value={selectedPayPeriod} onChange={(event) => setSelectedPayPeriod(event.target.value)} />
          <Select label="Branch" value={selectedBranchId} onChange={(event) => setSelectedBranchId(event.target.value)} options={branchOptions} />
          <Select label="Staff member" value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} options={staffOptions} />
          <Select label="Status" value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)} options={statusOptions} />
        </div>
      </section>

      <section className="rounded-[24px] border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-heading-lg font-semibold text-espresso">Payslip ledger</h2>
            <p className="mt-1 text-body-sm text-stone-500">Cross-branch payroll records.</p>
          </div>
        </div>

        {isLoading ? (
          <SkeletonTable rows={6} columns={7} />
        ) : (
          <PayslipTable
            payslips={payslips}
            emptyHeading="No payslips found"
            emptyBody="Adjust the filters or create the first payslip for this pay period."
            showBranch
            canEdit
            canLock
            onView={openDetail}
            onEdit={openEdit}
            onLock={(payslip) => void handleLock(payslip)}
          />
        )}
      </section>

      <PayslipDetailModal
        payslip={selectedPayslip}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />

      <PayslipFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingPayslip(null);
        }}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        staffOptions={staffMembers}
        initialPayslip={editingPayslip}
      />
    </PageLayout>
  );
}

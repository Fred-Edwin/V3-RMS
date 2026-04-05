'use client';

import { useEffect, useState } from 'react';
import { DatePicker, PageHeader, PageLayout, PriceDisplay, Select } from '@/components/ui';
import { OrderHistoryRow } from '@/components/orders/OrderHistoryRow';
import { OrderDetailBottomSheet } from '@/components/orders/OrderDetailBottomSheet';
import { useOrderHistory } from '@/hooks/useOrderHistory';
import { useToast } from '@/hooks/useToast';
import { branchService, type BranchDto } from '@/services/branchService';
import { orderService } from '@/services/orderService';
import { printService } from '@/services/printService';
import { staffService, type StaffDto } from '@/services/staffService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type { AppRole } from '@/types/auth';
import type { OrderDetail, OrderStatus } from '@/types/order';

const statusOptions = [
  { value: '', label: 'All' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const PREP_ROLES: AppRole[] = ['CHEF', 'BARISTA', 'KITCHEN_DISPLAY', 'BARISTA_DISPLAY'];
const WAITER_ROLES: AppRole[] = ['WAITER'];
// Roles that span all branches and must select a branch to scope their query
const CROSS_BRANCH_ROLES: AppRole[] = ['DIRECTOR', 'ACCOUNTANT'];

export default function HistoryPage(): JSX.Element {
  const role = useAuthStore((state) => state.role);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const isCrossBranchRole = Boolean(role && CROSS_BRANCH_ROLES.includes(role));
  const isManagerLevel = role === 'MANAGER' || role === 'DIRECTOR' || role === 'ACCOUNTANT';

  const [status, setStatus] = useState<OrderStatus | undefined>(undefined);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isPrintSubmitting, setIsPrintSubmitting] = useState(false);

  // Branch selector — only for cross-branch roles (DIRECTOR, ACCOUNTANT)
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');

  useEffect(() => {
    if (!isCrossBranchRole || !accessToken) return;
    branchService
      .listBranches(accessToken)
      .then((data) => {
        const active = data.filter((b) => b.isActive && !b.isHub);
        setBranches(active);
        setSelectedBranchId((current) => current || active[0]?.id || '');
      })
      .catch(() => {
        // Non-critical — branch selector just won't populate
      });
  }, [isCrossBranchRole, accessToken]);

  // Staff filter — only loaded and shown for manager-level roles
  const [staffList, setStaffList] = useState<StaffDto[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');

  useEffect(() => {
    if (!isManagerLevel || !accessToken) return;
    staffService
      .listStaff(accessToken, { isActive: true })
      .then((list) => {
        // Exclude display-only roles — they don't place or prep orders
        setStaffList(list.filter((s) => s.role !== 'KITCHEN_DISPLAY' && s.role !== 'BARISTA_DISPLAY' && s.role !== 'SYSTEM_ADMIN' && s.role !== 'DIRECTOR' && s.role !== 'MANAGER' && s.role !== 'ACCOUNTANT'));
      })
      .catch(() => {
        // Non-critical — staff filter just won't populate
      });
  }, [isManagerLevel, accessToken]);

  const selectedStaff = staffList.find((s) => s.id === selectedStaffId);
  const createdById = selectedStaff && WAITER_ROLES.includes(selectedStaff.role) ? selectedStaff.id : undefined;
  const prepTicketClaimedById = selectedStaff && PREP_ROLES.includes(selectedStaff.role) ? selectedStaff.id : undefined;

  const staffOptions = [
    { value: '', label: 'All Staff' },
    ...staffList.map((s) => ({ value: s.id, label: `${s.name} (${s.role.charAt(0) + s.role.slice(1).toLowerCase()})` })),
  ];

  const branchOptions = branches.map((b) => ({ value: b.id, label: b.name }));

  const { orders, pagination, isLoading, error, totalValue } = useOrderHistory({
    status,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page,
    createdById,
    prepTicketClaimedById,
    branchId: isCrossBranchRole ? (selectedBranchId || undefined) : undefined,
  });

  const isManager = role === 'MANAGER' || role === 'DIRECTOR' || role === 'ACCOUNTANT';
  const isOwner = Boolean(selectedOrder && userId && selectedOrder.createdBy.id === userId);

  const handlePrintReceipt = async (orderId: string) => {
    if (!accessToken || isPrintSubmitting) return;
    setIsPrintSubmitting(true);
    try {
      await printService.createPrintJob(orderId, accessToken);
      toast({ variant: 'success', title: 'Receipt sent to printer' });
    } catch (error) {
      const message =
        error instanceof ApiError && error.statusCode === 404
          ? 'No printer configured for this branch'
          : error instanceof ApiError
            ? error.message
            : 'Unable to send to printer.';
      toast({ variant: 'error', title: 'Print failed', message });
    } finally {
      setIsPrintSubmitting(false);
    }
  };

  const openOrder = async (orderId: string) => {
    if (!accessToken) return;
    // For cross-branch roles pass the selected branchId so the backend can resolve the org scope
    const branchIdParam = isCrossBranchRole ? selectedBranchId : undefined;
    try {
      const detail = await orderService.getById(orderId, accessToken, branchIdParam);
      setSelectedOrder(detail);
      setIsDetailOpen(true);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to load order details.';
      toast({ variant: 'error', title: message });
    }
  };

  // Grid columns: cross-branch roles show branch + staff selectors = 5 cols;
  // manager/director without cross-branch = 4 cols; others = 3 cols
  const filterGridCols = isCrossBranchRole
    ? 'md:grid-cols-5'
    : isManagerLevel
      ? 'md:grid-cols-4'
      : 'md:grid-cols-3';

  return (
    <PageLayout className="space-y-4">
      <PageHeader title="History" subtitle="Review completed and cancelled orders" />

      {/* Filters */}
      <div className={`grid grid-cols-1 gap-3 rounded-xl border border-stone-200 bg-white p-3 ${filterGridCols}`}>
        <DatePicker label="Start Date" value={startDate} onChange={(v) => { setStartDate(v); setPage(1); }} />
        <DatePicker label="End Date" value={endDate} onChange={(v) => { setEndDate(v); setPage(1); }} />
        <Select
          label="Status"
          options={statusOptions}
          value={status ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            setStatus(v ? (v as OrderStatus) : undefined);
            setPage(1);
          }}
        />
        {isCrossBranchRole && (
          <Select
            label="Branch"
            options={branchOptions}
            value={selectedBranchId}
            onChange={(e) => {
              setSelectedBranchId(e.target.value);
              setPage(1);
            }}
          />
        )}
        {isManagerLevel && (
          <Select
            label="Staff"
            options={staffOptions}
            value={selectedStaffId}
            onChange={(e) => {
              setSelectedStaffId(e.target.value);
              setPage(1);
            }}
          />
        )}
      </div>

      {/* Summary bar */}
      <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3">
        <p className="text-body-sm text-stone-600">
          <span className="font-semibold text-stone-900">{pagination.total}</span> orders
        </p>
        <PriceDisplay amount={totalValue} />
      </div>

      {/* Order list */}
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        {/* Desktop header */}
        <div className="hidden grid-cols-[80px_100px_90px_1fr_1fr_100px_80px] gap-3 border-b border-stone-200 px-3 py-2 text-label-sm font-medium text-stone-500 md:grid">
          <span>Order</span>
          <span>Date</span>
          <span>Type</span>
          <span>Placed By</span>
          <span>Prep Staff</span>
          <span>Total</span>
          <span>Status</span>
        </div>

        {isLoading && (
          <div className="space-y-0 divide-y divide-stone-100">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 animate-pulse bg-stone-50 px-3 py-3" />
            ))}
          </div>
        )}

        {error && (
          <p className="px-4 py-6 text-body-sm text-red-600">{error}</p>
        )}

        {!isLoading && !error && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-stone-100">
              <span className="text-2xl">📋</span>
            </div>
            <p className="text-body-md font-medium text-stone-700">No orders found</p>
            <p className="mt-1 text-body-sm text-stone-400">
              Try adjusting the date range or status filter.
            </p>
          </div>
        )}

        {!isLoading && orders.map((order) => (
          <OrderHistoryRow
            key={order.id}
            order={order}
            onTap={() => void openOrder(order.id)}
          />
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-body-sm text-stone-700 disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Previous
        </button>
        <span className="text-body-sm text-stone-500">
          Page {pagination.page} of {pagination.totalPages}
        </span>
        <button
          type="button"
          className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-body-sm text-stone-700 disabled:opacity-40"
          disabled={page >= pagination.totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>

      <OrderDetailBottomSheet
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedOrder(null);
        }}
        order={selectedOrder}
        onEdit={() => {/* read-only in history */}}
        onPayment={() => {/* read-only in history */}}
        onPrintReceipt={(orderId) => void handlePrintReceipt(orderId)}
        isPrintSubmitting={isPrintSubmitting}
        isOwner={isOwner}
        isManager={isManager}
      />
    </PageLayout>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SlidersHorizontal, Check } from 'lucide-react';
import { CancelOrderSheet } from '@/components/orders/CancelOrderSheet';
import { ManagerOrderEditSheet } from '@/components/orders/ManagerOrderEditSheet';
import { OrderDetailBottomSheet } from '@/components/orders/OrderDetailBottomSheet';
import { useActiveOrders } from '@/hooks/useActiveOrders';
import { getSocket } from '@/lib/socket';
import { env } from '@/lib/env';
import { corporateAccountService, type CorporateAccountDropdownItem } from '@/services/corporateAccountService';
import { customerCreditService, type CustomerCreditDropdownItem } from '@/services/customerCreditService';
import { houseAccountService, type HouseAccountDropdownItem } from '@/services/houseAccountService';
import { houseAccountAuthService } from '@/services/houseAccountAuthService';
import { staffDiscountAuthService } from '@/services/staffDiscountAuthService';
import { customerDiscountAuthService } from '@/services/customerDiscountAuthService';
import { discountService } from '@/services/discountService';
import { orderService } from '@/services/orderService';
import { printService } from '@/services/printService';
import { useAuthStore } from '@/store/authStore';
import { useOrderStore } from '@/store/orderStore';
import { useToast } from '@/hooks/useToast';
import { BottomSheet, IconButton, OrderCard, PageHeader, PageLayout } from '@/components/ui';
import { ApiError } from '@/types/api';
import type { OrderDetail, OrderStatus, OrderType, SplitPaymentLine } from '@/types/order';
import type { Discount } from '@/types/discount';
import type { AddSplitLinePayload, PaymentPayload } from '@/components/orders/OrderDetailBottomSheet';

export const dynamic = 'force-dynamic';

const statusOptions: Array<{ value: 'ALL' | OrderStatus; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'READY', label: 'Ready' },
  { value: 'AWAITING_AUTHORIZATION', label: 'Auth Pending' },
  { value: 'AWAITING_CANCELLATION_APPROVAL', label: 'Cancel Pending' },
];

const typeOptions: Array<{ value: 'ALL' | OrderType; label: string }> = [
  { value: 'ALL', label: 'All types' },
  { value: 'DINE_IN', label: 'Dine-In' },
  { value: 'TAKE_AWAY', label: 'Takeaway' },
  { value: 'DELIVERY', label: 'Delivery' },
];

const parseStatusFilter = (value: string | null): 'ALL' | OrderStatus => {
  if (!value || value === 'ALL') return 'ALL';
  const allowed: OrderStatus[] = ['PENDING', 'IN_PROGRESS', 'READY', 'AWAITING_AUTHORIZATION', 'AWAITING_CANCELLATION_APPROVAL', 'CLOSED', 'CANCELLED'];
  return allowed.includes(value as OrderStatus) ? (value as OrderStatus) : 'ALL';
};

const parseTypeFilter = (value: string | null): 'ALL' | OrderType => {
  if (!value || value === 'ALL') return 'ALL';
  const allowed: OrderType[] = ['DINE_IN', 'TAKE_AWAY', 'DELIVERY'];
  return allowed.includes(value as OrderType) ? (value as OrderType) : 'ALL';
};

export default function OrdersPage(): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const role = useAuthStore((state) => state.role);
  const { activeOrders, isLoading, error } = useActiveOrders();
  const updateOrderRealTime = useOrderStore((state) => state.updateOrderRealTime);
  const removeOrderFromActive = useOrderStore((state) => state.removeOrderFromActive);

  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [houseAccounts, setHouseAccounts] = useState<HouseAccountDropdownItem[]>([]);
  const [corporateAccounts, setCorporateAccounts] = useState<CorporateAccountDropdownItem[]>([]);
  const [customerCreditAccounts, setCustomerCreditAccounts] = useState<CustomerCreditDropdownItem[]>([]);
  const [isTypeFilterOpen, setIsTypeFilterOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false);
  const [isCancelSubmitting, setIsCancelSubmitting] = useState(false);
  const [isPrintBillSubmitting, setIsPrintBillSubmitting] = useState(false);
  const [isPrintSubmitting, setIsPrintSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | OrderType>('ALL');
  const [isManagerEditOpen, setIsManagerEditOpen] = useState(false);
  const [isManagerEditSubmitting, setIsManagerEditSubmitting] = useState(false);
  const [pendingAuthRequestId, setPendingAuthRequestId] = useState<string | null>(null);
  const [pendingAuthHolderName, setPendingAuthHolderName] = useState<string | null>(null);
  const [pendingAuthExpiresAt, setPendingAuthExpiresAt] = useState<string | null>(null);
  const [isAuthOverrideSubmitting, setIsAuthOverrideSubmitting] = useState(false);
  const [pendingStaffDiscountRequestId, setPendingStaffDiscountRequestId] = useState<string | null>(null);
  const [isStaffDiscountOverrideSubmitting, setIsStaffDiscountOverrideSubmitting] = useState(false);
  const [isStaffDiscountRequestSubmitting, setIsStaffDiscountRequestSubmitting] = useState(false);
  const [isStaffDiscountWithdrawSubmitting, setIsStaffDiscountWithdrawSubmitting] = useState(false);
  const [availableDiscounts, setAvailableDiscounts] = useState<Discount[]>([]);
  const [pendingCustomerDiscountRequestId, setPendingCustomerDiscountRequestId] = useState<string | null>(null);
  const [pendingCustomerDiscountName, setPendingCustomerDiscountName] = useState<string | null>(null);
  const [isCustomerDiscountOverrideSubmitting, setIsCustomerDiscountOverrideSubmitting] = useState(false);

  const syncFiltersFromUrl = useCallback(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setStatusFilter(parseStatusFilter(params.get('status')));
    setTypeFilter(parseTypeFilter(params.get('type')));
  }, []);

  useEffect(() => {
    syncFiltersFromUrl();
    window.addEventListener('popstate', syncFiltersFromUrl);
    return () => window.removeEventListener('popstate', syncFiltersFromUrl);
  }, [syncFiltersFromUrl]);

  useEffect(() => {
    if (!accessToken) return;
    void discountService.list(accessToken).then(setAvailableDiscounts).catch(() => { /* non-critical */ });
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || !env.creditAccounts) return;
    void houseAccountService.listActive(accessToken).then((data) => {
      setHouseAccounts(data);
    }).catch(() => { /* non-critical */ });
    void corporateAccountService.list(accessToken).then((data) => {
      setCorporateAccounts(
        (data as CorporateAccountDropdownItem[]).filter((a) => (a as { isActive?: boolean }).isActive !== false),
      );
    }).catch(() => { /* non-critical */ });
    void customerCreditService.list(accessToken).then((data) => {
      setCustomerCreditAccounts(
        (data as CustomerCreditDropdownItem[]).filter((a) => (a as { isActive?: boolean }).isActive !== false),
      );
    }).catch(() => { /* non-critical */ });
  }, [accessToken]);

  const sortedOrders = useMemo(
    () => [...activeOrders].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [activeOrders],
  );

  const typeFilteredOrders = useMemo(() => {
    if (typeFilter === 'ALL') return sortedOrders;
    return sortedOrders.filter((order) => order.type === typeFilter);
  }, [sortedOrders, typeFilter]);

  const statusCounts = useMemo(() => ({
    ALL: typeFilteredOrders.length,
    PENDING: typeFilteredOrders.filter((o) => o.status === 'PENDING').length,
    IN_PROGRESS: typeFilteredOrders.filter((o) => o.status === 'IN_PROGRESS').length,
    READY: typeFilteredOrders.filter((o) => o.status === 'READY').length,
    AWAITING_AUTHORIZATION: typeFilteredOrders.filter((o) => o.status === 'AWAITING_AUTHORIZATION').length,
    AWAITING_CANCELLATION_APPROVAL: typeFilteredOrders.filter((o) => o.status === 'AWAITING_CANCELLATION_APPROVAL').length,
  }), [typeFilteredOrders]);

  const typeCounts = useMemo(() => ({
    ALL: sortedOrders.length,
    DINE_IN: sortedOrders.filter((o) => o.type === 'DINE_IN').length,
    TAKE_AWAY: sortedOrders.filter((o) => o.type === 'TAKE_AWAY').length,
    DELIVERY: sortedOrders.filter((o) => o.type === 'DELIVERY').length,
  }), [sortedOrders]);

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'ALL') return typeFilteredOrders;
    return typeFilteredOrders.filter((order) => order.status === statusFilter);
  }, [statusFilter, typeFilteredOrders]);

  const updateQueryParam = useCallback(
    (key: 'status' | 'type', value: string) => {
      const nextParams = new URLSearchParams(
        typeof window === 'undefined' ? '' : window.location.search,
      );
      if (value === 'ALL') {
        nextParams.delete(key);
      } else {
        nextParams.set(key, value);
      }
      const qs = nextParams.toString();
      router.replace(qs.length > 0 ? `${pathname}?${qs}` : pathname, { scroll: false });
      if (key === 'status') {
        setStatusFilter(parseStatusFilter(value));
      } else {
        setTypeFilter(parseTypeFilter(value));
        setIsTypeFilterOpen(false);
      }
    },
    [pathname, router],
  );

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handleAllReady = (payload: { dailyNumber: number }) => {
      setBannerMessage(`Order #${payload.dailyNumber} is ready!`);
      setTimeout(() => setBannerMessage(null), 5000);
    };
    socket.on('order:all_ready', handleAllReady);
    return () => { socket.off('order:all_ready', handleAllReady); };
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handleDiscountResolved = (payload: { orderId: string; dailyNumber: number; approved: boolean; discountedTotal?: string }) => {
      updateOrderRealTime(payload.orderId, { status: 'READY' });
      setSelectedOrder((prev) => {
        if (!prev || prev.id !== payload.orderId) return prev;
        return {
          ...prev,
          status: 'READY',
          ...(payload.approved && payload.discountedTotal ? { total: payload.discountedTotal } : {}),
        };
      });
      setPendingStaffDiscountRequestId(null);
      if (payload.approved) {
        toast({ variant: 'success', title: `Order #${payload.dailyNumber} discount approved`, message: `Discounted total: ${payload.discountedTotal ?? ''}` });
      } else {
        toast({ variant: 'info', title: `Order #${payload.dailyNumber} discount rejected`, message: 'Order is ready at full price.' });
      }
    };
    socket.on('order:staff_discount_resolved', handleDiscountResolved);
    return () => { socket.off('order:staff_discount_resolved', handleDiscountResolved); };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- toast and updateOrderRealTime are stable; no risk of loop
  }, [updateOrderRealTime]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handleCustomerDiscountResolved = (payload: { orderId: string; dailyNumber: number; approved: boolean; discountedTotal?: string }) => {
      updateOrderRealTime(payload.orderId, { status: 'READY' });
      setSelectedOrder((prev) => {
        if (!prev || prev.id !== payload.orderId) return prev;
        return {
          ...prev,
          status: 'READY',
          ...(payload.approved && payload.discountedTotal ? { total: payload.discountedTotal } : {}),
        };
      });
      setPendingCustomerDiscountRequestId(null);
      setPendingCustomerDiscountName(null);
      if (payload.approved) {
        toast({ variant: 'success', title: `Order #${payload.dailyNumber} discount approved`, message: `Discounted total: ${payload.discountedTotal ?? ''}` });
      } else {
        toast({ variant: 'info', title: `Order #${payload.dailyNumber} discount rejected`, message: 'Order is ready at full price.' });
      }
    };
    socket.on('order:customer_discount_resolved', handleCustomerDiscountResolved);
    return () => { socket.off('order:customer_discount_resolved', handleCustomerDiscountResolved); };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- toast and updateOrderRealTime are stable; no risk of loop
  }, [updateOrderRealTime]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handleCancellationPending = (payload: { orderId: string; dailyNumber: number }) => {
      updateOrderRealTime(payload.orderId, { status: 'AWAITING_CANCELLATION_APPROVAL' });
      setSelectedOrder((prev) => (prev && prev.id === payload.orderId ? { ...prev, status: 'AWAITING_CANCELLATION_APPROVAL' } : prev));
      toast({ variant: 'info', title: `Order #${payload.dailyNumber} cancellation pending`, message: 'A manager or director must approve it.' });
    };
    const handleCancellationResolved = (payload: { orderId: string; dailyNumber: number; approved: boolean; restoredStatus?: string }) => {
      if (payload.approved) {
        removeOrderFromActive(payload.orderId);
        setSelectedOrder((prev) => (prev && prev.id === payload.orderId ? { ...prev, status: 'CANCELLED' } : prev));
        toast({ variant: 'success', title: `Order #${payload.dailyNumber} cancelled` });
      } else {
        const restoredStatus: OrderStatus =
          payload.restoredStatus === 'PENDING' || payload.restoredStatus === 'IN_PROGRESS' || payload.restoredStatus === 'READY'
            ? payload.restoredStatus
            : 'IN_PROGRESS';
        updateOrderRealTime(payload.orderId, { status: restoredStatus });
        setSelectedOrder((prev) => (prev && prev.id === payload.orderId ? { ...prev, status: restoredStatus } : prev));
        toast({ variant: 'info', title: `Order #${payload.dailyNumber} cancellation rejected`, message: 'Continue handling the order.' });
      }
    };
    socket.on('order:cancellation_pending', handleCancellationPending);
    socket.on('order:cancellation_resolved', handleCancellationResolved);
    return () => {
      socket.off('order:cancellation_pending', handleCancellationPending);
      socket.off('order:cancellation_resolved', handleCancellationResolved);
    };
  }, [removeOrderFromActive, toast, updateOrderRealTime]);

  const handleOpenOrder = async (orderId: string) => {
    if (!accessToken) return;
    setPendingAuthRequestId(null);
    setPendingAuthHolderName(null);
    setPendingAuthExpiresAt(null);
    setPendingStaffDiscountRequestId(null);
    setPendingCustomerDiscountRequestId(null);
    setPendingCustomerDiscountName(null);
    try {
      const order = await orderService.getById(orderId, accessToken);
      setSelectedOrder(order);
      setIsDetailOpen(true);
      if (order.status === 'AWAITING_AUTHORIZATION') {
        // Try customer discount first (discountId present), then staff discount, then house account
        if (order.discountId) {
          customerDiscountAuthService.getPendingByOrderId(orderId, accessToken)
            .then((auth) => {
              setPendingCustomerDiscountRequestId(auth.id);
              setPendingCustomerDiscountName(auth.discount.name);
            })
            .catch(() => { /* non-critical */ });
        } else {
          staffDiscountAuthService.getPendingByOrderId(orderId, accessToken)
            .then((auth) => {
              setPendingStaffDiscountRequestId(auth.id);
            })
            .catch(() => {
              // Not a staff discount — try house account
              houseAccountAuthService.getPendingByOrderId(orderId, accessToken)
                .then((auth) => {
                  setPendingAuthRequestId(auth.id);
                  setPendingAuthHolderName(auth.houseAccount.user.name);
                  setPendingAuthExpiresAt(auth.expiresAt);
                })
                .catch(() => { /* non-critical */ });
            });
        }
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to load order details.';
      toast({ variant: 'error', title: 'Load failed', message });
    }
  };

  const handlePayment = async (orderId: string, payload: PaymentPayload) => {
    if (!accessToken || isPaymentSubmitting) return;
    setIsPaymentSubmitting(true);
    try {
      const updated = await orderService.recordPayment(orderId, payload, accessToken);
      if (updated.status === 'AWAITING_AUTHORIZATION') {
        updateOrderRealTime(orderId, { status: 'AWAITING_AUTHORIZATION' });
        setSelectedOrder((prev) => (prev ? { ...prev, status: 'AWAITING_AUTHORIZATION' } : prev));
        if (payload.applyStaffDiscount) {
          toast({ variant: 'info', title: 'Discount requested', message: 'A director has been notified to approve the staff discount.' });
        } else if (payload.applyDiscountId) {
          // Customer discount requiring manager approval
          void customerDiscountAuthService.getPendingByOrderId(orderId, accessToken).then((auth) => {
            setPendingCustomerDiscountRequestId(auth.id);
            setPendingCustomerDiscountName(auth.discount.name);
          }).catch(() => { /* non-critical */ });
          const discountName = availableDiscounts.find((d) => d.id === payload.applyDiscountId)?.name ?? 'Discount';
          toast({ variant: 'info', title: 'Discount requested', message: `A manager has been notified to approve the "${discountName}" discount.` });
        } else {
          // House account payment — order is locked pending approval, not closed yet
          toast({ variant: 'info', title: 'Authorization requested', message: 'The account holder has been notified to approve the charge.' });
        }
      } else {
        // Normal payment — order closed
        updateOrderRealTime(orderId, { status: 'CLOSED' });
        toast({ variant: 'success', title: 'Payment recorded. Order closed.' });
        // Keep the sheet open with paid state so Print Receipt button is immediately visible
        setSelectedOrder((prev) => (prev ? { ...prev, paymentMethod: payload.paymentMethod, status: 'CLOSED' } : prev));
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to record payment.';
      toast({ variant: 'error', title: 'Payment failed', message });
    } finally {
      setIsPaymentSubmitting(false);
    }
  };

  const handleAddSplitLine = async (orderId: string, payload: AddSplitLinePayload): Promise<SplitPaymentLine> => {
    if (!accessToken) throw new Error('Not authenticated');
    const line = await orderService.addSplitLine(orderId, payload, accessToken);
    setSelectedOrder((prev) =>
      prev ? { ...prev, splitPaymentLines: [...prev.splitPaymentLines, line] } : prev,
    );
    return line;
  };

  const handleDeleteSplitLine = async (orderId: string, lineId: string): Promise<void> => {
    if (!accessToken) throw new Error('Not authenticated');
    await orderService.deleteSplitLine(orderId, lineId, accessToken);
    setSelectedOrder((prev) =>
      prev ? { ...prev, splitPaymentLines: prev.splitPaymentLines.filter((l) => l.id !== lineId) } : prev,
    );
  };

  const handleOpenCancel = (orderId: string) => {
    setCancelOrderId(orderId);
    setIsDetailOpen(false);
    setIsCancelOpen(true);
  };

  const handleCancelConfirm = async (reason: string, reasonDetail?: string) => {
    if (!accessToken || !cancelOrderId) return;
    setIsCancelSubmitting(true);
    try {
      const updated = await orderService.cancel(cancelOrderId, { reason, reasonDetail }, accessToken);
      if (updated.status === 'AWAITING_CANCELLATION_APPROVAL') {
        updateOrderRealTime(cancelOrderId, { status: 'AWAITING_CANCELLATION_APPROVAL' });
        toast({ variant: 'info', title: 'Cancellation request sent', message: 'A manager or director must approve it.' });
      } else {
        removeOrderFromActive(cancelOrderId);
        toast({ variant: 'success', title: 'Order cancelled' });
      }
      setIsCancelOpen(false);
      setCancelOrderId(null);
      setSelectedOrder((prev) =>
        prev && prev.id === cancelOrderId ? { ...prev, status: updated.status } : prev,
      );
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to cancel order.';
      toast({ variant: 'error', title: 'Cancel failed', message });
    } finally {
      setIsCancelSubmitting(false);
    }
  };

  const handlePrintBill = async (orderId: string, targetStationId: string | null) => {
    if (!accessToken || isPrintBillSubmitting) return;
    setIsPrintBillSubmitting(true);
    try {
      await printService.createPrintJob(orderId, accessToken, 'BILL', targetStationId);
      toast({ variant: 'success', title: 'Bill sent to printer' });
    } catch (error) {
      const message =
        error instanceof ApiError && error.statusCode === 404
          ? 'No printer configured for this branch'
          : error instanceof ApiError
            ? error.message
            : 'Unable to send to printer.';
      toast({ variant: 'error', title: 'Print failed', message });
    } finally {
      setIsPrintBillSubmitting(false);
    }
  };

  const handlePrintReceipt = async (orderId: string, targetStationId: string | null) => {
    if (!accessToken || isPrintSubmitting) return;
    setIsPrintSubmitting(true);
    try {
      await printService.createPrintJob(orderId, accessToken, 'RECEIPT', targetStationId);
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

  const handleManagerEditConfirm = async (orderId: string, removeItemIds: string[], reason: string): Promise<void> => {
    if (!accessToken || isManagerEditSubmitting) return;
    setIsManagerEditSubmitting(true);
    try {
      const updated = await orderService.managerRemoveItems(orderId, { removeItemIds, reason }, accessToken);
      // If the order was cancelled as a result, remove it from active list
      if (updated.status === 'CANCELLED') {
        removeOrderFromActive(orderId);
      } else {
        updateOrderRealTime(orderId, { status: updated.status });
        setSelectedOrder(updated);
      }
      setIsManagerEditOpen(false);
      toast({ variant: 'success', title: 'Order updated' });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to update order.';
      toast({ variant: 'error', title: 'Edit failed', message });
    } finally {
      setIsManagerEditSubmitting(false);
    }
  };

  const handleAuthForceExpire = async (orderId: string) => {
    if (!accessToken || !pendingAuthRequestId || isAuthOverrideSubmitting) return;
    setIsAuthOverrideSubmitting(true);
    try {
      await houseAccountAuthService.forceExpire(pendingAuthRequestId, accessToken);
      updateOrderRealTime(orderId, { status: 'READY' });
      setSelectedOrder((prev) => (prev ? { ...prev, status: 'READY' } : prev));
      setPendingAuthRequestId(null);
      setPendingAuthHolderName(null);
      setPendingAuthExpiresAt(null);
      toast({ variant: 'success', title: 'Order returned to Ready', message: 'The waiter can now collect payment another way.' });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not revert the order.';
      toast({ variant: 'error', title: 'Failed', message });
    } finally {
      setIsAuthOverrideSubmitting(false);
    }
  };

  const handleAuthOverride = async (orderId: string, decision: 'APPROVED' | 'REJECTED') => {
    if (!accessToken || !pendingAuthRequestId || isAuthOverrideSubmitting) return;
    setIsAuthOverrideSubmitting(true);
    try {
      await houseAccountAuthService.override(pendingAuthRequestId, decision, accessToken);
      if (decision === 'APPROVED') {
        removeOrderFromActive(orderId);
        setIsDetailOpen(false);
        toast({ variant: 'success', title: 'Charge approved', message: 'The order has been closed.' });
      } else {
        updateOrderRealTime(orderId, { status: 'READY' });
        setSelectedOrder((prev) => (prev ? { ...prev, status: 'READY' } : prev));
        setPendingAuthRequestId(null);
        setPendingAuthHolderName(null);
        toast({ variant: 'success', title: 'Charge rejected', message: 'Order returned to Ready.' });
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Override failed.';
      toast({ variant: 'error', title: 'Override failed', message });
    } finally {
      setIsAuthOverrideSubmitting(false);
    }
  };

  const handleStaffDiscountOverride = async (orderId: string, decision: 'APPROVED' | 'REJECTED') => {
    if (!accessToken || !pendingStaffDiscountRequestId || isStaffDiscountOverrideSubmitting) return;
    setIsStaffDiscountOverrideSubmitting(true);
    try {
      await staffDiscountAuthService.override(pendingStaffDiscountRequestId, decision, accessToken);
      if (decision === 'APPROVED') {
        // Order returns to READY at discounted total; re-fetch to get updated total
        const updated = await orderService.getById(orderId, accessToken);
        updateOrderRealTime(orderId, { status: 'READY' });
        setSelectedOrder(updated);
        setPendingStaffDiscountRequestId(null);
        toast({ variant: 'success', title: 'Discount approved', message: 'Order returned to Ready at the discounted total.' });
      } else {
        updateOrderRealTime(orderId, { status: 'READY' });
        setSelectedOrder((prev) => (prev ? { ...prev, status: 'READY' } : prev));
        setPendingStaffDiscountRequestId(null);
        toast({ variant: 'success', title: 'Discount rejected', message: 'Order returned to Ready at full price.' });
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Override failed.';
      toast({ variant: 'error', title: 'Override failed', message });
    } finally {
      setIsStaffDiscountOverrideSubmitting(false);
    }
  };

  const handleStaffDiscountRequest = async (orderId: string) => {
    if (!accessToken || isStaffDiscountRequestSubmitting) return;
    setIsStaffDiscountRequestSubmitting(true);
    try {
      // No payment method is collected — the request short-circuits on the backend.
      await orderService.recordPayment(orderId, { paymentMethod: 'CASH', applyStaffDiscount: true }, accessToken);
      updateOrderRealTime(orderId, { status: 'AWAITING_AUTHORIZATION' });
      setSelectedOrder((prev) => (prev ? { ...prev, status: 'AWAITING_AUTHORIZATION' } : prev));
      // Fetch the pending request id so the "Withdraw request" button renders.
      void staffDiscountAuthService.getPendingByOrderId(orderId, accessToken)
        .then((auth) => setPendingStaffDiscountRequestId(auth.id))
        .catch(() => { /* non-critical */ });
      toast({ variant: 'info', title: 'Discount requested', message: 'A director has been notified to approve the staff discount.' });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not request the discount.';
      toast({ variant: 'error', title: 'Request failed', message });
    } finally {
      setIsStaffDiscountRequestSubmitting(false);
    }
  };

  const handleStaffDiscountWithdraw = async (orderId: string) => {
    if (!accessToken || !pendingStaffDiscountRequestId || isStaffDiscountWithdrawSubmitting) return;
    setIsStaffDiscountWithdrawSubmitting(true);
    try {
      await staffDiscountAuthService.withdraw(pendingStaffDiscountRequestId, accessToken);
      updateOrderRealTime(orderId, { status: 'READY' });
      setSelectedOrder((prev) => (prev ? { ...prev, status: 'READY' } : prev));
      setPendingStaffDiscountRequestId(null);
      toast({ variant: 'success', title: 'Request withdrawn', message: 'Order returned to Ready at full price.' });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not withdraw the request.';
      toast({ variant: 'error', title: 'Withdraw failed', message });
    } finally {
      setIsStaffDiscountWithdrawSubmitting(false);
    }
  };

  const handleCustomerDiscountOverride = async (orderId: string, decision: 'APPROVED' | 'REJECTED') => {
    if (!accessToken || !pendingCustomerDiscountRequestId || isCustomerDiscountOverrideSubmitting) return;
    setIsCustomerDiscountOverrideSubmitting(true);
    try {
      await customerDiscountAuthService.override(pendingCustomerDiscountRequestId, decision, accessToken);
      if (decision === 'APPROVED') {
        const updated = await orderService.getById(orderId, accessToken);
        updateOrderRealTime(orderId, { status: 'READY' });
        setSelectedOrder(updated);
        setPendingCustomerDiscountRequestId(null);
        setPendingCustomerDiscountName(null);
        toast({ variant: 'success', title: 'Discount approved', message: 'Order returned to Ready at the discounted total.' });
      } else {
        updateOrderRealTime(orderId, { status: 'READY' });
        setSelectedOrder((prev) => (prev ? { ...prev, status: 'READY' } : prev));
        setPendingCustomerDiscountRequestId(null);
        setPendingCustomerDiscountName(null);
        toast({ variant: 'success', title: 'Discount rejected', message: 'Order returned to Ready at full price.' });
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Override failed.';
      toast({ variant: 'error', title: 'Override failed', message });
    } finally {
      setIsCustomerDiscountOverrideSubmitting(false);
    }
  };

  const handleCreateCustomerCredit = async (name: string, phone: string, creditLimit: string): Promise<string> => {
    if (!accessToken) throw new Error('Not authenticated');
    const account = await customerCreditService.createAccount({ customerName: name, customerPhone: phone, creditLimit }, accessToken);
    setCustomerCreditAccounts((prev) => [
      ...prev,
      { id: account.id, customerName: account.customerName, customerPhone: account.customerPhone, creditLimit: account.creditLimit, currentBalance: account.currentBalance },
    ]);
    return account.id;
  };

  const isOwner = Boolean(selectedOrder && userId && selectedOrder.createdBy.id === userId);
  const isManager = role === 'MANAGER' || role === 'DIRECTOR';

  const myReadyOrderCount = useMemo(() => {
    if (role !== 'WAITER' || !userId) return 0;
    return sortedOrders.filter((o) => o.status === 'READY' && o.createdBy.id === userId).length;
  }, [role, userId, sortedOrders]);

  const typeFilterLabel = typeFilter === 'ALL' ? null : typeOptions.find((o) => o.value === typeFilter)?.label;

  return (
    <PageLayout className="space-y-4">
      <PageHeader
        title="Active Orders"
        subtitle="Live order feed"
        action={
          <div className="relative">
            <IconButton
              icon={<SlidersHorizontal size={18} />}
              label="Filter by type"
              aria-label="Filter by type"
              variant={typeFilter !== 'ALL' ? 'primary' : 'ghost'}
              onClick={() => setIsTypeFilterOpen(true)}
            />
            {typeFilter !== 'ALL' && (
              <span className="absolute -top-1 -right-1 size-2 rounded-full bg-amber pointer-events-none" />
            )}
          </div>
        }
      />

      {/* Ready banner */}
      {bannerMessage && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full border border-[#86EFAC] bg-[#EDFAF1] px-5 py-2 text-body-sm font-medium text-[#1A6B3C] shadow-md">
          {bannerMessage}
        </div>
      )}

      {/* Active type filter indicator */}
      {typeFilterLabel && (
        <div className="flex items-center gap-2">
          <span className="text-caption text-stone-500">Filtered:</span>
          <button
            type="button"
            onClick={() => updateQueryParam('type', 'ALL')}
            className="inline-flex items-center gap-1.5 rounded-full bg-espresso px-3 py-1 text-label-sm text-crema"
          >
            {typeFilterLabel}
            <span className="text-crema/60 leading-none">×</span>
          </button>
        </div>
      )}

      {/* READY-order nudge banner — waiter only */}
      {myReadyOrderCount > 0 && (
        <button
          type="button"
          onClick={() => updateQueryParam('status', 'READY')}
          className="w-full flex items-center gap-3 rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-left transition-colors hover:bg-amber/15"
        >
          <span className="size-2 shrink-0 rounded-full bg-amber" />
          <span className="text-body-sm font-medium text-[#92400E]">
            {myReadyOrderCount === 1
              ? '1 order is ready and awaiting payment'
              : `${myReadyOrderCount} orders are ready and awaiting payment`}
          </span>
          <span className="ml-auto shrink-0 text-caption text-[#92400E]/70">Tap to review →</span>
        </button>
      )}

      {/* Status pill filters — borderless, single scrollable row */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {statusOptions.map((option) => {
          const count = statusCounts[option.value as keyof typeof statusCounts] ?? 0;
          const isActive = statusFilter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => updateQueryParam('status', option.value)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-label-md font-medium transition-colors duration-fast ${
                isActive
                  ? 'bg-espresso text-crema'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {option.label}
              <span className={`ml-1.5 text-label-sm ${isActive ? 'text-crema/70' : 'text-stone-400'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Order list */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-stone-100 animate-pulse" />
          ))}
        </div>
      )}

      {error && <p className="text-body-md text-[#991B1B]">{error}</p>}

      {!isLoading && !error && filteredOrders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="size-14 rounded-full bg-stone-100 flex items-center justify-center mb-4">
            <span className="text-2xl">☕</span>
          </div>
          <p className="text-body-md font-medium text-stone-700">No orders yet</p>
          <p className="text-body-sm text-stone-400 mt-1">
            {statusFilter !== 'ALL' || typeFilter !== 'ALL'
              ? 'Try adjusting the filters above.'
              : 'New orders will appear here in real time.'}
          </p>
        </div>
      )}

      {!isLoading && (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              orderNumber={order.dailyNumber}
              status={order.status}
              type={order.type}
              tableNumber={order.tableNumber ?? undefined}
              startTime={order.createdAt}
              placedBy={order.createdBy.name}
              prepTickets={order.prepTickets}
              hasRejectedTickets={order.prepTickets.some(
                (t) => t.status === 'REJECTED' && !t.rejectedReason?.startsWith('Manager removed:'),
              )}
              onTap={() => void handleOpenOrder(order.id)}
            />
          ))}
        </div>
      )}

      {/* Type filter bottom sheet */}
      <BottomSheet
        isOpen={isTypeFilterOpen}
        onClose={() => setIsTypeFilterOpen(false)}
        title="Filter by type"
      >
        <div className="space-y-2 pb-2">
          {typeOptions.map((option) => {
            const count = typeCounts[option.value as keyof typeof typeCounts] ?? 0;
            const isActive = typeFilter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => updateQueryParam('type', option.value)}
                className={`flex w-full items-center justify-between rounded-xl px-4 py-3.5 transition-colors duration-fast ${
                  isActive
                    ? 'bg-espresso text-crema'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                <span className="text-body-sm font-medium">{option.label}</span>
                <span className="flex items-center gap-2">
                  <span className={`text-label-sm ${isActive ? 'text-crema/70' : 'text-stone-400'}`}>
                    {count}
                  </span>
                  {isActive && <Check size={16} className="text-crema" />}
                </span>
              </button>
            );
          })}
        </div>
      </BottomSheet>

      <OrderDetailBottomSheet
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setIsPaymentSubmitting(false);
        }}
        order={selectedOrder}
        onEdit={(orderId) => {
          if (role === 'MANAGER') {
            setIsDetailOpen(false);
            setIsManagerEditOpen(true);
          } else {
            router.push(`/app/orders/${orderId}/edit`);
          }
        }}
        onPayment={(orderId, payload) => void handlePayment(orderId, payload)}
        onCancel={handleOpenCancel}
        onPrintBill={(orderId, targetStationId) => void handlePrintBill(orderId, targetStationId)}
        onPrintReceipt={(orderId, targetStationId) => void handlePrintReceipt(orderId, targetStationId)}
        isPaymentSubmitting={isPaymentSubmitting}
        isPrintBillSubmitting={isPrintBillSubmitting}
        isPrintSubmitting={isPrintSubmitting}
        isOwner={isOwner}
        isManager={isManager}
        isDirector={role === 'DIRECTOR'}
        houseAccounts={houseAccounts}
        corporateAccounts={corporateAccounts}
        customerCreditAccounts={customerCreditAccounts}
        onCreateCustomerCredit={(name, phone, limit) => handleCreateCustomerCredit(name, phone, limit)}
        onAuthOverride={(orderId, decision) => void handleAuthOverride(orderId, decision)}
        onAuthForceExpire={(orderId) => void handleAuthForceExpire(orderId)}
        isAuthOverrideSubmitting={isAuthOverrideSubmitting}
        pendingAuthRequestId={pendingAuthRequestId ?? undefined}
        pendingAuthHolderName={pendingAuthHolderName ?? undefined}
        pendingAuthExpiresAt={pendingAuthExpiresAt ?? undefined}
        pendingStaffDiscountRequestId={pendingStaffDiscountRequestId ?? undefined}
        onStaffDiscountOverride={(orderId, decision) => void handleStaffDiscountOverride(orderId, decision)}
        isStaffDiscountOverrideSubmitting={isStaffDiscountOverrideSubmitting}
        onStaffDiscountRequest={(orderId) => void handleStaffDiscountRequest(orderId)}
        isStaffDiscountRequestSubmitting={isStaffDiscountRequestSubmitting}
        onStaffDiscountWithdraw={(orderId) => void handleStaffDiscountWithdraw(orderId)}
        isStaffDiscountWithdrawSubmitting={isStaffDiscountWithdrawSubmitting}
        availableDiscounts={availableDiscounts}
        pendingCustomerDiscountRequestId={pendingCustomerDiscountRequestId ?? undefined}
        pendingCustomerDiscountName={pendingCustomerDiscountName ?? undefined}
        onCustomerDiscountOverride={(orderId, decision) => void handleCustomerDiscountOverride(orderId, decision)}
        isCustomerDiscountOverrideSubmitting={isCustomerDiscountOverrideSubmitting}
        onAddSplitLine={(orderId, payload) => handleAddSplitLine(orderId, payload)}
        onDeleteSplitLine={(orderId, lineId) => handleDeleteSplitLine(orderId, lineId)}
      />

      <CancelOrderSheet
        isOpen={isCancelOpen}
        onClose={() => {
          setIsCancelOpen(false);
          setCancelOrderId(null);
        }}
        onConfirm={(reason, reasonDetail) => void handleCancelConfirm(reason, reasonDetail)}
        isSubmitting={isCancelSubmitting}
      />

      <ManagerOrderEditSheet
        isOpen={isManagerEditOpen}
        onClose={() => setIsManagerEditOpen(false)}
        order={selectedOrder}
        onConfirm={(orderId, removeItemIds, reason) => handleManagerEditConfirm(orderId, removeItemIds, reason)}
        isSubmitting={isManagerEditSubmitting}
      />

    </PageLayout>
  );
}

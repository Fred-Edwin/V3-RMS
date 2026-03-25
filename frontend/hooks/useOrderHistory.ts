import { useEffect, useState } from 'react';
import { orderService } from '@/services/orderService';
import { useAuthStore } from '@/store/authStore';
import type { OrderStatus, OrderSummary, PaginationMeta } from '@/types/order';

interface OrderHistoryFilters {
  status?: OrderStatus;
  startDate?: string;
  endDate?: string;
  page: number;
  createdById?: string;
  prepTicketClaimedById?: string;
}

export function useOrderHistory(filters: OrderHistoryFilters) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: filters.page,
    perPage: 20,
    totalPages: 1,
  });
  const [totalValue, setTotalValue] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    let mounted = true;
    setIsLoading(true);
    setError(null);

    orderService
      .getMany(
        {
          status: filters.status,
          startDate: filters.startDate,
          endDate: filters.endDate,
          page: filters.page,
          perPage: 20,
          createdById: filters.createdById,
          prepTicketClaimedById: filters.prepTicketClaimedById,
        },
        accessToken,
      )
      .then((result) => {
        if (!mounted) {
          return;
        }
        setOrders(result.orders);
        setPagination(result.pagination);
        setTotalValue(result.totalValue);
      })
      .catch((historyError) => {
        if (!mounted) {
          return;
        }
        setError(historyError instanceof Error ? historyError.message : 'Failed to load order history');
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [accessToken, filters.createdById, filters.endDate, filters.page, filters.prepTicketClaimedById, filters.startDate, filters.status]);

  return { orders, pagination, isLoading, error, totalValue };
}

import { useEffect, useState } from 'react';
import { prepTicketService } from '@/services/prepTicketService';
import { useAuthStore } from '@/store/authStore';
import type { PaginationMeta, PrepTicketDetail } from '@/types/order';

interface PrepTicketHistoryFilters {
  startDate?: string;
  endDate?: string;
  page: number;
}

export function usePrepTicketHistory(filters: PrepTicketHistoryFilters) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const role = useAuthStore((state) => state.role);
  const [tickets, setTickets] = useState<PrepTicketDetail[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: filters.page,
    perPage: 20,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const canViewPrepHistory =
      role === 'CHEF' ||
      role === 'BARISTA' ||
      role === 'KITCHEN_DISPLAY' ||
      role === 'BARISTA_DISPLAY';

    if (!canViewPrepHistory) {
      setTickets([]);
      setPagination({
        total: 0,
        page: filters.page,
        perPage: 20,
        totalPages: 1,
      });
      setIsLoading(false);
      setError(null);
      return;
    }

    let mounted = true;
    setIsLoading(true);
    setError(null);

    prepTicketService
      .getTickets(
        {
          startDate: filters.startDate,
          endDate: filters.endDate,
          page: filters.page,
          perPage: 20,
        },
        accessToken,
      )
      .then((result) => {
        if (!mounted) {
          return;
        }
        setTickets(result.tickets);
        setPagination(result.pagination);
      })
      .catch((historyError) => {
        if (!mounted) {
          return;
        }
        setError(historyError instanceof Error ? historyError.message : 'Failed to load prep ticket history');
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [accessToken, filters.endDate, filters.page, filters.startDate, role]);

  return { tickets, pagination, isLoading, error };
}

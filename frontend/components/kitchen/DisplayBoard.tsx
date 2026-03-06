'use client';

import { useEffect, useMemo, useState } from 'react';
import { FullscreenLayout, KDSCard, TopBar, Button } from '@/components/ui';
import { usePrepTickets } from '@/hooks/usePrepTickets';
import { useToast } from '@/hooks/useToast';
import { dispatchNotificationEvent } from '@/lib/notifications/dispatcher';
import { env } from '@/lib/env';
import { prepTicketService } from '@/services/prepTicketService';
import { staffService } from '@/services/staffService';
import { useAuthStore } from '@/store/authStore';
import { useKitchenStore } from '@/store/kitchenStore';
import { ApiError } from '@/types/api';
import type { PrepStation, PrepTicketDetail } from '@/types/order';
import { KDSColumn } from './KDSColumn';
import { RejectTicketSheet } from './RejectTicketSheet';

interface DisplayBoardProps {
  station: PrepStation;
}

const roleByStation: Record<PrepStation, 'CHEF' | 'BARISTA'> = {
  KITCHEN: 'CHEF',
  BARISTA: 'BARISTA',
};

export function DisplayBoard({ station }: DisplayBoardProps) {
  const { pendingTickets, inProgressTickets, readyTickets, isLoading, station: activeStation, reload } = usePrepTickets();
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);
  const organizationName = useAuthStore((state) => state.user?.organizationName ?? 'Branch');
  const role = useAuthStore((state) => state.role);
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  const updateTicketRealTime = useKitchenStore((state) => state.updateTicketRealTime);
  const clearReadyTickets = useKitchenStore((state) => state.clearReadyTickets);

  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>(
    typeof navigator !== 'undefined' && navigator.onLine ? 'connected' : 'disconnected',
  );
  const [staffOnShift, setStaffOnShift] = useState<Array<{ id: string; name: string }>>([]);

  const [claimingTicketId, setClaimingTicketId] = useState<string | null>(null);
  const [markingReadyTicketIds, setMarkingReadyTicketIds] = useState<Record<string, boolean>>({});
  const [rejectingTicket, setRejectingTicket] = useState<PrepTicketDetail | null>(null);
  const [isRejectSubmitting, setIsRejectSubmitting] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const loadStaff = async () => {
      try {
        const onShiftStaff = await staffService.listStaff(accessToken, {
          role: roleByStation[station],
          isActive: true,
          onShift: true,
        });

        if (onShiftStaff.length > 0) {
          setStaffOnShift(onShiftStaff.map((entry) => ({ id: entry.id, name: entry.name })));
          return;
        }

        const activeStaff = await staffService.listStaff(accessToken, {
          role: roleByStation[station],
          isActive: true,
        });
        setStaffOnShift(activeStaff.map((entry) => ({ id: entry.id, name: entry.name })));
      } catch {
        setStaffOnShift([]);
      }
    };

    void loadStaff();
  }, [accessToken, station]);

  useEffect(() => {
    const handleOnline = () => setConnectionStatus('connected');
    const handleOffline = () => setConnectionStatus('disconnected');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleClaim = async (ticketId: string, claimedById: string) => {
    if (!accessToken) {
      return;
    }

    setClaimingTicketId(ticketId);

    try {
      const claimedTicket = await prepTicketService.claim(ticketId, claimedById, accessToken);
      updateTicketRealTime(claimedTicket.id, claimedTicket);

      if (env.notificationsV2) {
        dispatchNotificationEvent(
          {
            type: 'order:claimed',
            source: 'local',
            occurredAt: Date.now(),
            payload: {
              orderId: claimedTicket.orderId,
              ticketId: claimedTicket.id,
              station: claimedTicket.station,
              dailyNumber: claimedTicket.orderDailyNumber,
              claimedByName: claimedTicket.claimedBy?.name,
            },
          },
          { role, toast },
        );
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to claim this ticket right now.';
      toast({
        variant: 'warning',
        title: message,
      });
      void reload();
    } finally {
      setClaimingTicketId(null);
    }
  };

  const handlePersonalClaim = (ticketId: string) => {
    if (!currentUserId) {
      toast({
        variant: 'warning',
        title: 'Your session is missing staff details. Please refresh and try again.',
      });
      return;
    }

    if (claimingTicketId === ticketId) {
      return;
    }

    void handleClaim(ticketId, currentUserId);
  };

  const handleMarkReady = async (ticketId: string) => {
    if (!accessToken) {
      return;
    }

    setMarkingReadyTicketIds((current) => ({ ...current, [ticketId]: true }));

    try {
      const readyTicket = await prepTicketService.markReady(ticketId, accessToken);
      updateTicketRealTime(readyTicket.id, readyTicket);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to update ticket status.';
      toast({
        variant: 'warning',
        title: message,
      });
      void reload();
    } finally {
      setMarkingReadyTicketIds((current) => {
        const next = { ...current };
        delete next[ticketId];
        return next;
      });
    }
  };

  const handleReject = async (ticketId: string, reason: string) => {
    if (!accessToken) return;
    setIsRejectSubmitting(true);
    try {
      await prepTicketService.reject(ticketId, reason, accessToken);
      toast({ variant: 'success', title: 'Ticket rejected' });
      setRejectingTicket(null);
      void reload();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to reject ticket.';
      toast({ variant: 'error', title: message });
    } finally {
      setIsRejectSubmitting(false);
    }
  };

  const handleUnclaim = async (ticketId: string) => {
    if (!accessToken) return;
    try {
      await prepTicketService.unclaim(ticketId, accessToken);
      toast({ variant: 'success', title: 'Ticket unclaimed' });
      void reload();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to unclaim ticket.';
      toast({ variant: 'error', title: message });
    }
  };

  // Tablet KDS/BDS: inline ClaimButton, no modal
  const renderTabletTicket = (ticket: PrepTicketDetail) => (
    <KDSCard
      key={ticket.id}
      orderNumber={ticket.orderDailyNumber}
      type={ticket.orderType}
      tableNumber={ticket.tableNumber ?? undefined}
      items={ticket.items}
      specialInstructions={ticket.orderNotes}
      startTime={ticket.createdAt}
      status={ticket.status}
      actionLabel="Mark Ready"
      isActionLoading={
        ticket.status === 'PENDING'
          ? claimingTicketId === ticket.id
          : Boolean(markingReadyTicketIds[ticket.id])
      }
      loadingMessage={ticket.status === 'PENDING' ? 'Claiming ticket...' : 'Marking as ready...'}
      staffOnShift={ticket.status === 'PENDING' ? staffOnShift : undefined}
      onClaim={ticket.status === 'PENDING' ? (staffId) => void handleClaim(ticket.id, staffId) : undefined}
      onAction={() => {
        if (markingReadyTicketIds[ticket.id]) return;
        void handleMarkReady(ticket.id);
      }}
      onReject={() => setRejectingTicket(ticket)}
      onUnclaim={ticket.status === 'IN_PROGRESS' ? () => void handleUnclaim(ticket.id) : undefined}
      claimedAt={ticket.claimedAt}
      className={ticket.status === 'PENDING' ? 'animate-slide-in-top' : undefined}
    />
  );

  // Phone (CHEF / BARISTA personal): direct self-claim flow
  const renderPhoneTicket = (ticket: PrepTicketDetail) => (
    <KDSCard
      key={ticket.id}
      orderNumber={ticket.orderDailyNumber}
      type={ticket.orderType}
      tableNumber={ticket.tableNumber ?? undefined}
      items={ticket.items}
      specialInstructions={ticket.orderNotes}
      startTime={ticket.createdAt}
      status={ticket.status}
      actionLabel={ticket.status === 'PENDING' ? 'Claim' : 'Mark Ready'}
      isActionLoading={
        ticket.status === 'PENDING'
          ? claimingTicketId === ticket.id
          : Boolean(markingReadyTicketIds[ticket.id])
      }
      loadingMessage={ticket.status === 'PENDING' ? 'Claiming ticket...' : 'Marking as ready...'}
      onAction={() => {
        if (ticket.status === 'PENDING') {
          handlePersonalClaim(ticket.id);
          return;
        }
        if (markingReadyTicketIds[ticket.id]) return;
        void handleMarkReady(ticket.id);
      }}
      onReject={() => setRejectingTicket(ticket)}
      onUnclaim={ticket.status === 'IN_PROGRESS' ? () => void handleUnclaim(ticket.id) : undefined}
      claimedAt={ticket.claimedAt}
      className={ticket.status === 'PENDING' ? 'animate-slide-in-top' : undefined}
    />
  );

  const isPersonalRole = role === 'CHEF' || role === 'BARISTA';

  const prioritizedInProgressTickets = useMemo(() => {
    if (!currentUserId) {
      return inProgressTickets;
    }

    return [...inProgressTickets].sort((left, right) => {
      const leftIsMine = left.claimedBy?.id === currentUserId;
      const rightIsMine = right.claimedBy?.id === currentUserId;

      if (leftIsMine === rightIsMine) {
        return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      }

      return leftIsMine ? -1 : 1;
    });
  }, [currentUserId, inProgressTickets]);

  if (activeStation !== station) {
    return null;
  }

  if (isPersonalRole) {
    return (
      <main className="min-h-screen bg-crema p-4">
        <header className="mb-4">
          <h1 className="font-display text-display-lg text-espresso">{station === 'KITCHEN' ? 'Kitchen' : 'Barista'}</h1>
          <p className="text-body-sm text-stone-600">{isLoading ? 'Loading tickets...' : 'Live ticket queue'}</p>
        </header>

        <section>
          <h2 className="mb-2 text-heading-sm font-semibold text-stone-900">Pending</h2>
          <div className="space-y-3">
            {pendingTickets.length === 0 ? (
              <p className="text-body-sm text-stone-500">No pending tickets.</p>
            ) : (
              pendingTickets.map((ticket) => renderPhoneTicket(ticket))
            )}
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-heading-sm font-semibold text-stone-900">In Progress</h2>
            {currentUserId && prioritizedInProgressTickets.some((ticket) => ticket.claimedBy?.id === currentUserId) ? (
              <span className="text-caption text-stone-500">Your tickets appear first</span>
            ) : null}
          </div>
          <div className="space-y-3">
            {prioritizedInProgressTickets.length === 0 ? (
              <p className="text-body-sm text-stone-500">No in-progress tickets.</p>
            ) : (
              prioritizedInProgressTickets.map((ticket) => renderPhoneTicket(ticket))
            )}
          </div>
        </section>

        <section className="mt-6">
          <h2 className="mb-2 text-heading-sm font-semibold text-stone-900">Ready</h2>
          <div className="space-y-3">
            {readyTickets.length === 0 ? (
              <p className="text-body-sm text-stone-500">No ready tickets.</p>
            ) : (
              readyTickets.map((ticket) => renderPhoneTicket(ticket))
            )}
          </div>
        </section>

        <RejectTicketSheet
          isOpen={Boolean(rejectingTicket)}
          onClose={() => setRejectingTicket(null)}
          onConfirm={(reason) => {
            if (rejectingTicket) void handleReject(rejectingTicket.id, reason);
          }}
          isSubmitting={isRejectSubmitting}
        />
      </main>
    );
  }

  return (
    <FullscreenLayout className="bg-crema">
      <TopBar
        branchName={organizationName ?? 'Branch'}
        stationLabel={station === 'KITCHEN' ? 'Kitchen Display' : 'Barista Display'}
        connectionStatus={connectionStatus}
        tone="light"
      />
      {connectionStatus === 'disconnected' && (
        <div className="bg-[#FDF2F0] px-4 py-2 text-body-sm text-[#9B3A2A]">Offline. Reconnecting...</div>
      )}
      <div className="min-h-0 flex-1 overflow-hidden px-4 pb-4 pt-3 md:px-6 md:pb-6 md:pt-4">
        <div className="grid h-full min-h-0 grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
          <KDSColumn
            title="Pending"
            tickets={pendingTickets}
            emptyMessage="No pending tickets."
            renderTicket={renderTabletTicket}
          />
          <KDSColumn
            title="In Progress"
            tickets={inProgressTickets}
            emptyMessage="No in-progress tickets."
            renderTicket={renderTabletTicket}
          />
          <KDSColumn
            title="Ready"
            tickets={readyTickets}
            emptyMessage="No ready tickets."
            renderTicket={(ticket) => (
              <div key={ticket.id}>
                {renderTabletTicket(ticket)}
                <Button
                  variant="ghost"
                  className="mt-2 w-full"
                  onClick={() => clearReadyTickets(ticket.orderId)}
                >
                  Clear
                </Button>
              </div>
            )}
          />
        </div>
      </div>
      <RejectTicketSheet
        isOpen={Boolean(rejectingTicket)}
        onClose={() => setRejectingTicket(null)}
        onConfirm={(reason) => {
          if (rejectingTicket) void handleReject(rejectingTicket.id, reason);
        }}
        isSubmitting={isRejectSubmitting}
      />
    </FullscreenLayout>
  );
}

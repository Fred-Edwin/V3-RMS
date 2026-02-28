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
import { ClaimTicketSheet } from './ClaimTicketSheet';

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
  const removeOrderTickets = useKitchenStore((state) => state.removeOrderTickets);
  const clearReadyTickets = useKitchenStore((state) => state.clearReadyTickets);

  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>(
    typeof navigator !== 'undefined' && navigator.onLine ? 'connected' : 'disconnected',
  );
  const [staffOnShift, setStaffOnShift] = useState<Array<{ id: string; name: string }>>([]);
  const [isUsingStaffFallback, setIsUsingStaffFallback] = useState(false);

  // Phone-only: tracks which ticket has the claim sheet open
  const [selectedTicket, setSelectedTicket] = useState<PrepTicketDetail | null>(null);

  const [claimingTicketId, setClaimingTicketId] = useState<string | null>(null);
  const [markingReadyTicketIds, setMarkingReadyTicketIds] = useState<Record<string, boolean>>({});

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
          setIsUsingStaffFallback(false);
          return;
        }

        const activeStaff = await staffService.listStaff(accessToken, {
          role: roleByStation[station],
          isActive: true,
        });
        setStaffOnShift(activeStaff.map((entry) => ({ id: entry.id, name: entry.name })));
        setIsUsingStaffFallback(activeStaff.length > 0);
      } catch {
        setStaffOnShift([]);
        setIsUsingStaffFallback(false);
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
      setSelectedTicket(null);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to claim this ticket right now.';
      toast({
        variant: 'warning',
        title: message,
      });
      void reload();
      setSelectedTicket(null);
    } finally {
      setClaimingTicketId(null);
    }
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
      className={ticket.status === 'PENDING' ? 'animate-slide-in-top' : undefined}
    />
  );

  // Phone (CHEF / BARISTA personal): BottomSheet claim flow
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
          if (claimingTicketId === ticket.id) return;
          setSelectedTicket(ticket);
          return;
        }
        if (markingReadyTicketIds[ticket.id]) return;
        void handleMarkReady(ticket.id);
      }}
      className={ticket.status === 'PENDING' ? 'animate-slide-in-top' : undefined}
    />
  );

  const isPersonalRole = role === 'CHEF' || role === 'BARISTA';

  const myInProgressTickets = useMemo(
    () => inProgressTickets.filter((ticket) => ticket.claimedBy?.id === currentUserId),
    [currentUserId, inProgressTickets],
  );

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
          <div className="space-y-3">{pendingTickets.map((ticket) => renderPhoneTicket(ticket))}</div>
        </section>

        <section className="mt-6">
          <h2 className="mb-2 text-heading-sm font-semibold text-stone-900">My Orders</h2>
          <div className="space-y-3">
            {myInProgressTickets.length === 0 ? (
              <p className="text-body-sm text-stone-500">No active claimed tickets.</p>
            ) : (
              myInProgressTickets.map((ticket) => renderPhoneTicket(ticket))
            )}
          </div>
        </section>

        {selectedTicket && (
          <ClaimTicketSheet
            isOpen={Boolean(selectedTicket)}
            onClose={() => setSelectedTicket(null)}
            ticketId={selectedTicket.id}
            station={station}
            staffOnShift={staffOnShift}
            helperText={
              isUsingStaffFallback
                ? 'No clocked-in staff found. Showing active staff for local testing.'
                : undefined
            }
            isSubmitting={Boolean(selectedTicket && claimingTicketId === selectedTicket.id)}
            submittingMessage="Claiming ticket..."
            onClaim={(staffId) => void handleClaim(selectedTicket.id, staffId)}
          />
        )}
      </main>
    );
  }

  return (
    <FullscreenLayout className="bg-crema">
      <TopBar
        branchName={organizationName ?? 'Branch'}
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
    </FullscreenLayout>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FullscreenLayout, KDSCard, TopBar, Button, ConfirmDialog } from '@/components/ui';
import { usePrepTickets } from '@/hooks/usePrepTickets';
import { useToast } from '@/hooks/useToast';
import { useFcmToken } from '@/hooks/useFcmToken';
import { dispatchNotificationEvent } from '@/lib/notifications/dispatcher';
import { notificationSoundPlayer } from '@/lib/notifications/sound-player';
import { env } from '@/lib/env';
import { performLogout } from '@/lib/logout';
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
  PIZZA: 'CHEF',
  PASTRY: 'CHEF',
};

const stationLabels: Record<PrepStation, string> = {
  KITCHEN: 'Kitchen',
  BARISTA: 'Barista',
  PIZZA: 'Pizza',
  PASTRY: 'Pastry',
};

const stationDisplayLabels: Record<PrepStation, string> = {
  KITCHEN: 'Kitchen Display',
  BARISTA: 'Barista Display',
  PIZZA: 'Pizza Display',
  PASTRY: 'Pastry Display',
};

export function DisplayBoard({ station }: DisplayBoardProps) {
  const { pendingTickets, inProgressTickets, readyTickets, isLoading, station: activeStation, reload } = usePrepTickets();
  const { toast } = useToast();
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const organizationName = useAuthStore((state) => state.user?.organizationName ?? 'Branch');
  const role = useAuthStore((state) => state.role);
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  const updateTicketRealTime = useKitchenStore((state) => state.updateTicketRealTime);
  const clearReadyTickets = useKitchenStore((state) => state.clearReadyTickets);

  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>(
    typeof navigator !== 'undefined' && navigator.onLine ? 'connected' : 'disconnected',
  );
  const [staffOnShift, setStaffOnShift] = useState<Array<{ id: string; name: string; inProgressCount: number }>>([]);
  const [isUsingStaffFallback, setIsUsingStaffFallback] = useState(false);

  // ticketId → staffId being claimed (one active claim at a time per ticket)
  const [claimingTicketId, setClaimingTicketId] = useState<string | null>(null);
  const [claimingStaffId, setClaimingStaffId] = useState<string | null>(null);
  const [markingReadyTicketIds, setMarkingReadyTicketIds] = useState<Record<string, boolean>>({});
  const [rejectingTicket, setRejectingTicket] = useState<PrepTicketDetail | null>(null);
  const [isRejectSubmitting, setIsRejectSubmitting] = useState(false);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await performLogout();
    router.replace('/login');
  };

  // Tablet KDS/BDS: track whether the browser has granted audio autoplay.
  // Chrome blocks audio until a user gesture occurs on the page. We show a
  // fullscreen overlay on first load; tapping it unlocks audio for the session.
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const handleAudioUnlock = useCallback(() => {
    notificationSoundPlayer.unlock();
    setAudioUnlocked(true);
  }, []);

  // FCM push notification registration — chefs/baristas only visit this page,
  // so we must prompt here rather than relying on the dashboard banner.
  const { canPrompt: canPromptFcm, requestPermissionAndRegister } = useFcmToken();

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
          setStaffOnShift(onShiftStaff.map((entry) => ({ id: entry.id, name: entry.name, inProgressCount: 0 })));
          setIsUsingStaffFallback(false);
          return;
        }

        const activeStaff = await staffService.listStaff(accessToken, {
          role: roleByStation[station],
          isActive: true,
        });
        setStaffOnShift(activeStaff.map((entry) => ({ id: entry.id, name: entry.name, inProgressCount: 0 })));
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
    setClaimingStaffId(claimedById);

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
      // KDSCard closes the picker automatically when status transitions to IN_PROGRESS
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to claim this ticket right now.';
      toast({
        variant: 'warning',
        title: message,
      });
      void reload();
    } finally {
      setClaimingTicketId(null);
      setClaimingStaffId(null);
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

  // Tablet KDS/BDS: inline claim picker flow — no bottom sheet
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
      actionLabel={ticket.status === 'PENDING' ? 'Claim' : 'Mark Ready'}
      isActionLoading={Boolean(markingReadyTicketIds[ticket.id])}
      loadingMessage="Marking as ready..."
      onAction={() => {
        if (markingReadyTicketIds[ticket.id]) return;
        void handleMarkReady(ticket.id);
      }}
      placedBy={ticket.orderPlacedBy.name}
      claimedByName={ticket.claimedBy?.name}
      station={station}
      staffOnShiftForPicker={staffOnShiftWithCounts}
      pickerHelperText={
        isUsingStaffFallback
          ? 'No clocked-in staff found. Showing active staff.'
          : undefined
      }
      claimingStaffId={claimingTicketId === ticket.id ? claimingStaffId : null}
      onTabletClaim={(staffId) => {
        if (claimingTicketId === ticket.id) return;
        void handleClaim(ticket.id, staffId);
      }}
      onReject={() => setRejectingTicket(ticket)}
      onUnclaim={ticket.status === 'IN_PROGRESS' ? () => void handleUnclaim(ticket.id) : undefined}
      claimedAt={ticket.claimedAt}
      className={ticket.status === 'PENDING' ? 'animate-slide-in-top' : undefined}
    />
  );

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
      placedBy={ticket.orderPlacedBy.name}
      claimedByName={ticket.claimedBy?.name}
      onReject={() => setRejectingTicket(ticket)}
      onUnclaim={ticket.status === 'IN_PROGRESS' ? () => void handleUnclaim(ticket.id) : undefined}
      claimedAt={ticket.claimedAt}
      className={ticket.status === 'PENDING' ? 'animate-slide-in-top' : undefined}
    />
  );

  const isPersonalRole = role === 'BARISTA' || role === 'CHEF';

  // Keep inProgressCount up-to-date as tickets move between columns.
  // We derive it from the live inProgressTickets list so it reacts to Socket.io updates
  // without an extra API call.
  const staffOnShiftWithCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ticket of inProgressTickets) {
      const id = ticket.claimedBy?.id;
      if (id) {
        counts[id] = (counts[id] ?? 0) + 1;
      }
    }
    return staffOnShift.map((s) => ({ ...s, inProgressCount: counts[s.id] ?? 0 }));
  }, [staffOnShift, inProgressTickets]);

  const myInProgressTickets = useMemo(() => {
    if (!currentUserId) {
      return [];
    }

    return inProgressTickets.filter((ticket) => ticket.claimedBy?.id === currentUserId);
  }, [currentUserId, inProgressTickets]);

  const myReadyTickets = useMemo(() => {
    if (!currentUserId) {
      return [];
    }

    return readyTickets.filter((ticket) => ticket.claimedBy?.id === currentUserId);
  }, [currentUserId, readyTickets]);

  if (activeStation !== station) {
    return null;
  }

  if (isPersonalRole) {
    return (
      <main className="min-h-screen bg-crema p-4">
        {canPromptFcm && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2 text-body-sm text-amber-900">
            <span>Enable notifications for new order alerts.</span>
            <button
              type="button"
              onClick={() => void requestPermissionAndRegister()}
              className="shrink-0 rounded bg-amber-600 px-3 py-1 text-body-sm font-medium text-white"
            >
              Enable
            </button>
          </div>
        )}
        <header className="mb-4">
          <h1 className="font-display text-display-lg text-espresso">{stationLabels[station]}</h1>
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
          <h2 className="mb-2 text-heading-sm font-semibold text-stone-900">My In Progress</h2>
          <div className="space-y-3">
            {myInProgressTickets.length === 0 ? (
              <p className="text-body-sm text-stone-500">You have no claimed tickets in progress.</p>
            ) : (
              myInProgressTickets.map((ticket) => renderPhoneTicket(ticket))
            )}
          </div>
        </section>

        <section className="mt-6">
          <h2 className="mb-2 text-heading-sm font-semibold text-stone-900">My Ready</h2>
          <div className="space-y-3">
            {myReadyTickets.length === 0 ? (
              <p className="text-body-sm text-stone-500">You have no ready tickets.</p>
            ) : (
              myReadyTickets.map((ticket) => renderPhoneTicket(ticket))
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
      {!audioUnlocked && (
        <button
          type="button"
          onClick={handleAudioUnlock}
          className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-espresso/90 backdrop-blur-sm"
          aria-label="Tap to enable sound notifications"
        >
          <span className="text-6xl" aria-hidden="true">🔔</span>
          <p className="text-display-sm font-display text-crema">Tap to enable sound</p>
          <p className="text-body-md text-crema/70">Audio alerts will play automatically for new orders</p>
        </button>
      )}
      <TopBar
        branchName={organizationName ?? 'Branch'}
        stationLabel={stationDisplayLabels[station]}
        connectionStatus={connectionStatus}
        tone="light"
        onLogout={() => setShowLogoutConfirm(true)}
      />
      {connectionStatus === 'disconnected' && (
        <div className="bg-[#FDF2F0] px-4 py-2 text-body-sm text-[#9B3A2A]">Offline. Reconnecting...</div>
      )}
      {canPromptFcm && (
        <div className="flex items-center justify-between gap-3 bg-amber-50 px-4 py-2 text-body-sm text-amber-900">
          <span>Enable push notifications to receive new order alerts when this screen is off.</span>
          <button
            type="button"
            onClick={() => void requestPermissionAndRegister()}
            className="shrink-0 rounded bg-amber-600 px-3 py-1 text-body-sm font-medium text-white"
          >
            Enable
          </button>
        </div>
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
      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={() => void handleLogout()}
        title="Log out?"
        description="This will end the session on this screen."
        confirmLabel="Log out"
        cancelLabel="Cancel"
        isLoading={isLoggingOut}
      />
    </FullscreenLayout>
  );
}

import { create } from 'zustand';
import type { PrepTicketDetail, PrepTicketStatus } from '@/types/order';

interface KitchenStore {
  pendingTickets: PrepTicketDetail[];
  inProgressTickets: PrepTicketDetail[];
  readyTickets: PrepTicketDetail[];
  isLoading: boolean;
  error: string | null;
  setTickets: (tickets: PrepTicketDetail[]) => void;
  addTicketRealTime: (ticket: PrepTicketDetail) => void;
  updateTicketRealTime: (ticketId: string, updates: Partial<PrepTicketDetail>) => void;
  removeOrderTickets: (orderId: string) => void;
  clearReadyTickets: (orderId: string) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

const partitionTickets = (tickets: PrepTicketDetail[]) => {
  const pendingTickets: PrepTicketDetail[] = [];
  const inProgressTickets: PrepTicketDetail[] = [];
  const readyTickets: PrepTicketDetail[] = [];

  tickets.forEach((ticket) => {
    if (ticket.status === 'PENDING') {
      pendingTickets.push(ticket);
      return;
    }
    if (ticket.status === 'IN_PROGRESS') {
      inProgressTickets.push(ticket);
      return;
    }
    readyTickets.push(ticket);
  });

  return { pendingTickets, inProgressTickets, readyTickets };
};

const applyStatusUpdate = (
  ticket: PrepTicketDetail,
  status: PrepTicketStatus,
): PrepTicketDetail => ({
  ...ticket,
  status,
});

export const useKitchenStore = create<KitchenStore>((set, get) => ({
  pendingTickets: [],
  inProgressTickets: [],
  readyTickets: [],
  isLoading: false,
  error: null,

  setTickets: (tickets) => set(partitionTickets(tickets)),

  addTicketRealTime: (ticket) =>
    set((state) => {
      const mergedTickets = [
        ticket,
        ...state.pendingTickets,
        ...state.inProgressTickets,
        ...state.readyTickets,
      ].filter((entry, index, arr) => arr.findIndex((other) => other.id === entry.id) === index);

      return partitionTickets(mergedTickets);
    }),

  updateTicketRealTime: (ticketId, updates) =>
    set((state) => {
      const allTickets = [...state.pendingTickets, ...state.inProgressTickets, ...state.readyTickets];
      const updated = allTickets.map((ticket) =>
        ticket.id === ticketId
          ? applyStatusUpdate(
              { ...ticket, ...updates },
              (updates.status ?? ticket.status) as PrepTicketStatus,
            )
          : ticket,
      );

      return partitionTickets(updated);
    }),

  removeOrderTickets: (orderId) =>
    set((state) => ({
      pendingTickets: state.pendingTickets.filter((ticket) => ticket.orderId !== orderId),
      inProgressTickets: state.inProgressTickets.filter((ticket) => ticket.orderId !== orderId),
      readyTickets: state.readyTickets.filter((ticket) => ticket.orderId !== orderId),
    })),

  clearReadyTickets: (orderId) =>
    set((state) => ({
      readyTickets: state.readyTickets.filter((ticket) => ticket.orderId !== orderId),
    })),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));

import { getSocketServer, userRoomName } from '../../../sockets/socket';

export type WorkforceNudge = 'workforce:notifications' | 'workforce:needs-you';

/**
 * The socket nudge: "something changed for you", no payload (the open screen refetches). One room per person. A process with no
 * socket server (the worker, a script) does nothing; the screens also refetch on tab focus and every minute, so a missed nudge heals.
 */
export function nudgeUsers(userIds: readonly string[], event: WorkforceNudge): void {
  try {
    const io = getSocketServer();
    for (const id of new Set(userIds)) io.to(userRoomName(id)).emit(event);
  } catch {
    // no socket server in this process
  }
}

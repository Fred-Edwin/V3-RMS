'use client';

import { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Paperclip, Check, Users, ChevronDown } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';
import { commsService } from '@/services/commsService';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';
import type { BroadcastRecord, BroadcastRecipientStatusRecord } from '@/types/comms';

interface Props {
  broadcast: BroadcastRecord | null;
  onClose: () => void;
}

export function BroadcastDetailSheet({ broadcast, onClose }: Props) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role);
  const userId = useAuthStore((s) => s.user?.id ?? null);

  const [detail, setDetail] = useState<BroadcastRecord | null>(null);
  const [statuses, setStatuses] = useState<BroadcastRecipientStatusRecord[]>([]);
  const [acknowledging, setAcknowledging] = useState(false);
  const [trackingExpanded, setTrackingExpanded] = useState(false);
  const toggleTracking = useCallback(() => setTrackingExpanded((v) => !v), []);

  const canViewStatus = role === 'MANAGER' || role === 'DIRECTOR';

  useEffect(() => {
    if (!broadcast || !accessToken) {
      setDetail(null);
      setStatuses([]);
      return;
    }

    const fetchDetail = async () => {
      const d = await commsService.getBroadcastDetail(accessToken, broadcast.id);
      setDetail(d);
      if (!d.myReadAt) {
        void commsService.markBroadcastRead(accessToken, broadcast.id);
      }
      if (canViewStatus && d.sender.id === userId) {
        const s = await commsService.getBroadcastStatus(accessToken, broadcast.id);
        setStatuses(s);
      }
    };
    void fetchDetail();

    // Socket: patch statuses in real-time when recipients read or ack
    const socket = getSocket();
    const broadcastId = broadcast.id;

    const handleRead = (payload: { broadcastId: string; userId: string; userName: string; readAt: string }) => {
      if (payload.broadcastId !== broadcastId) return;
      setStatuses((prev) => prev.map((s) =>
        s.userId === payload.userId ? { ...s, readAt: payload.readAt } : s,
      ));
    };

    const handleAcknowledged = (payload: { broadcastId: string; userId: string; userName: string; acknowledgedAt: string }) => {
      if (payload.broadcastId !== broadcastId) return;
      setStatuses((prev) => prev.map((s) =>
        s.userId === payload.userId
          ? { ...s, acknowledgedAt: payload.acknowledgedAt, readAt: s.readAt ?? payload.acknowledgedAt }
          : s,
      ));
    };

    socket?.on('comms:broadcast_read', handleRead);
    socket?.on('comms:broadcast_acknowledged', handleAcknowledged);

    return () => {
      socket?.off('comms:broadcast_read', handleRead);
      socket?.off('comms:broadcast_acknowledged', handleAcknowledged);
    };
  }, [broadcast, accessToken, canViewStatus, userId]);

  const handleAcknowledge = async () => {
    if (!accessToken || !detail) return;
    setAcknowledging(true);
    try {
      await commsService.acknowledgeBroadcast(accessToken, detail.id);
      setDetail((prev) => prev ? { ...prev, myAcknowledgedAt: new Date().toISOString() } : prev);
    } finally {
      setAcknowledging(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F5F0E8]">
      {/* Header */}
      <div className="bg-[#2C1810] px-4 py-3 flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="text-[#F5F0E8]/80 hover:text-[#F5F0E8] transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="text-[#F5F0E8] font-semibold text-base truncate flex-1">
          {detail?.subject ?? 'Broadcast'}
        </span>
      </div>

      {!detail ? (
        <div className="flex items-center justify-center h-32">
          <Spinner />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Broadcast card — espresso left-accent border */}
          <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-[#E8E0D5] border-l-4 border-l-[#2C1810]">
            <div className="px-4 py-3 border-b border-[#F0EBE3]">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="inline-flex items-center rounded-full bg-[#2C1810] text-[#F5F0E8] text-[11px] font-semibold px-2.5 py-0.5">
                  {detail.scope === 'COMPANY' ? 'Company-wide' : detail.scope === 'BRANCH' ? 'Branch' : 'Role group'}
                </span>
                {detail.requiresAck && detail.myAcknowledgedAt && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0] text-[11px] font-semibold px-2 py-0.5">
                    <Check size={10} strokeWidth={3} />
                    Acknowledged
                  </span>
                )}
              </div>
              <h3 className="text-base font-semibold text-[#1C1917] leading-snug mb-1">
                {detail.subject}
              </h3>
              <p className="text-xs text-[#8B7355]">
                {detail.sender.name} · {new Date(detail.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <div className="px-4 py-4">
              <div
                className="prose prose-sm max-w-none text-[#44403C] leading-relaxed"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: detail.bodyHtml }}
              />
              {detail.attachmentUrl && (
                <a
                  href={detail.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex items-center gap-2 rounded-lg bg-[#F5F0E8] border border-[#E8E0D5] px-3 py-2 text-sm text-[#2C1810] font-medium hover:bg-[#EDE7DC] transition-colors"
                >
                  <Paperclip size={14} className="shrink-0" />
                  {detail.attachmentName ?? 'Attachment'}
                </a>
              )}
            </div>
          </div>

          {/* Recipient: pending ack banner — orange, only shown to actual recipients who haven't acknowledged */}
          {detail.isRecipient && detail.requiresAck && !detail.myAcknowledgedAt && detail.sender.id !== userId && (
            <div className="rounded-xl bg-[#FFF7ED] border border-[#FED7AA] px-4 py-3">
              <p className="text-sm font-medium text-[#9A3412] mb-3">
                You must acknowledge this message to confirm you have read and understood it.
              </p>
              <Button variant="primary" onClick={() => void handleAcknowledge()} disabled={acknowledging} className="w-full">
                <Check size={14} className="mr-2" />
                {acknowledging ? 'Acknowledging…' : 'I have read and understood this'}
              </Button>
            </div>
          )}

          {/* Recipient: acknowledged confirmation — vivid green, only shown to actual recipients */}
          {detail.isRecipient && detail.requiresAck && detail.myAcknowledgedAt && detail.sender.id !== userId && (
            <div className="rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] px-4 py-3 flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-[#DCFCE7] border border-[#86EFAC] flex items-center justify-center shrink-0 mt-0.5">
                <Check size={13} className="text-[#15803D]" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#15803D]">Acknowledged</p>
                <p className="text-xs text-[#16A34A] mt-0.5">
                  You confirmed this on {new Date(detail.myAcknowledgedAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                </p>
              </div>
            </div>
          )}

          {/* Recipient: read receipt footer (no ack required) — not shown to sender */}
          {detail.myReadAt && !detail.requiresAck && detail.sender.id !== userId && (
            <p className="text-center text-xs text-[#8B7355]">
              You read this on {new Date(detail.myReadAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
            </p>
          )}

          {/* Sender: delivery tracking panel — collapsed by default, expands to grouped layout */}
          {canViewStatus && detail.sender.id === userId && statuses.length > 0 && (() => {
            const total = statuses.length;
            const readCount = statuses.filter((s) => s.readAt).length;
            const ackedCount = statuses.filter((s) => s.acknowledgedAt).length;
            const unreadCount = total - readCount;
            const readPct = Math.round((readCount / total) * 100);
            const requiresAck = detail.requiresAck;
            const allRead = readCount === total;
            const allAcked = !requiresAck || ackedCount === total;
            const allDone = allRead && allAcked;

            const unread = statuses.filter((s) => !s.readAt);
            const readPending = statuses.filter((s) => s.readAt && (requiresAck ? !s.acknowledgedAt : true));
            const acked = requiresAck ? statuses.filter((s) => s.acknowledgedAt) : [];

            const summaryText = allDone
              ? requiresAck ? 'All recipients read and acknowledged · tap to view' : 'All recipients have read this · tap to view'
              : requiresAck
                ? `${unreadCount} unread · ${total - ackedCount} pending ack · tap to view details`
                : `${unreadCount} unread · tap to view details`;

            return (
              <div className={`rounded-xl border bg-white overflow-hidden ${allDone ? 'border-[#BBF7D0]' : 'border-[#BFDBFE]'}`}>
                {/* Collapsed summary button */}
                <button
                  type="button"
                  onClick={toggleTracking}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${allDone ? 'bg-[#F0FDF4] hover:bg-[#DCFCE7]' : 'bg-[#EFF6FF] hover:bg-[#DBEAFE]'}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${allDone ? 'bg-[#DCFCE7] border border-[#86EFAC]' : 'bg-[#DBEAFE] border border-[#93C5FD]'}`}>
                    <Users size={14} className={allDone ? 'text-[#15803D]' : 'text-[#2563EB]'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-semibold ${allDone ? 'text-[#15803D]' : 'text-[#1E40AF]'}`}>
                        Delivery Tracking
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs ${allRead ? 'text-[#15803D]' : 'text-[#3B82F6]'}`}>
                          <span className="font-bold">{readCount}</span>/{total} read
                        </span>
                        {requiresAck && (
                          <span className={`text-xs ${ackedCount === total ? 'text-[#15803D]' : 'text-[#3B82F6]'}`}>
                            <span className="font-bold">{ackedCount}</span>/{total} acked
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${allRead ? 'bg-[#16A34A]' : 'bg-[#2563EB]'}`}
                        style={{ width: `${readPct}%` }}
                      />
                    </div>
                    <p className={`text-xs mt-1 ${allDone ? 'text-[#15803D]' : 'text-[#3B82F6]'}`}>
                      {summaryText}
                    </p>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`shrink-0 transition-transform duration-200 ${allDone ? 'text-[#4ADE80]' : 'text-[#60A5FA]'} ${trackingExpanded ? 'rotate-180' : ''}`}
                  />
                </button>

                {/* Expanded — grouped layout */}
                {trackingExpanded && (
                  <div className="border-t border-[#E0F2FE]">
                    {/* Unread group */}
                    {unread.length > 0 && (
                      <>
                        <div className="px-4 pt-3 pb-1">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
                            Unread · {unread.length}
                          </p>
                        </div>
                        <div className="divide-y divide-[#F1F5F9]">
                          {unread.map((s) => (
                            <div key={s.userId} className="flex items-center justify-between px-4 py-2.5">
                              <span className="text-sm font-medium text-[#1C1917] truncate flex-1">{s.userName}</span>
                              <span className="w-2 h-2 rounded-full bg-[#CBD5E1] shrink-0" />
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Read but ack pending */}
                    {requiresAck && readPending.length > 0 && (
                      <>
                        <div className={`px-4 pt-3 pb-1 ${unread.length > 0 ? 'border-t border-[#F1F5F9] mt-1' : ''}`}>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#2563EB]">
                            Read · pending ack · {readPending.length}
                          </p>
                        </div>
                        <div className="divide-y divide-[#F1F5F9] bg-[#F8FAFF]">
                          {readPending.map((s) => (
                            <div key={s.userId} className="flex items-center justify-between px-4 py-2.5">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-[#1C1917] truncate">{s.userName}</p>
                                <p className="text-xs text-[#64748B] mt-0.5">
                                  Read {new Date(s.readAt!).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                                </p>
                              </div>
                              {/* Blue double-tick: read but not acked */}
                              <svg width="18" height="10" viewBox="0 0 18 10" fill="none" className="shrink-0 ml-2">
                                <polyline points="1,5 4,8 9,1" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                <polyline points="7,5 10,8 16,1" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Acknowledged / Read+done */}
                    {(requiresAck ? acked : statuses.filter((s) => s.readAt)).length > 0 && (
                      <>
                        <div className={`px-4 pt-3 pb-1 bg-[#F0FDF4] ${(unread.length > 0 || readPending.length > 0) ? 'border-t border-[#DCFCE7] mt-1' : ''}`}>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#15803D]">
                            {requiresAck ? `Acknowledged · ${acked.length}` : `Read · ${readCount}`}
                          </p>
                        </div>
                        <div className="divide-y divide-[#DCFCE7] bg-[#F0FDF4]">
                          {(requiresAck ? acked : statuses.filter((s) => s.readAt)).map((s) => (
                            <div key={s.userId} className="flex items-center justify-between px-4 py-2.5">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-[#1C1917] truncate">{s.userName}</p>
                                <p className="text-xs text-[#16A34A] mt-0.5">
                                  {requiresAck
                                    ? `${new Date(s.acknowledgedAt!).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })} · ${new Date(s.acknowledgedAt!).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}`
                                    : `${new Date(s.readAt!).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })} · ${new Date(s.readAt!).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}`
                                  }
                                </p>
                              </div>
                              <Check size={14} className="text-[#16A34A] shrink-0 ml-2" strokeWidth={2.5} />
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    <div className="h-2" />
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

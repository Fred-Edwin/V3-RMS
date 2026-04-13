'use client';

import { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Paperclip, Check, Users, ChevronDown, AlertTriangle } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';
import { commsService } from '@/services/commsService';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';
import type { FormalNoticeRecord, FormalNoticeRecipientStatusRecord } from '@/types/comms';

interface Props {
  notice: FormalNoticeRecord | null;
  onClose: () => void;
}

export function NoticeDetailSheet({ notice, onClose }: Props) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role);
  const userId = useAuthStore((s) => s.user?.id ?? null);

  const [detail, setDetail] = useState<FormalNoticeRecord | null>(null);
  const [statuses, setStatuses] = useState<FormalNoticeRecipientStatusRecord[]>([]);
  const [acknowledging, setAcknowledging] = useState(false);
  const [trackingExpanded, setTrackingExpanded] = useState(false);
  const toggleTracking = useCallback(() => setTrackingExpanded((v) => !v), []);

  const isDirector = role === 'DIRECTOR';

  useEffect(() => {
    if (!notice || !accessToken) {
      setDetail(null);
      setStatuses([]);
      return;
    }

    const fetchDetail = async () => {
      const d = await commsService.getNoticeDetail(accessToken, notice.id);
      setDetail(d);
      if (isDirector && d.issuer.id === userId) {
        const s = await commsService.getNoticeStatus(accessToken, notice.id);
        setStatuses(s);
      }
    };
    void fetchDetail();

    // Socket: patch statuses in real-time when a recipient acknowledges
    const socket = getSocket();
    const noticeId = notice.id;

    const handleAcknowledged = (payload: { noticeId: string; userId: string; userName: string; acknowledgedAt: string }) => {
      if (payload.noticeId !== noticeId) return;
      setStatuses((prev) => prev.map((s) =>
        s.userId === payload.userId ? { ...s, acknowledgedAt: payload.acknowledgedAt } : s,
      ));
    };

    socket?.on('comms:notice_acknowledged', handleAcknowledged);

    return () => {
      socket?.off('comms:notice_acknowledged', handleAcknowledged);
    };
  }, [notice, accessToken, isDirector, userId]);

  const handleAcknowledge = async () => {
    if (!accessToken || !detail) return;
    setAcknowledging(true);
    try {
      await commsService.acknowledgeNotice(accessToken, detail.id);
      setDetail((prev) => prev ? { ...prev, myAcknowledgedAt: new Date().toISOString() } : prev);
    } finally {
      setAcknowledging(false);
    }
  };

  const isAcknowledged = !!detail?.myAcknowledgedAt;

  return (
    <div className="flex flex-col h-full bg-[#F5F0E8]">
      {/* Header — always espresso, same as broadcasts */}
      <div className="bg-[#2C1810] px-4 py-3 flex items-center gap-3 shrink-0">
        <button type="button" onClick={onClose} className="text-white/80 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </button>
        <span className="text-white font-semibold text-base truncate flex-1">
          {detail?.subject ?? 'Notice'}
        </span>
      </div>

      {!detail ? (
        <div className="flex items-center justify-center h-32">
          <Spinner />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Notice card — espresso left-accent border, same as broadcasts */}
          <div className={`rounded-xl overflow-hidden shadow-sm bg-white border border-l-4 ${isAcknowledged ? 'border-[#BBF7D0] border-l-[#16A34A]' : 'border-[#E8E0D5] border-l-[#2C1810]'}`}>
            <div className={`px-4 py-3 flex items-center gap-3 border-b ${isAcknowledged ? 'bg-[#F0FDF4] border-[#BBF7D0]' : 'bg-[#F5F0E8] border-[#E8E0D5]'}`}>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isAcknowledged ? 'bg-[#DCFCE7] border border-[#86EFAC]' : 'bg-[#EDE7DC] border border-[#D6D3D1]'}`}>
                {isAcknowledged
                  ? <Check size={16} className="text-[#15803D]" strokeWidth={2.5} />
                  : <AlertTriangle size={16} className="text-[#2C1810]" strokeWidth={2} />
                }
              </div>
              <div>
                <p className={`text-xs font-bold uppercase tracking-wide ${isAcknowledged ? 'text-[#15803D]' : 'text-[#2C1810]'}`}>
                  Formal Notice
                </p>
                <p className={`text-xs mt-0.5 ${isAcknowledged ? 'text-[#16A34A]' : 'text-[#8B7355]'}`}>
                  {isAcknowledged
                    ? `Acknowledged ${new Date(detail.myAcknowledgedAt!).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : `Issued by ${detail.issuer.name} · ${new Date(detail.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}`
                  }
                </p>
              </div>
            </div>
            <div className="bg-white px-4 py-4">
              <h3 className="text-base font-semibold text-[#1C1917] mb-3">{detail.subject}</h3>
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

          {/* Recipient: pending ack banner — orange, never shown to issuer */}
          {!detail.myAcknowledgedAt && detail.issuer.id !== userId && (
            <div className="rounded-xl bg-[#FFF7ED] border border-[#FED7AA] px-4 py-3">
              <div className="flex items-start gap-2 mb-3">
                <AlertTriangle size={15} className="text-[#EA580C] shrink-0 mt-0.5" strokeWidth={2} />
                <p className="text-sm font-medium text-[#9A3412]">
                  You must acknowledge receipt of this formal notice. Acknowledging does not mean you agree with its contents.
                </p>
              </div>
              <Button variant="primary" onClick={() => void handleAcknowledge()} disabled={acknowledging} className="w-full">
                <Check size={14} className="mr-2" />
                {acknowledging ? 'Acknowledging…' : 'Acknowledge receipt'}
              </Button>
            </div>
          )}

          {/* Recipient: acknowledged confirmation — vivid green, never shown to issuer */}
          {detail.myAcknowledgedAt && detail.issuer.id !== userId && (
            <div className="rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] px-4 py-3 flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-[#DCFCE7] border border-[#86EFAC] flex items-center justify-center shrink-0 mt-0.5">
                <Check size={13} className="text-[#15803D]" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#15803D]">Acknowledged</p>
                <p className="text-xs text-[#16A34A] mt-0.5">
                  You confirmed receipt on {new Date(detail.myAcknowledgedAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                </p>
                <p className="text-xs text-[#16A34A]/70 mt-1">
                  This notice is permanently retained on your HR record.
                </p>
              </div>
            </div>
          )}

          {/* Issuer: ack tracking panel — collapsed by default, expands to grouped layout */}
          {isDirector && detail.issuer.id === userId && statuses.length > 0 && (() => {
            const total = statuses.length;
            const ackedCount = statuses.filter((s) => s.acknowledgedAt).length;
            const pendingCount = total - ackedCount;
            const pct = Math.round((ackedCount / total) * 100);
            const allDone = ackedCount === total;
            const pending = statuses.filter((s) => !s.acknowledgedAt);
            const acknowledged = statuses.filter((s) => s.acknowledgedAt);

            return (
              <div className={`rounded-xl border bg-white overflow-hidden ${allDone ? 'border-[#BBF7D0]' : 'border-[#BFDBFE]'}`}>
                {/* Collapsed summary button — blue, same as broadcast delivery tracking */}
                <button
                  type="button"
                  onClick={toggleTracking}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${allDone ? 'bg-[#F0FDF4] hover:bg-[#DCFCE7]' : 'bg-[#EFF6FF] hover:bg-[#DBEAFE]'}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${allDone ? 'bg-[#DCFCE7] border border-[#86EFAC]' : 'bg-[#DBEAFE] border border-[#93C5FD]'}`}>
                    <Users size={14} className={allDone ? 'text-[#15803D]' : 'text-[#2563EB]'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-semibold ${allDone ? 'text-[#15803D]' : 'text-[#1E40AF]'}`}>
                        Acknowledgements
                      </span>
                      <span className={`text-sm font-bold ${allDone ? 'text-[#16A34A]' : 'text-[#2563EB]'}`}>
                        {ackedCount}/{total}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-[#16A34A]' : 'bg-[#2563EB]'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className={`text-xs mt-1 ${allDone ? 'text-[#15803D]' : 'text-[#3B82F6]'}`}>
                      {allDone ? 'All recipients acknowledged · tap to view' : `${pendingCount} pending · tap to view details`}
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
                    {/* Pending group first — most actionable */}
                    {pending.length > 0 && (
                      <>
                        <div className="px-4 pt-3 pb-1">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
                            Pending · {pendingCount}
                          </p>
                        </div>
                        <div className="divide-y divide-[#F1F5F9]">
                          {pending.map((s) => (
                            <div key={s.userId} className="flex items-center justify-between px-4 py-2.5">
                              <span className="text-sm font-medium text-[#1C1917] truncate flex-1">{s.userName}</span>
                              <span className="w-2 h-2 rounded-full bg-[#CBD5E1] shrink-0" />
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Acknowledged group */}
                    {acknowledged.length > 0 && (
                      <>
                        <div className={`px-4 pt-3 pb-1 bg-[#F0FDF4] ${pending.length > 0 ? 'border-t border-[#DCFCE7] mt-1' : ''}`}>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#15803D]">
                            Acknowledged · {ackedCount}
                          </p>
                        </div>
                        <div className="divide-y divide-[#DCFCE7] bg-[#F0FDF4]">
                          {acknowledged.map((s) => (
                            <div key={s.userId} className="flex items-center justify-between px-4 py-2.5">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-[#1C1917] truncate">{s.userName}</p>
                                <p className="text-xs text-[#16A34A] mt-0.5">
                                  {new Date(s.acknowledgedAt!).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  {' · '}
                                  {new Date(s.acknowledgedAt!).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
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

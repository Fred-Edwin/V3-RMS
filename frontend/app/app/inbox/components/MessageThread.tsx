'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Paperclip, Image as ImageIcon, Send, Mic, Trash2 } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { commsService } from '@/services/commsService';
import { useAuthStore } from '@/store/authStore';
import { useCommsStore } from '@/store/commsStore';
import { getSocket } from '@/lib/socket';
import type { DirectConversationRecord, DirectMessageRecord } from '@/types/comms';
import { TypingIndicator } from './TypingIndicator';
import { ImageLightbox } from './ImageLightbox';
import { avatarColour, initials } from './InboxShell';

interface Props {
  conversation: DirectConversationRecord;
  onBack?: () => void;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateSeparator(isoString: string): string {
  const d = new Date(isoString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url);
}

export function MessageThread({ conversation, onBack }: Props) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const lastReceivedDm = useCommsStore((s) => s.lastReceivedDm);
  const typingUsers = useCommsStore((s) => s.typingUsers);
  const decrementUnreadDm = useCommsStore((s) => s.decrementUnreadDm);

  const [messages, setMessages] = useState<DirectMessageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<DirectMessageRecord | null>(null);
  const [contextMenu, setContextMenu] = useState<{ messageId: string } | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const typingName = typingUsers[conversation.id];

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const msgs = await commsService.getMessages(accessToken, conversation.id);
      setMessages([...msgs].reverse());
    } finally {
      setLoading(false);
    }
  }, [accessToken, conversation.id]);

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    setDraft('');
    setReplyingTo(null);
    setContextMenu(null);
    void load();
  }, [load]);

  // Mark a received message as read and update local state + unread count
  const markRead = useCallback(async (messageId: string) => {
    if (!accessToken) return;
    try {
      await commsService.markMessageRead(accessToken, messageId);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId && !m.readAt ? { ...m, readAt: new Date().toISOString() } : m)),
      );
      decrementUnreadDm();
    } catch {
      // non-critical — ignore silently
    }
  }, [accessToken, decrementUnreadDm]);

  // After initial load: mark all unread messages from the other participant as read
  useEffect(() => {
    if (loading || !userId) return;
    messages
      .filter((m) => m.senderId !== userId && !m.readAt)
      .forEach((m) => { void markRead(m.id); });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once after load completes
  }, [loading]);

  // Append incoming DM in real-time and immediately mark it read (thread is open)
  useEffect(() => {
    if (!lastReceivedDm || lastReceivedDm.conversationId !== conversation.id) return;
    const { message } = lastReceivedDm;
    const isFromOther = message.senderId !== userId;
    setMessages((prev) => [
      ...prev,
      {
        id: message.id,
        conversationId: conversation.id,
        senderId: message.senderId,
        senderName: message.senderName,
        bodyHtml: message.bodyHtml,
        attachmentUrl: message.attachmentUrl,
        attachmentName: message.attachmentName,
        readAt: isFromOther ? new Date().toISOString() : null, // optimistic read
        createdAt: message.createdAt,
        isDeleted: false,
      },
    ]);
    if (isFromOther) void markRead(message.id);
  }, [lastReceivedDm, conversation.id, userId, markRead]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingName]);

  // Listen for read receipts — update readAt on our sent messages in real-time
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (payload: { messageId: string; conversationId: string; readAt: string }) => {
      if (payload.conversationId !== conversation.id) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === payload.messageId ? { ...m, readAt: payload.readAt } : m)),
      );
    };
    socket.on('comms:message_read', handler);
    return () => { socket.off('comms:message_read', handler); };
  }, [conversation.id]);

  // Cleanup typing timer on unmount
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      // Emit stop on unmount
      getSocket()?.emit('comms:typing_stop', { conversationId: conversation.id });
    };
  }, [conversation.id]);

  const handleDraftChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value);
    // Auto-grow
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    }
    // Typing indicator
    getSocket()?.emit('comms:typing_start', { conversationId: conversation.id });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      getSocket()?.emit('comms:typing_stop', { conversationId: conversation.id });
    }, 2000);
  };

  const handleSend = async () => {
    if (!accessToken || !draft.trim()) return;
    setSending(true);
    setUploadError(null);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    getSocket()?.emit('comms:typing_stop', { conversationId: conversation.id });
    try {
      const msg = await commsService.sendMessage(accessToken, conversation.id, {
        bodyHtml: `<p>${draft.trim().replace(/\n/g, '</p><p>')}</p>`,
      });
      setMessages((prev) => [...prev, msg]);
      setDraft('');
      setReplyingTo(null);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!accessToken) return;
    setContextMenu(null);
    await commsService.deleteMessage(accessToken, messageId);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, isDeleted: true, bodyHtml: '<em>[deleted]</em>' } : m,
      ),
    );
  };

  const handleImageFile = async (file: File) => {
    if (!accessToken) return;
    setUploading(true);
    setUploadError(null);
    try {
      const { imageUrl } = await commsService.uploadDmImage(accessToken, conversation.id, file);
      const msg = await commsService.sendMessage(accessToken, conversation.id, {
        bodyHtml: '<p>[Image]</p>',
        attachmentUrl: imageUrl,
        attachmentName: file.name,
      });
      setMessages((prev) => [...prev, msg]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Image upload failed';
      setUploadError(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleTouchStart = (messageId: string) => {
    touchTimerRef.current = setTimeout(() => {
      setContextMenu({ messageId });
    }, 500);
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
  };

  const otherName = conversation.otherParticipant.name;
  const otherColour = avatarColour(otherName);
  const otherInitials = initials(otherName);

  // Build date separators
  const messageWithSeparators: Array<{ type: 'separator'; label: string } | { type: 'message'; msg: DirectMessageRecord }> = [];
  let lastDate = '';
  for (const msg of messages) {
    const dateLabel = formatDateSeparator(msg.createdAt);
    if (dateLabel !== lastDate) {
      messageWithSeparators.push({ type: 'separator', label: dateLabel });
      lastDate = dateLabel;
    }
    messageWithSeparators.push({ type: 'message', msg });
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-[#2C1810]">
        <div className="bg-[#2C1810] px-4 py-3 flex items-center gap-3 shrink-0">
          {onBack && (
            <button type="button" onClick={onBack} className="text-[#F5F0E8]/80 hover:text-[#F5F0E8]">
              <ArrowLeft size={20} />
            </button>
          )}
          <span className="text-[#F5F0E8] font-semibold">{otherName}</span>
        </div>
        <div className="flex-1 flex items-center justify-center bg-[#F5F0E8]">
          <Spinner />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-[#2C1810] px-4 py-3 flex items-center gap-3 shrink-0">
        {onBack && (
          <button type="button" onClick={onBack} className="text-[#F5F0E8]/80 hover:text-[#F5F0E8] transition-colors">
            <ArrowLeft size={20} />
          </button>
        )}
        {/* Avatar */}
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${otherColour}`}>
          {otherInitials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#F5F0E8] text-sm leading-none">{otherName}</p>
          <p className="text-[#F5F0E8]/60 text-xs mt-0.5 capitalize">
            {conversation.otherParticipant.role.toLowerCase()}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-[#F5F0E8]"
        onClick={() => setContextMenu(null)}
      >
        {messageWithSeparators.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <p className="text-sm text-[#8B7355]">No messages yet</p>
            <p className="text-xs text-[#C4B49A]">Send the first message below</p>
          </div>
        )}

        {messageWithSeparators.map((item, idx) => {
          if (item.type === 'separator') {
            return (
              <div key={`sep-${idx}`} className="flex justify-center py-2">
                <span className="bg-[#EDE7DC] text-[#8B7355] text-[11px] font-medium px-3 py-1 rounded-full">
                  {item.label}
                </span>
              </div>
            );
          }

          const { msg } = item;
          const isMine = msg.senderId === userId;

          return (
            <div
              key={msg.id}
              className={`flex ${isMine ? 'justify-end' : 'justify-start'} gap-2 mb-1`}
              onContextMenu={(e) => { e.preventDefault(); setContextMenu({ messageId: msg.id }); }}
              onTouchStart={() => handleTouchStart(msg.id)}
              onTouchEnd={handleTouchEnd}
              onTouchMove={handleTouchEnd}
            >
              {/* Incoming avatar */}
              {!isMine && (
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 self-end mb-1 ${otherColour}`}>
                  {otherInitials}
                </div>
              )}

              <div className="max-w-[75%] flex flex-col">
                {/* Bubble */}
                <div
                  className={`px-3 py-2 rounded-2xl text-sm relative ${
                    isMine
                      ? 'bg-[#2C1810] text-[#F5F0E8] rounded-br-sm'
                      : 'bg-white border border-[#E8E0D5] text-[#2C1810] rounded-bl-sm'
                  }`}
                >
                  {/* Image attachment */}
                  {msg.attachmentUrl && isImageUrl(msg.attachmentUrl) && !msg.isDeleted && (
                    <button
                      type="button"
                      onClick={() => setLightboxSrc(msg.attachmentUrl)}
                      className="block mb-2 rounded-lg overflow-hidden"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={msg.attachmentUrl}
                        alt={msg.attachmentName ?? 'Image'}
                        className="max-w-[220px] max-h-[200px] object-cover rounded-lg"
                      />
                    </button>
                  )}

                  {/* Non-image attachment */}
                  {msg.attachmentUrl && !isImageUrl(msg.attachmentUrl) && !msg.isDeleted && (
                    <a
                      href={msg.attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 mb-1 text-xs underline opacity-80"
                    >
                      <Paperclip size={10} />
                      {msg.attachmentName ?? 'Attachment'}
                    </a>
                  )}

                  {/* Body text (skip if image-only placeholder) */}
                  {!(msg.attachmentUrl && isImageUrl(msg.attachmentUrl) && msg.bodyHtml === '<p>[Image]</p>') && (
                    <div
                      className="prose prose-sm max-w-none"
                      // eslint-disable-next-line react/no-danger
                      dangerouslySetInnerHTML={{
                        __html: msg.isDeleted ? '<em class="opacity-60">[deleted]</em>' : msg.bodyHtml,
                      }}
                    />
                  )}
                </div>

                {/* Timestamp + read receipts */}
                <div className={`flex items-center gap-1 mt-0.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <span className="text-[10px] text-[#8B7355]">{formatTime(msg.createdAt)}</span>
                  {isMine && !msg.isDeleted && (
                    <span className={`text-[11px] font-bold ${msg.readAt ? 'text-blue-500' : 'text-[#8B7355]'}`}>
                      ✓✓
                    </span>
                  )}
                </div>
              </div>

              {/* Context menu */}
              {contextMenu?.messageId === msg.id && (
                <div
                  className={`absolute z-50 bg-white rounded-xl shadow-xl border border-[#E8E0D5] py-1 min-w-[140px] ${
                    isMine ? 'right-12' : 'left-12'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => { setReplyingTo(msg); setContextMenu(null); textareaRef.current?.focus(); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[#2C1810] hover:bg-[#F5F0E8]"
                  >
                    ↩ Reply
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(msg.bodyHtml.replace(/<[^>]*>/g, ''));
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[#2C1810] hover:bg-[#F5F0E8]"
                  >
                    Copy
                  </button>
                  {isMine && !msg.isDeleted && (
                    <>
                      <div className="border-t border-[#E8E0D5] my-1" />
                      <button
                        type="button"
                        onClick={() => void handleDelete(msg.id)}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50"
                      >
                        <Trash2 size={13} />
                        Delete
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Typing indicator */}
        {typingName && <TypingIndicator name={typingName} />}

        <div ref={bottomRef} />
      </div>

      {/* Upload error */}
      {uploadError && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-sm text-red-600">
          {uploadError} — <button type="button" className="underline" onClick={() => setUploadError(null)}>dismiss</button>
        </div>
      )}

      {/* Reply preview strip */}
      {replyingTo && (
        <div className="px-4 py-2 bg-white border-t border-[#E8E0D5] flex items-start gap-2 shrink-0">
          <div className="flex-1 border-l-[3px] border-[#F0D080] pl-2">
            <p className="text-[10px] text-[#92650A] font-medium mb-0.5">
              Replying to {replyingTo.senderName}
            </p>
            <p className="text-xs text-[#44403C] truncate">
              {replyingTo.bodyHtml.replace(/<[^>]*>/g, '').slice(0, 60)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="text-[#8B7355] hover:text-[#2C1810] text-lg leading-none shrink-0"
          >
            ×
          </button>
        </div>
      )}

      {/* Compose bar */}
      <div className="px-3 py-2.5 border-t border-[#E8E0D5] bg-white shrink-0">
        <div className="flex items-end gap-2">
          {/* Image picker */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-[#8B7355] hover:text-[#2C1810] transition-colors shrink-0 pb-1.5"
          >
            {uploading ? <Spinner /> : <ImageIcon size={20} />}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImageFile(file);
              e.target.value = '';
            }}
          />

          {/* Text input */}
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={handleDraftChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            onBlur={() => getSocket()?.emit('comms:typing_stop', { conversationId: conversation.id })}
            placeholder="Message…"
            rows={1}
            className="flex-1 resize-none rounded-2xl border border-[#E8E0D5] px-3 py-2 text-sm text-[#2C1810] placeholder:text-[#C4B49A] focus:outline-none focus:ring-1 focus:ring-[#2C1810] bg-[#FAFAF8] overflow-hidden"
            style={{ minHeight: '38px', maxHeight: '120px' }}
          />

          {/* Send / Mic button */}
          {draft.trim() ? (
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={sending}
              className="w-10 h-10 rounded-full bg-[#2C1810] flex items-center justify-center text-white shrink-0 hover:bg-[#3D2318] transition-colors disabled:opacity-50"
            >
              <Send size={16} />
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="w-10 h-10 rounded-full bg-[#EDE7DC] flex items-center justify-center text-[#8B7355] shrink-0"
            >
              <Mic size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Image lightbox */}
      <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  );
}

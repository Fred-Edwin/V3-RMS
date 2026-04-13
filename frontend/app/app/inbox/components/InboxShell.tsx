'use client';

import { useCallback, useEffect, useState } from 'react';
import { Megaphone, FileText, MessageCircle, PenLine } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useCommsStore } from '@/store/commsStore';
import { commsService } from '@/services/commsService';
import type { DirectConversationRecord, BroadcastRecord, FormalNoticeRecord } from '@/types/comms';
import type { StaffDto } from '@/services/staffService';

import { ConversationList } from './ConversationList';
import { BroadcastList } from './BroadcastList';
import { NoticeList } from './NoticeList';
import { MessageThread } from './MessageThread';
import { BroadcastDetailSheet } from './BroadcastDetailSheet';
import { NoticeDetailSheet } from './NoticeDetailSheet';
import { ComposeBroadcastModal } from './ComposeBroadcastModal';
import { IssueNoticeModal } from './IssueNoticeModal';
import { ContactPickerSheet } from './ContactPickerSheet';

type Tab = 'messages' | 'broadcasts' | 'notices';
type DetailView =
  | 'message-thread'
  | 'broadcast-detail'
  | 'notice-detail'
  | 'contact-picker'
  | 'compose-broadcast'
  | 'issue-notice';

// ── Avatar helpers (exported for ConversationList + MessageThread) ─────────────

const AVATAR_COLOURS = [
  'bg-[#F6D860] text-[#2C1810]',
  'bg-[#86EFAC] text-[#1A6B3C]',
  'bg-[#93C5FD] text-[#1E3A5F]',
  'bg-[#FCA5A5] text-[#7F1D1D]',
  'bg-[#C4B5FD] text-[#4C1D95]',
  'bg-[#6EE7B7] text-[#065F46]',
];

export function avatarColour(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLOURS[Math.abs(hash) % AVATAR_COLOURS.length]!;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// ── Tab config ────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; Icon: typeof Megaphone }[] = [
  { id: 'broadcasts', label: 'Broadcasts', Icon: Megaphone },
  { id: 'notices',    label: 'Notices',    Icon: FileText },
  { id: 'messages',  label: 'Messages',   Icon: MessageCircle },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function InboxShell() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role);

  const unreadDmCount        = useCommsStore((s) => s.unreadDmCount);
  const unreadBroadcastCount = useCommsStore((s) => s.unreadBroadcastCount);
  const unreadNoticeCount    = useCommsStore((s) => s.unreadNoticeCount);
  const resetUnreadDm        = useCommsStore((s) => s.resetUnreadDm);
  const resetUnreadBroadcast = useCommsStore((s) => s.resetUnreadBroadcast);
  const resetUnreadNotice    = useCommsStore((s) => s.resetUnreadNotice);
  const setActiveConversationId = useCommsStore((s) => s.setActiveConversationId);

  const [activeTab, setActiveTab]           = useState<Tab>('messages');
  const [detailView, setDetailView]         = useState<DetailView | null>(null);
  const [activeConversation, setActiveConversation] = useState<DirectConversationRecord | null>(null);
  const [selectedBroadcast, setSelectedBroadcast]   = useState<BroadcastRecord | null>(null);
  const [selectedNotice, setSelectedNotice]         = useState<FormalNoticeRecord | null>(null);
  const [broadcastListKey, setBroadcastListKey]     = useState(0);
  const [noticeListKey, setNoticeListKey]           = useState(0);
  const [contactPickerError, setContactPickerError] = useState<string | null>(null);

  // Use JS-based breakpoint so only ONE layout tree is mounted at a time.
  // CSS dual-DOM (md:hidden / hidden md:flex) causes shared JSX to mount in
  // the first (hidden) tree, leaving the visible tree with empty slots.
  const [isMobile, setIsMobile] = useState(true); // start mobile to avoid flash on SSR
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    setIsMobile(!mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(!e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const canSendBroadcast = role === 'MANAGER' || role === 'DIRECTOR';
  const canIssueNotice   = role === 'DIRECTOR';

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setDetailView(null);
    if (tab === 'messages')   resetUnreadDm();
    if (tab === 'broadcasts') resetUnreadBroadcast();
    if (tab === 'notices')    resetUnreadNotice();
  };

  const handleSelectConversation = (conv: DirectConversationRecord) => {
    setActiveConversation(conv);
    setActiveConversationId(conv.id);
    setDetailView('message-thread');
  };

  const handleSelectBroadcast = (b: BroadcastRecord) => {
    setSelectedBroadcast(b);
    setDetailView('broadcast-detail');
  };

  const handleSelectNotice = (n: FormalNoticeRecord) => {
    setSelectedNotice(n);
    setDetailView('notice-detail');
  };

  const closeDetail = () => {
    setDetailView(null);
    setActiveConversationId(null);
    setContactPickerError(null);
  };

  const handleContactSelected = useCallback(
    async (person: StaffDto) => {
      if (!accessToken) return;
      setContactPickerError(null);
      try {
        const conv = await commsService.getOrCreateConversation(accessToken, person.id);
        setDetailView(null);
        setActiveConversation(conv);
        setActiveConversationId(conv.id);
        setDetailView('message-thread');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not start conversation';
        setContactPickerError(msg);
      }
    },
    [accessToken, setActiveConversationId],
  );

  // FAB always visible when the tab supports compose for this role
  const fabVisible =
    activeTab === 'messages' ||
    (activeTab === 'broadcasts' && canSendBroadcast) ||
    (activeTab === 'notices' && canIssueNotice);

  const FabIcon = activeTab === 'broadcasts' ? Megaphone : activeTab === 'notices' ? FileText : PenLine;

  const handleFabClick = () => {
    if (activeTab === 'messages')   setDetailView('contact-picker');
    if (activeTab === 'broadcasts') setDetailView('compose-broadcast');
    if (activeTab === 'notices')    setDetailView('issue-notice');
  };

  // Unread counts per tab
  const unreadForTab = (tab: Tab) =>
    tab === 'messages' ? unreadDmCount : tab === 'broadcasts' ? unreadBroadcastCount : unreadNoticeCount;

  // Slide-in open state
  const slideOpen = (view: DetailView) => detailView === view;

  // Desktop: compose panel open when any compose view active
  const desktopComposeOpen =
    detailView === 'contact-picker' ||
    detailView === 'compose-broadcast' ||
    detailView === 'issue-notice';


  if (isMobile) {
    return (
      <div className="flex flex-col h-[100dvh] relative bg-[#F5F0E8]">
        {/* Header */}
        <div className="bg-[#2C1810] px-4 py-3 shrink-0">
          <h1 className="text-lg font-bold text-[#F5F0E8]">Inbox</h1>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-[#E8E0D5] bg-white shrink-0">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} type="button" onClick={() => handleTabChange(id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 relative transition-colors ${activeTab === id ? 'text-[#2C1810]' : 'text-[#8B7355] hover:text-[#44403C]'}`}>
              <div className="relative">
                <Icon size={18} />
                {unreadForTab(id) > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 rounded-full bg-[#2C1810] text-[#F5F0E8] text-[10px] font-bold flex items-center justify-center px-1">
                    {unreadForTab(id) > 99 ? '99+' : unreadForTab(id)}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-medium">{label}</span>
              {activeTab === id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2C1810] rounded-t-full" />}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'messages' && <ConversationList activeConversationId={activeConversation?.id ?? null} onSelect={handleSelectConversation} />}
          {activeTab === 'broadcasts' && <BroadcastList key={broadcastListKey} onSelect={handleSelectBroadcast} />}
          {activeTab === 'notices' && <NoticeList key={noticeListKey} onSelect={handleSelectNotice} />}
        </div>

        {/* FAB */}
        {fabVisible && (
          <button type="button" onClick={handleFabClick}
            className="absolute bottom-6 right-5 z-30 w-14 h-14 rounded-full bg-[#2C1810] shadow-lg flex items-center justify-center text-white hover:bg-[#3D2318] active:scale-95 transition-all"
            style={{ boxShadow: '0 4px 12px rgba(44,24,16,0.35)' }}>
            <FabIcon size={22} />
          </button>
        )}

        {/* Slide-in: Message thread */}
        <div className={`fixed inset-0 z-40 bg-[#F5F0E8] flex flex-col transition-transform duration-300 ease-out ${slideOpen('message-thread') ? 'translate-x-0' : 'translate-x-full'}`}>
          {activeConversation && <MessageThread conversation={activeConversation} onBack={closeDetail} />}
        </div>

        {/* Slide-in: Broadcast detail */}
        <div className={`fixed inset-0 z-40 bg-[#F5F0E8] flex flex-col transition-transform duration-300 ease-out ${slideOpen('broadcast-detail') ? 'translate-x-0' : 'translate-x-full'}`}>
          <BroadcastDetailSheet broadcast={slideOpen('broadcast-detail') ? selectedBroadcast : null} onClose={closeDetail} />
        </div>

        {/* Slide-in: Notice detail */}
        <div className={`fixed inset-0 z-40 bg-[#F5F0E8] flex flex-col transition-transform duration-300 ease-out ${slideOpen('notice-detail') ? 'translate-x-0' : 'translate-x-full'}`}>
          <NoticeDetailSheet notice={slideOpen('notice-detail') ? selectedNotice : null} onClose={closeDetail} />
        </div>

        {/* Slide-in: Contact picker */}
        <div className={`fixed inset-0 z-40 bg-[#F5F0E8] flex flex-col transition-transform duration-300 ease-out ${slideOpen('contact-picker') ? 'translate-x-0' : 'translate-x-full'}`}>
          <ContactPickerSheet isOpen={slideOpen('contact-picker')} onClose={closeDetail} onSelect={(p) => { void handleContactSelected(p); }} error={contactPickerError} onClearError={() => setContactPickerError(null)} />
        </div>

        {/* Slide-in: Compose broadcast */}
        <div className={`fixed inset-0 z-40 bg-[#F5F0E8] flex flex-col transition-transform duration-300 ease-out ${slideOpen('compose-broadcast') ? 'translate-x-0' : 'translate-x-full'}`}>
          <ComposeBroadcastModal isOpen={slideOpen('compose-broadcast')} onClose={closeDetail} onSent={() => { setBroadcastListKey((k) => k + 1); closeDetail(); }} />
        </div>

        {/* Slide-in: Issue notice */}
        <div className={`fixed inset-0 z-40 bg-[#F5F0E8] flex flex-col transition-transform duration-300 ease-out ${slideOpen('issue-notice') ? 'translate-x-0' : 'translate-x-full'}`}>
          <IssueNoticeModal isOpen={slideOpen('issue-notice')} onClose={closeDetail} onIssued={() => { setNoticeListKey((k) => k + 1); closeDetail(); }} />
        </div>
      </div>
    );
  }

  // ── DESKTOP (≥ 768px) ────────────────────────────────────────────────────────
  return (
    <div className="flex h-[100dvh] bg-[#F5F0E8]">
      {/* Left pane — relative so absolute compose panel is anchored here */}
      <div className="w-[360px] shrink-0 flex flex-col border-r border-[#E8E0D5] bg-white relative overflow-hidden">
        {/* Header */}
        <div className="bg-[#2C1810] px-4 py-3 shrink-0">
          <h1 className="text-base font-bold text-[#F5F0E8]">Inbox</h1>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-[#E8E0D5] bg-white shrink-0">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} type="button" onClick={() => handleTabChange(id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 relative transition-colors ${activeTab === id ? 'text-[#2C1810]' : 'text-[#8B7355] hover:text-[#44403C]'}`}>
              <div className="relative">
                <Icon size={18} />
                {unreadForTab(id) > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 rounded-full bg-[#2C1810] text-[#F5F0E8] text-[10px] font-bold flex items-center justify-center px-1">
                    {unreadForTab(id) > 99 ? '99+' : unreadForTab(id)}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-medium">{label}</span>
              {activeTab === id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2C1810] rounded-t-full" />}
            </button>
          ))}
        </div>

        {/* List panel — slides out left when compose opens */}
        <div
          className="flex-1 flex flex-col overflow-hidden relative transition-transform duration-300 ease-out"
          style={{ transform: desktopComposeOpen ? 'translateX(-100%)' : 'translateX(0)' }}
        >
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'messages' && <ConversationList activeConversationId={activeConversation?.id ?? null} onSelect={handleSelectConversation} />}
            {activeTab === 'broadcasts' && <BroadcastList key={broadcastListKey} onSelect={handleSelectBroadcast} />}
            {activeTab === 'notices' && <NoticeList key={noticeListKey} onSelect={handleSelectNotice} />}
          </div>
          {fabVisible && (
            <button type="button" onClick={handleFabClick}
              className="absolute bottom-6 right-5 z-30 w-14 h-14 rounded-full bg-[#2C1810] shadow-lg flex items-center justify-center text-white hover:bg-[#3D2318] active:scale-95 transition-all"
              style={{ boxShadow: '0 4px 12px rgba(44,24,16,0.35)' }}>
              <FabIcon size={22} />
            </button>
          )}
        </div>

        {/* Compose panel — absolutely positioned over the list, slides in from right */}
        <div
          className="absolute inset-0 flex flex-col transition-transform duration-300 ease-out bg-[#F5F0E8]"
          style={{ transform: desktopComposeOpen ? 'translateX(0)' : 'translateX(100%)' }}
        >
          {detailView === 'contact-picker' && (
            <ContactPickerSheet isOpen={true} onClose={closeDetail} onSelect={(p) => { void handleContactSelected(p); }} error={contactPickerError} onClearError={() => setContactPickerError(null)} />
          )}
          {detailView === 'compose-broadcast' && (
            <ComposeBroadcastModal isOpen={true} onClose={closeDetail} onSent={() => { setBroadcastListKey((k) => k + 1); closeDetail(); }} />
          )}
          {detailView === 'issue-notice' && (
            <IssueNoticeModal isOpen={true} onClose={closeDetail} onIssued={() => { setNoticeListKey((k) => k + 1); closeDetail(); }} />
          )}
        </div>
      </div>

      {/* Right pane */}
      <div className="flex-1 flex flex-col min-w-0">
        {detailView === 'message-thread' && activeConversation ? (
          <MessageThread conversation={activeConversation} />
        ) : detailView === 'broadcast-detail' && selectedBroadcast ? (
          <BroadcastDetailSheet broadcast={selectedBroadcast} onClose={closeDetail} />
        ) : detailView === 'notice-detail' && selectedNotice ? (
          <NoticeDetailSheet notice={selectedNotice} onClose={closeDetail} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-[#F5F0E8]">
            <div className="w-20 h-20 rounded-full bg-[#E8E0D5] flex items-center justify-center">
              <MessageCircle size={36} className="text-[#C4B49A]" />
            </div>
            <p className="text-base font-semibold text-[#44403C]">Select a conversation</p>
            <p className="text-sm text-[#8B7355] text-center max-w-[220px]">
              Choose from your messages on the left to get started
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

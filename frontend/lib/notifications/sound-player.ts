import type { NotificationEventType } from './types';

const soundPathByEvent: Partial<Record<NotificationEventType, string>> = {
  'order:new': '/sounds/new-order.mp3',
  'order:claimed': '/sounds/claimed.mp3',
  'order:ready': '/sounds/claimed.mp3',
  'order:all_ready': '/sounds/all-ready.mp3',
  'order:paid': '/sounds/all-ready.mp3',
};

const audioCache = new Map<string, HTMLAudioElement>();

// Tracks whether the browser has granted autoplay permission via a user gesture.
let audioUnlocked = false;
// Holds the event type of the most recent sound that was blocked so it can be
// replayed immediately after the user unlocks audio.
let pendingSound: NotificationEventType | null = null;

const getAudio = (src: string): HTMLAudioElement => {
  const cached = audioCache.get(src);
  if (cached) {
    return cached;
  }

  const audio = new Audio(src);
  audio.preload = 'auto';
  audioCache.set(src, audio);
  return audio;
};

const playAudio = (src: string): void => {
  const audio = getAudio(src);
  audio.currentTime = 0;
  void audio.play().catch(() => {
    // Blocked by browser autoplay policy — a user gesture is required first.
  });
};

export const notificationSoundPlayer = {
  /**
   * Call this once from a user-gesture handler (e.g. a tap on the audio-unlock
   * overlay). It pre-warms all cached audio elements — satisfying the browser's
   * interaction requirement — then immediately replays any sound that was
   * blocked before the unlock.
   */
  unlock: (): void => {
    if (typeof window === 'undefined' || audioUnlocked) {
      return;
    }

    audioUnlocked = true;

    // Pre-warm every sound file so subsequent plays are instant.
    for (const src of Object.values(soundPathByEvent)) {
      if (src) {
        const audio = getAudio(src);
        // Play then immediately pause — this satisfies the browser gesture
        // requirement and keeps all audio elements in a "ready" state.
        void audio.play().then(() => {
          audio.pause();
          audio.currentTime = 0;
        }).catch(() => { /* ignore */ });
      }
    }

    // Replay any sound that arrived before the user tapped.
    if (pendingSound) {
      const src = soundPathByEvent[pendingSound];
      pendingSound = null;
      if (src) {
        // Short delay to let the pre-warm settle.
        setTimeout(() => { playAudio(src); }, 150);
      }
    }
  },

  isUnlocked: (): boolean => audioUnlocked,

  play: (eventType: NotificationEventType): void => {
    if (typeof window === 'undefined') {
      return;
    }

    const src = soundPathByEvent[eventType];
    if (!src) {
      return;
    }

    if (!audioUnlocked) {
      // Queue the most recent blocked sound so it plays right after unlock.
      pendingSound = eventType;
      return;
    }

    playAudio(src);
  },
};

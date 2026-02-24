import type { NotificationEventType } from './types';

const soundPathByEvent: Partial<Record<NotificationEventType, string>> = {
  'order:new': '/sounds/new-order.mp3',
  'order:claimed': '/sounds/claimed.mp3',
  'order:all_ready': '/sounds/all-ready.mp3',
};

const audioCache = new Map<string, HTMLAudioElement>();

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

export const notificationSoundPlayer = {
  play: (eventType: NotificationEventType): void => {
    if (typeof window === 'undefined') {
      return;
    }

    const src = soundPathByEvent[eventType];
    if (!src) {
      return;
    }

    const audio = getAudio(src);
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Best-effort only: playback can be blocked by browser policies.
    });
  },
};

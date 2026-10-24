/**
 * Avatar helpers. A person's tile colour is chosen from their name, so the same
 * person looks the same on every screen. The four tiles are the ones drawn on
 * the Employees list (Paper R3E-0) and the phone Home stack (QJ9-0).
 */

/** "Joy Chebet" -> "JC"; one word -> first two letters; empty -> "?". */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface AvatarTone {
  key: 'espresso-200' | 'caramel-300' | 'espresso-400' | 'caramel-700';
  /** Background and text classes (design tokens only). */
  className: string;
}

const TONES: AvatarTone[] = [
  { key: 'espresso-200', className: 'bg-wds-espresso-200 text-wds-espresso-800' },
  { key: 'caramel-300', className: 'bg-wds-caramel-300 text-wds-espresso-800' },
  { key: 'espresso-400', className: 'bg-wds-espresso-400 text-wds-canvas' },
  { key: 'caramel-700', className: 'bg-wds-caramel-700 text-wds-canvas' },
];

/** Stable pick: same name, same tile, on every render and every screen. */
export function avatarTone(name: string): AvatarTone {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return TONES[hash % TONES.length];
}

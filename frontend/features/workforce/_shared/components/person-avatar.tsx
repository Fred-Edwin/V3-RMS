import * as React from 'react';

import { cn } from '@/lib/cn';

import { avatarTone, initialsOf } from '../lib/avatar';

/**
 * Person avatar — initials on a warm tile, or a photo. Paper: Employees list
 * R3E-0 (34 px, 12 px initials), employee file 11LC-0 (60 px, 21 px initials),
 * phone Home QJ9-0 (24 px stack with a 2 px white ring, overlapping by 8 px).
 *
 * The tile colour comes from the name, so a person is the same colour on every
 * screen. The presence dot is the phone Home's 7 px status dot, here placed on
 * the avatar corner (built beyond Paper, see the README).
 */
export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

const sizeClass: Record<AvatarSize, { box: string; text: string; dot: string }> = {
  xs: { box: 'h-6 w-6', text: 'text-[10px] leading-3', dot: 'h-[7px] w-[7px]' },
  sm: { box: 'h-[34px] w-[34px]', text: 'text-[12px] leading-4 font-medium', dot: 'h-[9px] w-[9px]' },
  md: { box: 'h-12 w-12', text: 'text-[16px] leading-5 font-medium', dot: 'h-[11px] w-[11px]' },
  lg: { box: 'h-[60px] w-[60px]', text: 'text-[21px] leading-[26px]', dot: 'h-3 w-3' },
};

export type Presence = 'on' | 'late' | 'off';

const presenceClass: Record<Presence, string> = {
  on: 'bg-wds-success-fg',
  late: 'bg-wds-warning-fg',
  off: 'bg-wds-neutral-400',
};
const presenceLabel: Record<Presence, string> = { on: 'On shift', late: 'Late', off: 'Not in' };

export interface PersonAvatarProps {
  name: string;
  size?: AvatarSize;
  /** Photo URL. If it is missing or fails, the initials show. */
  photoUrl?: string | null;
  presence?: Presence;
  /** White ring, used when avatars overlap in a stack. */
  ringed?: boolean;
  className?: string;
}

export function PersonAvatar({ name, size = 'sm', photoUrl, presence, ringed, className }: PersonAvatarProps) {
  const tone = avatarTone(name);
  const s = sizeClass[size];
  const [photoFailed, setPhotoFailed] = React.useState(false);
  const showPhoto = Boolean(photoUrl) && !photoFailed;
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <span
        role="img"
        aria-label={presence ? `${name}, ${presenceLabel[presence]}` : name}
        className={cn(
          'inline-flex items-center justify-center overflow-hidden rounded-full font-wds-sans',
          s.box,
          s.text,
          ringed && 'border-2 border-white',
          !showPhoto && tone.className
        )}
      >
        {showPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatars are small, remote and may fail; a plain img lets us fall back to initials
          <img src={photoUrl ?? ''} alt="" className="h-full w-full object-cover" onError={() => setPhotoFailed(true)} />
        ) : (
          <span aria-hidden>{initialsOf(name)}</span>
        )}
      </span>
      {presence ? (
        <span
          aria-hidden
          className={cn(
            'absolute -bottom-px -right-px rounded-full border-2 border-white',
            s.dot,
            presenceClass[presence]
          )}
        />
      ) : null}
    </span>
  );
}

/** Overlapping avatars with a "+4" count (phone Home, "Service team today"). */
export function AvatarStack({ names, max = 5, size = 'xs' }: { names: string[]; max?: number; size?: AvatarSize }) {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <div className="flex items-center" role="group" aria-label={`${names.length} people`}>
      {shown.map((n, i) => (
        <PersonAvatar key={`${n}-${i}`} name={n} size={size} ringed className={i > 0 ? '-ml-2' : undefined} />
      ))}
      {rest > 0 ? <span className="ml-2 font-wds-mono text-[11px] leading-[14px] text-wds-text-secondary">+{rest}</span> : null}
    </div>
  );
}

/** The Home status dot with its mono label: "● ON SHIFT". */
export function PresenceDot({ presence, label }: { presence: Presence; label?: string }) {
  const tone = presence === 'on' ? 'text-wds-success-fg' : presence === 'late' ? 'text-wds-warning-fg' : 'text-wds-text-secondary';
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-wds-mono text-[11px] leading-[14px] tracking-[0.04em]', tone)}>
      <span aria-hidden className={cn('h-[7px] w-[7px] rounded-full', presenceClass[presence])} />
      {(label ?? presenceLabel[presence]).toUpperCase()}
    </span>
  );
}

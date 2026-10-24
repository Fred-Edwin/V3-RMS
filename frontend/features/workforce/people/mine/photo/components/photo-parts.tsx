'use client';

import * as React from 'react';

import { initialsOf } from '../../../../_shared/lib/style/avatar';
import type { PickedPhoto } from '../hooks/use-photo-flow';

const GRADIENT = 'linear-gradient(145deg, #E9CFAE 0%, #C99A68 100%)';
export const PHOTO_CARD = 'flex items-center gap-4 border border-wds-border bg-white p-[18px] shadow-[0_10px_24px_-18px_#1715122E]';

/** The 68 px avatar of frames 8.4, 8.6, 13.4 and 13.6: the chosen photo if there is one, otherwise initials, ringed in amber. */
export function RingAvatar({ name, url, plus = false }: { name: string; url?: string; plus?: boolean }) {
  return (
    <span className="relative h-[68px] w-[68px] shrink-0">
      <span className="flex h-[68px] w-[68px] items-center justify-center overflow-hidden rounded-full font-wds-sans text-[22px] font-medium leading-7 text-[#4E2C14] shadow-[0_0_0_2px_#FFFFFF,0_0_0_3px_#B5823E]" style={{ backgroundImage: GRADIENT }}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local preview of a file the person just chose
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden>{initialsOf(name)}</span>
        )}
      </span>
      {plus ? (
        <span aria-hidden className="absolute -bottom-0.5 -right-0.5 flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 border-white bg-wds-primary font-wds-sans text-[13px] leading-4 text-wds-canvas">
          +
        </span>
      ) : null}
    </span>
  );
}

/** The card that says which photo was picked: "Pick a photo of your face" before, "The photo you chose" after a failed save. */
export function PhotoCard({ name, url, title, line, plus }: { name: string; url?: string; title: string; line: string; plus?: boolean }) {
  return (
    <div className={PHOTO_CARD}>
      <RingAvatar name={name} url={url} plus={plus} />
      <div className="flex flex-col gap-[3px]">
        <span className="font-wds-sans text-[15px] font-semibold leading-[18px] text-wds-text-ink">{title}</span>
        <span className="font-wds-sans text-[12px] leading-[17px] text-wds-text-secondary">{line}</span>
      </div>
    </div>
  );
}

/** The line under "The photo you chose" once it failed to save: where it came from and how big it is. */
export function chosenLine(source: PickedPhoto | null, from: string): string {
  return `${from}${source ? ` · ${(source.file.size / 1_000_000).toFixed(1)} MB` : ''}`;
}

/** The red block of frames 8.6 and 13.6. The reference lets HR find the failure in the log. */
export function SaveFailed({ reference }: { reference?: string | null }) {
  return (
    <div role="alert" className="flex items-start gap-3 border border-l-[3px] border-[#E3B8AE] border-l-[#A8321C] bg-[#FBEDEA] px-4 py-3.5">
      <span aria-hidden className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#A8321C] font-wds-sans text-[12px] font-semibold leading-[14px] text-white">!</span>
      <div className="flex min-w-0 flex-col gap-1 text-[#7A2210]">
        <span className="font-wds-sans text-[14px] font-semibold leading-[18px]">We could not save your photo</span>
        <span className="font-wds-sans text-[13px] leading-[18px]">
          {reference ? (
            <>
              Try again, or tell HR <span className="font-wds-mono">{reference}</span>.
            </>
          ) : (
            'Try again, or tell HR.'
          )}
        </span>
      </div>
    </div>
  );
}

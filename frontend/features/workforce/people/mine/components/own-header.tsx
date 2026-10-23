'use client';

import * as React from 'react';

import { PersonAvatar } from '../../../_shared';
import type { EmployeeFile } from '../../_shared/types/people-types';
import { finishProgress } from '../lib/own-file';

/**
 * The identity header of My file (frames 13.3 and 13.14): a 72 px avatar, the name (26 px), "position · site", and how far the file is
 * on the right ("2 OF 4"). On a phone the progress drops under the name. "Change my photo" sits under the position once there is a
 * photo (frame 13.3 draws no such link; the Add row in "Still to finish" covers the first photo).
 */
export function OwnHeader({ file, onPhoto }: { file: EmployeeFile; onPhoto: () => void }) {
  const { done, total } = finishProgress(file);
  return (
    <header className="flex flex-wrap items-center gap-x-[18px] gap-y-3 py-1">
      <PersonAvatar name={file.name} size="lg" photoUrl={file.photoUrl} />
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <h1 className="m-0 truncate font-wds-sans text-[22px] font-semibold leading-[28px] tracking-[-0.02em] text-wds-text-ink lg:text-[26px] lg:leading-8">{file.name}</h1>
        <p className="m-0 truncate font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{[file.position?.name, file.organization.name].filter(Boolean).join(' · ')}</p>
        {file.photoUrl ? (
          <button type="button" onClick={onPhoto} className="mt-1 flex h-6 w-fit items-center border-0 bg-transparent p-0 font-wds-sans text-[13px] font-medium leading-4 text-[#A8680A] underline decoration-1 underline-offset-[3px] outline-none focus-visible:shadow-wds-ring">
            Change my photo
          </button>
        ) : null}
      </div>
      {total > 0 ? (
        <div className="flex w-full items-center gap-2.5 lg:w-[300px] lg:flex-col lg:items-stretch lg:gap-1.5">
          <span className="hidden font-wds-mono text-[10px] leading-3 tracking-[0.08em] text-wds-text-secondary lg:block">YOUR FILE</span>
          <div role="progressbar" aria-label="File finished" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} className="h-[5px] flex-1 bg-wds-neutral-200 lg:flex-none">
            <div className="h-full bg-[#D9A65E]" style={{ width: `${(done / total) * 100}%` }} />
          </div>
          <span className="font-wds-mono text-[11px] leading-[14px] text-wds-text-secondary lg:self-end">{done} OF {total}</span>
        </div>
      ) : null}
    </header>
  );
}

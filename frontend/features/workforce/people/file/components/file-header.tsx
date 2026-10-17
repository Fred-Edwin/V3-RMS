import * as React from 'react';

import { PersonAvatar, StatusTag } from '../../../_shared';
import type { EmployeeFile } from '../../_shared/types/people-types';
import { headerLine, headerTags } from '../lib/file-model';

/**
 * The top of the file (Paper Chapter 4): the photo or initials, the name at 28 px, one grey line, and the tags at the right. The
 * exited file draws a muted avatar. Nothing here is a control; the buttons are in the top bar.
 */
export function FileHeader({ file, today }: { file: EmployeeFile; today: string }) {
  const tags = headerTags(file, today);
  const exited = file.status === 'EXITED';
  return (
    <header className="flex items-start justify-between gap-6 max-md:flex-col max-md:gap-3">
      <div className="flex min-w-0 items-center gap-4">
        <PersonAvatar name={file.name} size="lg" photoUrl={file.photoUrl} className={exited ? 'opacity-60 grayscale' : undefined} />
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className={`m-0 font-wds-sans text-[28px] font-semibold leading-8 tracking-[-0.02em] ${exited ? 'text-wds-text-secondary' : 'text-wds-text-ink'}`}>{file.name}</h1>
          <p className="m-0 font-wds-sans text-[14px] leading-[18px] text-wds-text-secondary">{headerLine(file)}</p>
        </div>
      </div>
      <ul aria-label="Status" className="m-0 flex shrink-0 list-none flex-wrap gap-2 p-0 pt-2">
        {tags.map((t) => (
          <li key={t.key}>
            <StatusTag tone={t.tone} size="header">
              {t.label}
            </StatusTag>
          </li>
        ))}
      </ul>
    </header>
  );
}

'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION, SettingRows, StatusTag, onHover, type SettingRow } from '../../_shared';
import { RuleChangeDialog } from '../change/change-dialog';
import { useOnline } from '../hooks/use-rules-data';
import { roleInSentence } from '../lib/rules-words';
import type { EditorProps, RuleRowDef } from '../tabs/tab-types';
import type { RulesPage, SavedVersion } from '../types/rules-types';
import { ChangeLink } from './change-link';

/** The "THE RULE TODAY" panel: one row per definition, its trailing slot decided by the server's answer for this viewer. */
export function RuleRows({
  defs,
  page,
  caption = 'THE RULE TODAY',
  onSaved,
  onStale,
}: {
  defs: readonly RuleRowDef[];
  page: RulesPage;
  caption?: string;
  onSaved: (saved: SavedVersion) => void;
  onStale: () => void;
}) {
  const online = useOnline();
  const [editing, setEditing] = React.useState<string | null>(null);
  const [reverting, setReverting] = React.useState<string[] | null>(null);
  const editor = defs.find((d) => d.id === editing)?.Editor;
  const Editor: React.ComponentType<EditorProps> | undefined = editor;

  const rows: SettingRow[] = defs.map((def) => {
    const answer = page.rows[def.id];
    const shown = def.value(page);
    const waiting = answer?.waitingForConfirmation ? page.pendingConfirmations[0] : undefined;
    const tags = (
      <>
        {answer?.ownRule ? <StatusTag tone="warning" size="row">Own rule</StatusTag> : null}
        {answer?.waitingForConfirmation ? (
          <StatusTag tone="warning" size="row">
            Waiting for {waiting?.whoCan[0] ? roleInSentence(waiting.whoCan[0].role) : 'confirmation'}
          </StatusTag>
        ) : null}
      </>
    );
    const slot =
      !def.Editor || !answer || answer.kind === 'FIXED' ? (
        <ChangeLink thing={def.thing} state={{ kind: 'fixed' }} />
      ) : answer.canChange ? (
        <ChangeLink thing={def.thing} state={{ kind: 'change' }} onChange={() => setEditing(def.id)} offline={!online} />
      ) : (
        <ChangeLink thing={def.thing} state={{ kind: 'locked', whoCan: answer.lockedReason?.whoCan ?? [] }} />
      );
    return {
      title: def.title,
      description: typeof def.help === 'function' ? def.help(page) : def.help,
      mono: shown.mono,
      muted: shown.muted,
      tinted: def.tinted,
      value: (
        <span className="flex items-center justify-end gap-2.5">
          {tags}
          {def.render ? def.render(page) : shown.text}
        </span>
      ),
      action: slot,
    };
  });

  const own = defs.filter((d) => page.rows[d.id]?.ownRule && page.rows[d.id]?.canChange);
  const close = (): void => {
    setEditing(null);
    setReverting(null);
  };
  const done = (saved: SavedVersion): void => onSaved(saved);

  return (
    <div className="flex flex-col gap-3">
      <SettingRows rows={rows} caption={caption} />
      {own.length > 0 && page.organizationId ? (
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          {(own.length === 1 ? [{ label: 'Use the company rule again', ids: own.map((d) => d.id) }] : [{ label: 'Use the company rule again', ids: own.map((d) => d.id) }, ...own.map((d) => ({ label: `Use the company rule again: ${d.title.toLowerCase()}`, ids: [d.id] }))]).map((b) => (
            <button
              key={b.label}
              type="button"
              disabled={!online}
              onClick={() => setReverting(b.ids)}
              className={cn('font-wds-sans text-[13px] leading-4 text-wds-info-fg disabled:opacity-60', MOTION, FOCUS_RING, onHover('underline'))}
            >
              {b.label}
            </button>
          ))}
        </div>
      ) : null}
      {Editor ? <Editor page={page} onSaved={done} onStale={onStale} onClose={close} /> : null}
      {reverting ? (
        <RuleChangeDialog
          page={page}
          title="Use the company rule again"
          helper={`${page.organizationName ?? 'This site'} gives up its own value and follows the company rule from the day you choose.`}
          pairs={[]}
          values={{}}
          useCompanyRuleFor={reverting.length === own.length ? undefined : defs.filter((d) => reverting.includes(d.id)).flatMap((d) => page.rows[d.id]?.fields ?? [])}
          onSaved={done}
          onStale={onStale}
          onClose={close}
        />
      ) : null}
    </div>
  );
}

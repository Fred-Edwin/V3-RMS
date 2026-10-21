'use client';

import { cn } from '@/lib/cn';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui2/table';

import { FOCUS_RING, roleWords } from '../../../_shared';
import { dateShort, documentLine, replacesLine, rowSpeech, statusWord } from '../lib/documents-words';
import type { DocumentItem } from '../types/documents-types';

function Highlight({ text, term }: { text: string; term: string }) {
  const t = term.trim();
  const at = t ? text.toLowerCase().indexOf(t.toLowerCase()) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <strong className="font-semibold text-wds-text-ink">{text.slice(at, at + t.length)}</strong>
      {text.slice(at + t.length)}
    </>
  );
}

/**
 * NUMBER, DOCUMENT, ABOUT, SIGNED BY, DATE (6c D2). The chosen row has the amber bar. A replaced, withdrawn or archived document says so
 * in words under its name. The number is the row's one tab stop; the row takes a click too.
 */
export function DocumentsTable({ items, term, chosen, onChoose }: { items: readonly DocumentItem[]; term: string; chosen: string | null; onChoose: (item: DocumentItem) => void }) {
  return (
    <div className="overflow-x-auto border border-wds-border bg-wds-surface">
      <Table look="workforce" aria-label="Signed documents">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[130px]">Number</TableHead>
            <TableHead>Document</TableHead>
            <TableHead className="w-[160px]">About</TableHead>
            <TableHead className="w-[170px]">Signed by</TableHead>
            <TableHead className="w-[80px]">Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((d) => {
            const key = `${d.number}.${d.version}`;
            const word = statusWord(d.status);
            const sub = replacesLine(d);
            return (
              <TableRow key={key} data-state={key === chosen ? 'selected' : undefined} onClick={() => onChoose(d)} className="cursor-pointer">
                <TableCell className="font-wds-mono text-[11px] leading-[14px] text-wds-text-ink">
                  <button type="button" aria-label={rowSpeech(d)} aria-current={key === chosen ? 'true' : undefined} onClick={(e) => { e.stopPropagation(); onChoose(d); }} className={cn('text-left', key === chosen && 'font-semibold', FOCUS_RING)}>
                    <Highlight text={d.number} term={term} />
                  </button>
                </TableCell>
                <TableCell className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">
                  <span className={cn(key === chosen && 'font-semibold')}>{documentLine({ title: d.title, version: d.version, about: '' }).replace(/ · $/, '')}</span>
                  {word || sub ? (
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
                      {word ? <span className="font-wds-mono text-[10px] tracking-[0.08em] text-wds-warning-fg">{word.toUpperCase()}</span> : null}
                      {sub}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary"><Highlight text={d.about} term={term} /></TableCell>
                <TableCell className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{roleWords(d.signedBy.role) || d.signedBy.name}</TableCell>
                <TableCell className="font-wds-mono text-[12px] leading-4 text-wds-text-secondary">{dateShort(d.signedAt)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

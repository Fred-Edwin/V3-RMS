'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { LineResultChip } from '../../_shared/components/count-chips';
import { ScwTopbar } from '../../../_shared/components/scw-topbar';
import { useCountAutosave } from '../../_shared/hooks/use-count-autosave';
import { clockLabel, dayClockLabel, plainQty, showQty, signedMoney, signedPercent, signedQty } from '../../_shared/lib/count-format';
import type { CountDetail, LineResult, SaveLinesResult } from '../../_shared/types/counting-contract';
import { SignOwnDialog } from './sign-own-dialog';

const COUNTS = '/app/inventory/stock/counts';

interface Live {
  text: string;
  skipped: boolean;
  result: LineResult;
  difference: string | null;
  valueKes: string | null;
  recheck: 'NONE' | 'RECOUNTED' | 'KEPT';
  first: string;
}

/**
 * Counting with expected stock, for a person who holds `restock.read` and counts herself (Paper step 13, `1YP3-0`; the sign dialog
 * is step 14). The table shows expected stock, a box for your count, the difference, its value and a live result against the range
 * for every line. Enter saves and moves to the next box; Tab skips (an empty box becomes "Skipped"); the numbers save quietly
 * ("Saved 11:20") and a failed save keeps them on screen with Try again. "Recount" on an outside-range line lets the number be typed
 * again once. "Review and sign" opens the sign dialog. This screen is chosen by the response having stock figures, never by a role.
 */
export function ManagerCountScreen({ initial }: { initial: CountDetail }) {
  const router = useRouter();
  const [live, setLive] = React.useState<Record<string, Live>>(() =>
    Object.fromEntries(
      initial.lines.map((l) => [
        l.id,
        {
          text: showQty(l.countedQty),
          skipped: l.skipped,
          result: l.result ?? 'NOT_YET',
          difference: l.difference ?? null,
          valueKes: l.differenceValueKes ?? null,
          recheck: l.recheck,
          first: showQty(l.firstCountedQty),
        } satisfies Live,
      ]),
    ),
  );
  const [recounting, setRecounting] = React.useState<Set<string>>(new Set());
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [signing, setSigning] = React.useState(false);
  const inputs = React.useRef(new Map<string, HTMLInputElement>());
  const lines = React.useMemo(() => [...initial.lines].sort((a, b) => a.position - b.position), [initial.lines]);

  const onResult = React.useCallback((res: SaveLinesResult): void => {
    if (!res.lines) return;
    setLive((all) => {
      const next = { ...all };
      for (const r of res.lines ?? []) {
        const cur = next[r.lineId];
        if (cur) next[r.lineId] = { ...cur, result: r.result ?? cur.result, difference: r.difference ?? null, valueKes: r.differenceValueKes ?? null };
      }
      return next;
    });
  }, []);
  const autosave = useCountAutosave(initial.id, onResult, initial.savedAt);

  const focusNext = (id: string): void => {
    const index = lines.findIndex((l) => l.id === id);
    const nextId = lines[index + 1]?.id;
    if (nextId) inputs.current.get(nextId)?.focus();
  };

  const write = (id: string, text: string, skipped: boolean): void => {
    const cur = live[id];
    if (!cur) return;
    const isRecount = recounting.has(id) && text !== '';
    const kept = isRecount && text === cur.first;
    setLive((all) => ({
      ...all,
      [id]: {
        ...cur,
        text,
        skipped,
        result: text === '' ? (skipped ? 'NOT_COUNTED' : 'NOT_YET') : cur.result,
        ...(text === '' ? { difference: null, valueKes: null } : {}),
        ...(isRecount ? { recheck: kept ? ('KEPT' as const) : ('RECOUNTED' as const), first: cur.first || cur.text } : {}),
      },
    }));
    autosave.save({
      lineId: id,
      countedQty: text === '' ? null : text,
      skipped,
      ...(isRecount ? { recheck: kept ? ('KEPT' as const) : ('RECOUNTED' as const) } : {}),
    });
  };

  const values = Object.values(live);
  const counted = values.filter((v) => v.text !== '').length;
  const skipped = values.filter((v) => v.skipped).length;
  const over = values.filter((v) => v.result === 'EXCEEDS').length;
  const pct = lines.length === 0 ? 0 : Math.round((counted / lines.length) * 100);
  const percentOf = (l: CountDetail['lines'][number], v: Live): string | null => {
    if (v.difference === null || l.expectedQty === undefined || Number(l.expectedQty) === 0) return null;
    return signedPercent(String((Number(v.difference) / Number(l.expectedQty)) * 100));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ScwTopbar
        search={false}
        breadcrumb={{ root: 'Central Store', section: 'Counts', sectionHref: COUNTS, screen: initial.reference }}
        actions={
          <span role="status" aria-live="polite" className="font-wds-mono text-[12px] leading-4 text-wds-text-secondary">
            {autosave.status === 'failed' ? (
              <span className="text-wds-error-fg">
                Not saved ·{' '}
                <button type="button" onClick={() => void autosave.retry()} className="font-medium underline underline-offset-2 outline-none focus-visible:shadow-wds-ring">
                  Try again
                </button>
              </span>
            ) : autosave.status === 'saving' ? (
              'Saving…'
            ) : autosave.savedAt ? (
              `Saved ${clockLabel(autosave.savedAt)}`
            ) : null}
          </span>
        }
      />
      <main className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-8 pt-7">
        {autosave.status === 'failed' && autosave.error ? (
          <p role="alert" className="border border-wds-error-border bg-wds-error-bg px-4 py-2.5 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">
            {autosave.error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="font-wds-sans text-wds-mobile-title tracking-tight text-wds-text-ink">Counting {initial.sections.map((s) => s.name).join(', ')}</h1>
            <p className="font-wds-sans text-[13px] leading-[19px] text-wds-text-secondary">Your count · started {dayClockLabel(initial.startedAt).split(' ').slice(-1)[0]} · expected stock is shown so you can check as you go</p>
          </div>
          <div className="flex w-[260px] shrink-0 flex-col gap-1.5">
            <div className="flex justify-between font-wds-mono text-[11px] uppercase leading-[14px] text-wds-text-secondary">
              <span>
                {counted} of {lines.length}
              </span>
              <span>{skipped} skipped</span>
            </div>
            <div className="flex h-1 bg-wds-neutral-100" role="progressbar" aria-label="Count progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
              <div className="bg-wds-selected-edge motion-safe:transition-[width] motion-safe:duration-200" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] table-fixed border-collapse">
            <caption className="sr-only">Lines to count. Type your count in each box. Enter saves and moves to the next box. Tab skips.</caption>
            <colgroup>
              <col style={{ width: 250 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 160 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 120 }} />
              <col />
            </colgroup>
            <thead>
              <tr className="h-[34px] border-b border-t border-b-wds-border border-t-wds-text-ink bg-wds-surface font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">
                <th className="pl-4 text-left font-normal">Item</th>
                <th className="text-right font-normal">Expected</th>
                <th className="pr-1 text-right font-normal">Your count</th>
                <th className="text-right font-normal">Difference</th>
                <th className="text-right font-normal">Value</th>
                <th className="pl-8 text-left font-normal">Result</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const v = live[line.id] as Live;
                const active = activeId === line.id;
                const exceeds = v.result === 'EXCEEDS';
                const neg = v.difference !== null && Number(v.difference) < 0;
                return (
                  <tr key={line.id} className={cn('border-b border-wds-neutral-100 bg-wds-surface', active ? 'h-15 bg-wds-espresso-50' : 'h-14')}>
                    <td className="pl-4">
                      <div className="flex flex-col">
                        <span className={cn('font-wds-sans text-[14px] leading-5 text-wds-text-ink', active ? 'font-semibold' : 'font-medium')}>{line.itemName}</span>
                        <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{line.unit}</span>
                      </div>
                    </td>
                    <td className="text-right font-wds-mono text-[13px] leading-4 text-wds-text-secondary">{plainQty(line.expectedQty ?? null)}</td>
                    <td className="pr-1">
                      <div className="flex justify-end">
                        {v.skipped ? (
                          <button
                            type="button"
                            onClick={() => {
                              inputs.current.get(line.id)?.focus();
                              write(line.id, '', false);
                            }}
                            className="flex h-9 w-[84px] items-center justify-center border border-dashed border-wds-border-strong font-wds-sans text-[12px] leading-4 text-wds-text-faint outline-none hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring"
                            aria-label={`${line.itemName} skipped. Count it`}
                          >
                            Skipped
                          </button>
                        ) : (
                          <input
                            ref={(el) => {
                              if (el) inputs.current.set(line.id, el);
                              else inputs.current.delete(line.id);
                            }}
                            inputMode="decimal"
                            autoComplete="off"
                            aria-label={`${line.itemName}, ${line.unit}. Your count`}
                            value={v.text}
                            onFocus={() => setActiveId(line.id)}
                            onBlur={() => setActiveId((a) => (a === line.id ? null : a))}
                            onChange={(e) => {
                              const next = e.target.value.replace(',', '.');
                              if (!/^\d*\.?\d{0,4}$/.test(next)) return;
                              write(line.id, next, false);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void autosave.flush();
                                focusNext(line.id);
                              } else if (e.key === 'Tab' && !e.shiftKey) {
                                const next = lines[lines.findIndex((l) => l.id === line.id) + 1];
                                if (next) {
                                  e.preventDefault();
                                  if (v.text === '') write(line.id, '', true);
                                  inputs.current.get(next.id)?.focus();
                                }
                              }
                            }}
                            className={cn(
                              'w-[84px] bg-wds-surface px-2.5 text-right font-wds-mono text-wds-text-ink outline-none transition-[border-color,box-shadow] duration-100',
                              active ? 'h-10 border-[1.5px] border-wds-selected-edge text-[16px] leading-5 shadow-wds-ring' : v.text === '' ? 'h-9 border border-wds-border text-[15px] leading-5 hover:border-wds-border-strong' : 'h-9 border border-wds-border-strong text-[15px] leading-5',
                            )}
                          />
                        )}
                      </div>
                    </td>
                    <td className="text-right">
                      {v.difference !== null ? (
                        <div className="flex flex-col items-end">
                          <span className={cn('font-wds-mono text-[13px] leading-4', Number(v.difference) === 0 ? 'text-wds-text-faint' : exceeds ? 'text-wds-error-fg' : 'text-wds-text-ink')}>
                            {Number(v.difference) === 0 ? '0' : signedQty(v.difference, line.unit)}
                          </span>
                          {Number(v.difference) !== 0 ? <span className="font-wds-mono text-[11px] leading-[14px] text-wds-text-secondary">{percentOf(line, v)}</span> : null}
                        </div>
                      ) : null}
                    </td>
                    <td className={cn('text-right font-wds-mono text-[13px] leading-4', v.valueKes === null || Number(v.valueKes) === 0 ? 'text-wds-text-faint' : exceeds && neg ? 'text-wds-error-fg' : 'text-wds-text-ink')}>
                      {v.valueKes !== null ? signedMoney(v.valueKes) : ''}
                    </td>
                    <td className="pl-8">
                      <div className="flex items-center gap-3.5">
                        {v.skipped ? (
                          <span className="font-wds-sans text-[12px] leading-4 text-wds-text-faint">Not counted</span>
                        ) : v.text !== '' ? (
                          <>
                            <LineResultChip result={v.result} override={active && exceeds && v.recheck === 'NONE' ? 'Over the range, so it will exceed' : undefined} />
                            {exceeds && v.recheck === 'NONE' && !active ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setRecounting((s) => new Set(s).add(line.id));
                                  inputs.current.get(line.id)?.focus();
                                  inputs.current.get(line.id)?.select();
                                }}
                                className="font-wds-sans text-[13px] font-medium leading-4 text-wds-selected-edge underline-offset-4 outline-none hover:underline focus-visible:shadow-wds-ring"
                              >
                                Recount<span className="sr-only"> {line.itemName}</span>
                              </button>
                            ) : v.recheck !== 'NONE' ? (
                              <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{v.recheck === 'KEPT' ? 'Rechecked, same count' : 'Rechecked'}</span>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="grow" />
        <div className="sticky bottom-0 -mx-8 flex h-17 shrink-0 items-center justify-between border-t border-wds-border-strong bg-wds-canvas px-8">
          <div className="flex flex-col gap-0.5" role="status" aria-live="polite">
            <span className="font-wds-sans text-[13px] font-medium leading-4 text-wds-text-ink">
              {counted} of {lines.length} counted · {skipped} skipped · {over} over the range
            </span>
            <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Enter saves and moves on. Tab skips. You can stop and carry on later.</span>
          </div>
          <button
            type="button"
            disabled={counted === 0 || autosave.status === 'saving'}
            title={counted === 0 ? 'Count something first' : undefined}
            onClick={async () => {
              if (await autosave.flush()) setSigning(true);
            }}
            className="flex h-10 items-center bg-wds-gradient-primary px-5 font-wds-sans text-[14px] font-semibold leading-5 text-wds-primary-fg outline-none transition-[filter,transform,box-shadow] duration-100 focus-visible:shadow-wds-ring enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:bg-wds-neutral-100 disabled:bg-none disabled:text-wds-text-muted motion-safe:enabled:active:scale-[0.99]"
          >
            Review and sign
          </button>
        </div>
      </main>
      <SignOwnDialog count={initial} open={signing} onOpenChange={setSigning} onSigned={(d) => router.replace(`${COUNTS}/${d.id}/signed`)} />
    </div>
  );
}

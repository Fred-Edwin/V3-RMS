import { cn } from '@/lib/cn';

/** The SITES column of Balances (HR sees every site): All sites, then one row per site with its head count. A button per row; the chosen one has the caramel bar. */
export function SitesPanel({ sites, chosen, onChoose }: { sites: readonly { id: string; name: string; people: number }[]; chosen: string | undefined; onChoose: (id: string | undefined) => void }) {
  const total = sites.reduce((sum, s) => sum + s.people, 0);
  const row = (id: string | undefined, name: string, line: string) => {
    const on = chosen === id;
    return (
      <li key={id ?? 'all'}>
        <button type="button" aria-current={on ? 'true' : undefined} onClick={() => onChoose(id)} className={cn('relative flex w-full flex-col items-start gap-0.5 border-b border-wds-border px-4 py-3 text-left focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_3px_color-mix(in_oklab,var(--wds-primary)_30%,transparent)]', on ? 'bg-wds-warning-bg' : 'hover:bg-wds-neutral-50')}>
          {on ? <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-wds-caramel-600" /> : null}
          <span className="font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">{name}</span>
          <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{line}</span>
        </button>
      </li>
    );
  };
  return (
    <nav aria-label="Sites">
      <h3 className="m-0 border-b border-wds-border px-4 py-3 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.08em] text-wds-text-secondary">{`SITES · ${sites.length}`}</h3>
      <ul className="m-0 list-none p-0">
        {row(undefined, 'All sites', `${total} people`)}
        {sites.map((s) => row(s.id, s.name, `${s.people} people`))}
      </ul>
    </nav>
  );
}

import { cn } from '@/lib/cn';

/**
 * The three small figures in the dark band of the staff list (Paper 2ZFG-0): a mono label over a mono value, a 1 px rule above. The
 * middle column is the amber one when it is above zero. Three columns of 110 px; they wrap to two rows on a very small phone or at large type.
 * The colours are the sidebar's dark-band tokens; Paper's rule #5B3417 has no token, so the band's divider tint is used.
 */
export function StatColumns({ columns }: { columns: ReadonlyArray<{ key: string; label: string; value: number }> }) {
  return (
    <dl aria-label="Your notices at a glance" className="m-0 mt-3 flex flex-wrap gap-x-6 gap-y-3 border-t border-[color-mix(in_oklab,var(--wds-sidebar-top)_70%,var(--wds-caramel-600))] pt-3">
      {columns.map((column, index) => (
        <div key={column.key} className="flex w-[110px] min-w-[84px] flex-col gap-0.5">
          <dt className="font-wds-mono text-[10px] leading-3 tracking-[0.08em] text-wds-sidebar-fg-item">{column.label}</dt>
          <dd className={cn('m-0 font-wds-mono text-[22px] leading-[26px]', index === 1 && column.value > 0 ? 'font-semibold text-wds-caramel-300' : 'text-wds-sidebar-fg-active')}>{column.value}</dd>
        </div>
      ))}
    </dl>
  );
}

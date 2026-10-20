/** The share of the month used for the fill and the marker, clamped to 0..100. */
export const pct = (part: number, whole: number): number => (whole > 0 ? Math.max(0, Math.min(100, (part / whole) * 100)) : 0);

/**
 * Pay earned so far against what is expected for the month (spec S10): a track, a caramel fill, and a thin ink marker for today. Both are
 * drawn from the same two numbers the text says, so the picture and the words cannot disagree. The whole bar is one image for a screen reader.
 */
export function EstimateBar({ earnedPercent, todayPercent, label }: { earnedPercent: number; todayPercent: number; label: string }) {
  return (
    <div role="img" aria-label={label} className="relative h-[18px] w-full">
      <div aria-hidden className="absolute inset-x-0 top-1 h-[10px] bg-wds-neutral-100" />
      <div aria-hidden className="absolute left-0 top-1 h-[10px] bg-wds-caramel-600" style={{ width: `${earnedPercent}%` }} />
      <div aria-hidden className="absolute top-0 h-[18px] w-[2px] bg-wds-neutral-950" style={{ left: `calc(${todayPercent}% - 1px)` }} />
    </div>
  );
}

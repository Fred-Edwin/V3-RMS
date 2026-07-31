import { useId, useMemo } from 'react';
import { cn } from '@/lib/cn';

interface SparklineProps {
  /** Prices oldest → newest. Fewer than 3 points can't show real shape (2 points is just one straight diagonal), so those render a small neutral dot instead of a misleading line. */
  values: number[];
  className?: string;
}

const WIDTH = 56;
const HEIGHT = 20;
const PADDING = 2;
const MIN_POINTS_FOR_TREND = 3;

/**
 * Minimal inline trend indicator for a price series — no axes, gridlines,
 * or tooltip (that's `PriceTrendChart`, reserved for a dedicated detail
 * view). Meant to sit inline next to a price value in a list row, per the
 * Suppliers "Items & Pricing" redesign: the row's job is name + latest
 * price; the trend is a quiet secondary cue, not a report.
 */
export function Sparkline({ values, className }: SparklineProps): JSX.Element {
  const gradientId = useId();
  const hasTrend = values.length >= MIN_POINTS_FOR_TREND;

  const { path, areaPath } = useMemo(() => {
    if (!hasTrend) return { path: null, areaPath: null };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const innerWidth = WIDTH - PADDING * 2;
    const innerHeight = HEIGHT - PADDING * 2;
    const points = values.map((v, i) => {
      const x = PADDING + (i / (values.length - 1)) * innerWidth;
      const y = PADDING + innerHeight - ((v - min) / range) * innerHeight;
      return { x, y };
    });
    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const baseline = HEIGHT - PADDING;
    const area = `${line} L ${points[points.length - 1]!.x} ${baseline} L ${points[0]!.x} ${baseline} Z`;
    return { path: line, areaPath: area };
  }, [hasTrend, values]);

  if (!hasTrend) {
    // Not enough receiving history yet to show real shape — a quiet "no
    // data" marker, not a fabricated flat line or a misleading 2-point diagonal.
    return (
      <svg
        width={WIDTH}
        height={HEIGHT}
        className={cn('shrink-0', className)}
        role="img"
        aria-label={values.length === 0 ? 'No price history yet' : 'Not enough price history for a trend'}
      >
        <circle cx={WIDTH / 2} cy={HEIGHT / 2} r={2} fill="#D6D3D1" />
      </svg>
    );
  }

  const trendColor =
    values[values.length - 1] > values[0]
      ? '#B8442E' // rising cost — quiet danger tone
      : values[values.length - 1] < values[0]
        ? '#4A7C59' // falling cost — quiet success tone
        : '#A8A29E'; // flat — neutral stone

  return (
    <svg width={WIDTH} height={HEIGHT} className={cn('shrink-0', className)} role="img" aria-label="Price trend">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={trendColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={trendColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath ?? ''} fill={`url(#${gradientId})`} stroke="none" />
      <path d={path ?? ''} fill="none" stroke={trendColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

'use client';

import { useId, useMemo, useState } from 'react';
import { cn } from '@/lib/cn';

export interface PriceTrendPoint {
  date: string;
  price: number;
  label?: string;
}

interface PriceTrendChartProps {
  points: PriceTrendPoint[];
  unit?: string;
  className?: string;
}

const WIDTH = 640;
const HEIGHT = 220;
const PADDING = { top: 16, right: 16, bottom: 28, left: 56 };

const formatKes = (value: number): string =>
  `Ksh ${value.toLocaleString('en-KE', { maximumFractionDigits: 2 })}`;

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });

/**
 * Single-series line chart for one item's price-over-time (no charting
 * library installed for Phase 1 — see INVENTORY_PHASE1_SESSION_PLAN.md
 * Session 7 gap notes). One hue (Espresso, the design system's primary
 * series color), thin 2px line, hover crosshair + tooltip, no legend
 * needed for a single series per the dataviz method.
 */
export function PriceTrendChart({ points, unit = '', className }: PriceTrendChartProps): JSX.Element {
  const gradientId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { path, areaPath, coords, minPrice, maxPrice } = useMemo(() => {
    if (points.length === 0) {
      return { path: '', areaPath: '', coords: [] as { x: number; y: number }[], minPrice: 0, maxPrice: 0 };
    }
    const prices = points.map((p) => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const innerWidth = WIDTH - PADDING.left - PADDING.right;
    const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;

    const pts = points.map((p, i) => {
      const x = PADDING.left + (points.length === 1 ? innerWidth / 2 : (i / (points.length - 1)) * innerWidth);
      const y = PADDING.top + innerHeight - ((p.price - min) / range) * innerHeight;
      return { x, y };
    });

    const linePath = pts.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
    const area = `${linePath} L ${pts[pts.length - 1].x} ${HEIGHT - PADDING.bottom} L ${pts[0].x} ${HEIGHT - PADDING.bottom} Z`;

    return { path: linePath, areaPath: area, coords: pts, minPrice: min, maxPrice: max };
  }, [points]);

  if (points.length === 0) {
    return (
      <div className={cn('flex h-[220px] items-center justify-center rounded-md border border-dashed border-stone-200 bg-stone-50', className)}>
        <p className="text-body-sm text-stone-400">No price history yet for this item.</p>
      </div>
    );
  }

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;
  const hoveredCoord = hoverIndex !== null ? coords[hoverIndex] : null;

  return (
    <div className={cn('relative', className)}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={`Price trend from ${formatKes(minPrice)} to ${formatKes(maxPrice)}`}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2C1810" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#2C1810" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Recessive gridlines */}
        {[0, 0.5, 1].map((t) => {
          const y = PADDING.top + t * (HEIGHT - PADDING.top - PADDING.bottom);
          const value = maxPrice - t * (maxPrice - minPrice);
          return (
            <g key={t}>
              <line x1={PADDING.left} y1={y} x2={WIDTH - PADDING.right} y2={y} stroke="#E8E5E1" strokeWidth={1} />
              <text x={PADDING.left - 8} y={y + 4} textAnchor="end" className="fill-stone-400 text-[10px] tabular-nums">
                {formatKes(value)}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path d={path} fill="none" stroke="#2C1810" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {coords.map((c, i) => (
          <g key={i}>
            <circle
              cx={c.x}
              cy={c.y}
              r={hoverIndex === i ? 5 : 3.5}
              fill="#2C1810"
              stroke="white"
              strokeWidth={1.5}
              className="transition-[r] duration-fast"
            />
            {/* Wider invisible hit target */}
            <rect
              x={c.x - (WIDTH / points.length) / 2}
              y={PADDING.top}
              width={WIDTH / points.length}
              height={HEIGHT - PADDING.top - PADDING.bottom}
              fill="transparent"
              onMouseEnter={() => setHoverIndex(i)}
            />
          </g>
        ))}

        {hoveredCoord && (
          <line
            x1={hoveredCoord.x}
            y1={PADDING.top}
            x2={hoveredCoord.x}
            y2={HEIGHT - PADDING.bottom}
            stroke="#C4862A"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

        {/* X-axis labels: first, middle, last */}
        {[0, Math.floor((points.length - 1) / 2), points.length - 1]
          .filter((v, i, arr) => arr.indexOf(v) === i)
          .map((i) => (
            <text
              key={i}
              x={coords[i].x}
              y={HEIGHT - PADDING.bottom + 18}
              textAnchor="middle"
              className="fill-stone-400 text-[10px]"
            >
              {formatDate(points[i].date)}
            </text>
          ))}
      </svg>

      {hovered && hoveredCoord && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-stone-200 bg-white px-3 py-2 shadow-lg"
          style={{ left: `${(hoveredCoord.x / WIDTH) * 100}%`, top: `${(hoveredCoord.y / HEIGHT) * 100 - 4}%` }}
        >
          <p className="text-label-sm font-semibold tabular-nums text-stone-900">
            {formatKes(hovered.price)}{unit ? ` / ${unit}` : ''}
          </p>
          <p className="text-caption text-stone-500">{formatDate(hovered.date)}</p>
          {hovered.label && <p className="text-caption text-stone-500">{hovered.label}</p>}
        </div>
      )}
    </div>
  );
}

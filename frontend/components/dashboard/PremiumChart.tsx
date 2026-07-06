import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { DowHeatmapPoint, HourlyHeatmapReport } from '@/types/report';
import { CHART_AMBER, CHART_SERIES_PALETTE } from '@/lib/chart-colors';
import { cn } from '@/lib/cn';

function useContainerWidth(fallback = 320): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(el);
    setWidth(Math.floor(el.getBoundingClientRect().width));
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

interface ChartDatum {
  label: string;
  value: number;
  caption?: string;
  date?: string;
}

interface TrendBarsProps {
  title: string;
  subtitle?: string;
  data: ChartDatum[];
  valueFormatter?: (value: number) => string;
  className?: string;
}

interface ComparisonBarsProps {
  title: string;
  subtitle?: string;
  data: ChartDatum[];
  valueFormatter?: (value: number) => string;
  className?: string;
}

interface LineTrendProps {
  title: string;
  subtitle?: string;
  data: ChartDatum[];
  accentColor?: string;
  valueFormatter?: (value: number) => string;
  tooltipUnit?: string;
  summaryLabel?: string;
  showRangeToggle?: boolean;
  className?: string;
}

interface MultiLineSeries {
  id: string;
  label: string;
  data: ChartDatum[];
  color?: string;
}

interface MultiLineTrendProps {
  title: string;
  subtitle?: string;
  series: MultiLineSeries[];
  valueFormatter?: (value: number) => string;
  tooltipUnit?: string;
  summaryLabel?: string;
  className?: string;
}

const defaultFormatter = (value: number): string => String(value);
const tooltipDateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
});

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

type RangeKey = '7d' | '30d' | 'ytd';

interface Point {
  x: number;
  y: number;
  value: number;
  label: string;
  date?: string;
}

// Branch palette: red primary, blue secondary, then fallbacks
const seriesPalette = [...CHART_SERIES_PALETTE];

const getPointsPath = (points: Point[], minY: number, maxY: number): string => {
  if (points.length === 0) {
    return '';
  }

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  const clampY = (value: number): number => clamp(value, minY, maxY);
  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] ?? p2;

    const controlPoint1X = p1.x + (p2.x - p0.x) / 6;
    const controlPoint1Y = clampY(p1.y + (p2.y - p0.y) / 6);
    const controlPoint2X = p2.x - (p3.x - p1.x) / 6;
    const controlPoint2Y = clampY(p2.y - (p3.y - p1.y) / 6);

    path += ` C ${controlPoint1X} ${controlPoint1Y}, ${controlPoint2X} ${controlPoint2Y}, ${p2.x} ${p2.y}`;
  }

  return path;
};

const formatTooltipDate = (input?: string): string | null => {
  if (!input) {
    return null;
  }

  const parsed = new Date(`${input}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return tooltipDateFormatter.format(parsed);
};

const getSeriesColor = (index: number, color?: string): string => {
  if (color) {
    return color;
  }

  return seriesPalette[index % seriesPalette.length] ?? '#2C1A12';
};

export function TrendBars({
  title,
  subtitle,
  data,
  valueFormatter = defaultFormatter,
  className,
}: TrendBarsProps): JSX.Element {
  const max = Math.max(...data.map((item) => item.value), 0);

  return (
    <section className={cn('rounded-xl border border-stone-200 bg-white p-5 shadow-sm', className)}>
      <h3 className="text-heading-sm font-semibold text-stone-900">{title}</h3>
      {subtitle && <p className="mt-1 text-body-sm text-stone-500">{subtitle}</p>}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {data.map((item) => {
          const heightRatio = max > 0 ? Math.max(item.value / max, 0.06) : 0.06;
          return (
            <div key={item.label} className="flex min-w-0 flex-col items-center">
              <span className="mb-2 text-label-sm font-semibold text-espresso">{valueFormatter(item.value)}</span>
              <div className="flex h-44 w-full items-end rounded-lg bg-gradient-to-b from-[#F7F4EF] to-[#ECE5DA] p-2">
                <div
                  className="w-full rounded-md bg-gradient-to-t from-[#92520D] via-[#C4862A] to-[#F5C26B] shadow-[0_10px_24px_rgba(196,134,42,0.35)] transition-all duration-500"
                  style={{ height: `${Math.round(heightRatio * 100)}%` }}
                />
              </div>
              <span className="mt-2 text-center text-caption text-stone-600">{item.label}</span>
              {item.caption && <span className="mt-1 text-caption text-stone-400">{item.caption}</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function ComparisonBars({
  title,
  subtitle,
  data,
  valueFormatter = defaultFormatter,
  className,
}: ComparisonBarsProps): JSX.Element {
  const max = Math.max(...data.map((item) => item.value), 0);

  return (
    <section className={cn('rounded-xl border border-stone-200 bg-white p-5 shadow-sm', className)}>
      <h3 className="text-heading-sm font-semibold text-stone-900">{title}</h3>
      {subtitle && <p className="mt-1 text-body-sm text-stone-500">{subtitle}</p>}

      <div className="mt-6 space-y-4">
        {data.map((item) => {
          const widthRatio = max > 0 ? Math.max(item.value / max, 0.02) : 0;
          return (
            <div key={item.label} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-body-sm font-medium text-stone-800">{item.label}</span>
                <span className="text-label-sm font-semibold text-espresso">{valueFormatter(item.value)}</span>
              </div>
              <div className="h-3.5 rounded-full bg-stone-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#92520D] via-[#C4862A] to-[#F5C26B] transition-all duration-500"
                  style={{ width: `${Math.round(widthRatio * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function LineTrendChart({
  title,
  subtitle,
  data,
  accentColor = CHART_AMBER,
  valueFormatter = defaultFormatter,
  tooltipUnit = 'Orders',
  summaryLabel = 'Total Orders',
  showRangeToggle = true,
  className,
}: LineTrendProps): JSX.Element {
  const [range, setRange] = useState<RangeKey>('30d');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const gradientId = useId();
  const [containerRef, containerWidth] = useContainerWidth(320);

  useEffect(() => {
    if (!showRangeToggle) {
      setRange('ytd');
      return;
    }

    if (data.length <= 7) {
      setRange('7d');
      return;
    }

    if (data.length <= 30) {
      setRange('30d');
    }
  }, [data.length, showRangeToggle]);

  useEffect(() => {
    setHoveredIndex(null);
  }, [range, data.length]);

  const filteredData = useMemo(() => {
    if (!showRangeToggle || range === 'ytd') {
      return data;
    }

    if (range === '7d') {
      return data.slice(-7);
    }

    return data.slice(-30);
  }, [data, range, showRangeToggle]);

  const width = containerWidth;
  const height = 180;
  const paddingX = 52;
  const paddingY = 16;
  const innerWidth = Math.max(width - paddingX * 2, 1);
  const innerHeight = height - paddingY * 2;
  const yAxisTicks = 4;
  const baselineY = height - paddingY;

  const safeData = filteredData.length > 0 ? filteredData : [{ label: '', value: 0 }];
  const allData = data.length > 0 ? data : safeData;
  const maxValue = Math.max(...safeData.map((point) => point.value), 0);
  const minValue = 0;
  const valueRange = Math.max(maxValue - minValue, 1);

  const points = safeData.map((point, index) => {
    const x =
      safeData.length === 1
        ? paddingX + innerWidth / 2
        : paddingX + (index / (safeData.length - 1)) * innerWidth;
    const y = paddingY + innerHeight - ((point.value - minValue) / valueRange) * innerHeight;
    return { x, y, ...point };
  });

  const linePath = getPointsPath(points, paddingY, baselineY);
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`
      : '';

  const yTicks = Array.from({ length: yAxisTicks }, (_unused, index) => {
    const ratio = index / (yAxisTicks - 1);
    const value = maxValue * (1 - ratio);
    const y = paddingY + innerHeight * ratio;
    return {
      y,
      value,
    };
  });

  const tickIndices = useMemo(() => {
    if (points.length === 0) {
      return [];
    }

    const maxLabels = 6;
    if (points.length <= maxLabels) {
      return points.map((_point, index) => index);
    }

    const interval = Math.ceil((points.length - 1) / (maxLabels - 1));
    const indexes = new Set<number>([0, points.length - 1]);
    for (let index = interval; index < points.length - 1; index += interval) {
      indexes.add(index);
    }

    return Array.from(indexes).sort((left, right) => left - right);
  }, [points]);

  const totalOrders = safeData.reduce((sum, point) => sum + point.value, 0);
  const trendWindow = range === '7d' ? 7 : 30;
  const currentWindowData = allData.slice(-trendWindow);
  const previousWindowData = allData.slice(-(trendWindow * 2), -trendWindow);
  const currentWindowTotal = currentWindowData.reduce((sum, point) => sum + point.value, 0);
  const previousWindowTotal = previousWindowData.reduce((sum, point) => sum + point.value, 0);
  const trendPercent =
    previousWindowTotal > 0 ? ((currentWindowTotal - previousWindowTotal) / previousWindowTotal) * 100 : null;
  const trendBadge =
    trendPercent === null
      ? null
      : `${trendPercent > 0 ? '+' : ''}${Math.round(trendPercent)}% ${range === '7d' ? 'this week' : 'vs prior'}`;

  const hoveredPoint = hoveredIndex === null ? null : points[hoveredIndex] ?? null;
  const tooltipTitle = hoveredPoint ? formatTooltipDate(hoveredPoint.date) ?? hoveredPoint.label : '';
  const tooltipBody = hoveredPoint ? `${valueFormatter(hoveredPoint.value)} ${tooltipUnit}` : '';

  return (
    <section className={cn('rounded-xl border border-stone-100 bg-white p-4 shadow-md sm:p-5', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-heading-sm font-semibold text-stone-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-body-sm text-stone-400">{subtitle}</p>}
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-label-md font-medium text-stone-500">{summaryLabel}:</span>
            <span className="text-heading-sm font-semibold text-espresso">{valueFormatter(totalOrders)}</span>
            {trendBadge && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-label-sm font-semibold',
                  trendPercent !== null && trendPercent >= 0
                    ? 'border border-status-ready-border bg-status-ready-bg text-status-ready-text'
                    : 'border border-status-cancelled-border bg-status-cancelled-bg text-status-cancelled-text',
                )}
              >
                {trendBadge}
              </span>
            )}
          </div>

          {showRangeToggle && (
            <div className="inline-flex items-center rounded-lg border border-stone-200 bg-stone-100 p-1">
              {([
                ['7d', '7D'],
                ['30d', '30D'],
                ['ytd', 'YTD'],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRange(key)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-label-sm font-semibold transition-colors',
                    range === key ? 'bg-white text-espresso shadow-sm' : 'text-stone-600 hover:text-stone-900',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div ref={containerRef} className="mt-4">
        <svg width={width} height={height} role="img" aria-label={title}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accentColor} stopOpacity="0.35" />
                <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
              </linearGradient>
            </defs>

            {yTicks.map((tick) => (
              <g key={`${tick.y}-${tick.value}`}>
                <line
                  x1={paddingX}
                  y1={tick.y}
                  x2={paddingX + innerWidth}
                  y2={tick.y}
                  stroke="#E7E5E4"
                  strokeWidth={1}
                  strokeOpacity={0.8}
                />
                <text
                  x={10}
                  y={tick.y + 4}
                  className="fill-stone-400 text-[10px] font-medium"
                >
                  {valueFormatter(Math.round(tick.value))}
                </text>
              </g>
            ))}

            {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke={accentColor}
                strokeWidth={3}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

            {points.map((point, index) => {
              const previousX = points[index - 1]?.x ?? point.x;
              const nextX = points[index + 1]?.x ?? point.x;
              const leftX = index === 0 ? paddingX : (previousX + point.x) / 2;
              const rightX = index === points.length - 1 ? paddingX + innerWidth : (nextX + point.x) / 2;

              return (
                <rect
                  key={`${point.label}-${index}`}
                  x={leftX}
                  y={paddingY}
                  width={Math.max(rightX - leftX, 2)}
                  height={innerHeight}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseMove={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              );
            })}

            {hoveredPoint && hoveredIndex !== null && (
              <g>
                <circle
                  cx={hoveredPoint.x}
                  cy={hoveredPoint.y}
                  r={5}
                  fill="white"
                  stroke={accentColor}
                  strokeWidth={2}
                  className="transition-opacity duration-200"
                />
                <rect
                  x={clamp(hoveredPoint.x - 104, paddingX + 4, paddingX + innerWidth - 212)}
                  y={clamp(hoveredPoint.y - 60, paddingY, baselineY - 54)}
                  rx={10}
                  ry={10}
                  width={208}
                  height={46}
                  fill="#1C1917"
                  fillOpacity={0.95}
                />
                <text
                  x={clamp(hoveredPoint.x - 96, paddingX + 12, paddingX + innerWidth - 204)}
                  y={clamp(hoveredPoint.y - 42, paddingY + 16, baselineY - 34)}
                  className="fill-crema text-[11px] font-semibold"
                >
                  {tooltipTitle}
                </text>
                <text
                  x={clamp(hoveredPoint.x - 96, paddingX + 12, paddingX + innerWidth - 204)}
                  y={clamp(hoveredPoint.y - 26, paddingY + 32, baselineY - 18)}
                  className="fill-stone-200 text-[10px] font-medium"
                >
                  {tooltipBody}
                </text>
              </g>
            )}

            {tickIndices.map((tickIndex) => {
              const point = points[tickIndex];
              if (!point) {
                return null;
              }

              return (
                <text
                  key={`${point.label}-${point.x}-label`}
                  x={point.x}
                  y={height - 2}
                  textAnchor="middle"
                  className="fill-stone-600 text-[10px] font-medium"
                >
                  {point.label}
                </text>
              );
            })}
          </svg>
      </div>
    </section>
  );
}

export function MultiLineTrendChart({
  title,
  subtitle,
  series,
  valueFormatter = defaultFormatter,
  tooltipUnit = 'Value',
  summaryLabel = 'Total',
  className,
}: MultiLineTrendProps): JSX.Element {
  const [range, setRange] = useState<RangeKey>('30d');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [containerRef, containerWidth] = useContainerWidth(320);
  const gradientBaseId = useId();

  useEffect(() => {
    const maxLength = Math.max(0, ...series.map((entry) => entry.data.length));
    if (maxLength <= 7) {
      setRange('7d');
      return;
    }

    if (maxLength <= 30) {
      setRange('30d');
    }
  }, [series]);

  useEffect(() => {
    setHoveredIndex(null);
  }, [range, series]);

  const filteredSeries = useMemo(() => {
    const take = range === '7d' ? 7 : range === '30d' ? 30 : Number.POSITIVE_INFINITY;
    return series.map((entry) => ({
      ...entry,
      data: take === Number.POSITIVE_INFINITY ? entry.data : entry.data.slice(-take),
    }));
  }, [range, series]);

  const templateData = useMemo(() => filteredSeries[0]?.data ?? [], [filteredSeries]);
  const alignedSeries = useMemo(() => {
    return filteredSeries.map((entry) => {
      const map = new Map<string, number>();
      for (const point of entry.data) {
        map.set(point.date ?? point.label, point.value);
      }

      return {
        ...entry,
        data: templateData.map((point) => ({
          ...point,
          value: map.get(point.date ?? point.label) ?? 0,
        })),
      };
    });
  }, [filteredSeries, templateData]);

  const width = containerWidth;
  const height = 180;
  const paddingX = 52;
  const paddingY = 16;
  const innerWidth = Math.max(width - paddingX * 2, 1);
  const innerHeight = height - paddingY * 2;
  const baselineY = height - paddingY;
  const yAxisTicks = 4;

  const maxValue = Math.max(
    0,
    ...alignedSeries.flatMap((entry) => entry.data.map((point) => point.value)),
  );
  const valueRange = Math.max(maxValue, 1);

  const pointsBySeries = alignedSeries.map((entry) =>
    entry.data.map((point, index) => {
      const x =
        entry.data.length <= 1
          ? paddingX + innerWidth / 2
          : paddingX + (index / (entry.data.length - 1)) * innerWidth;
      const y = paddingY + innerHeight - (point.value / valueRange) * innerHeight;
      return { x, y, ...point };
    }),
  );

  const linePaths = pointsBySeries.map((points) => getPointsPath(points, paddingY, baselineY));
  const areaPaths = pointsBySeries.map((points, seriesIndex) => {
    const lp = linePaths[seriesIndex];
    if (!lp || points.length === 0) return '';
    return `${lp} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`;
  });
  const yTicks = Array.from({ length: yAxisTicks }, (_unused, index) => {
    const ratio = index / (yAxisTicks - 1);
    const value = maxValue * (1 - ratio);
    const y = paddingY + innerHeight * ratio;
    return {
      y,
      value,
    };
  });

  const tickIndices = useMemo(() => {
    if (templateData.length === 0) {
      return [];
    }

    const maxLabels = 6;
    if (templateData.length <= maxLabels) {
      return templateData.map((_point, index) => index);
    }

    const interval = Math.ceil((templateData.length - 1) / (maxLabels - 1));
    const indexes = new Set<number>([0, templateData.length - 1]);
    for (let index = interval; index < templateData.length - 1; index += interval) {
      indexes.add(index);
    }

    return Array.from(indexes).sort((left, right) => left - right);
  }, [templateData]);

  const primarySeries = alignedSeries[0];
  const total = (primarySeries?.data ?? []).reduce((sum, point) => sum + point.value, 0);
  const allSeriesData = series[0]?.data ?? [];
  const trendWindow = range === '7d' ? 7 : 30;
  const currentTotal = allSeriesData.slice(-trendWindow).reduce((sum, point) => sum + point.value, 0);
  const previousTotal = allSeriesData
    .slice(-(trendWindow * 2), -trendWindow)
    .reduce((sum, point) => sum + point.value, 0);
  const trendPercent = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : null;
  const trendBadge =
    trendPercent === null
      ? null
      : `${trendPercent > 0 ? '+' : ''}${Math.round(trendPercent)}% ${range === '7d' ? 'this week' : 'vs prior'}`;

  const hoveredLabel = hoveredIndex === null ? null : templateData[hoveredIndex] ?? null;
  const tooltipTitle = hoveredLabel ? formatTooltipDate(hoveredLabel.date) ?? hoveredLabel.label : '';
  const tooltipSeriesValues =
    hoveredIndex === null
      ? []
      : alignedSeries.map((entry, index) => ({
          color: getSeriesColor(index, entry.color),
          label: entry.label,
          value: entry.data[hoveredIndex]?.value ?? 0,
        }));

  const tooltipXPoint = hoveredIndex === null ? null : pointsBySeries[0]?.[hoveredIndex] ?? null;
  const tooltipX = tooltipXPoint ? clamp(tooltipXPoint.x - 118, paddingX + 4, paddingX + innerWidth - 236) : 0;
  const tooltipY = tooltipXPoint ? clamp(tooltipXPoint.y - 72, paddingY, baselineY - 70) : 0;
  const tooltipHeight = 36 + tooltipSeriesValues.length * 14;

  return (
    <section className={cn('rounded-xl border border-stone-100 bg-white p-4 shadow-md sm:p-5', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-heading-sm font-semibold text-stone-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-body-sm text-stone-400">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-label-md font-medium text-stone-500">{summaryLabel}:</span>
            <span className="text-heading-sm font-semibold text-espresso">{valueFormatter(total)}</span>
            {trendBadge && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-label-sm font-semibold',
                  trendPercent !== null && trendPercent >= 0
                    ? 'border border-status-ready-border bg-status-ready-bg text-status-ready-text'
                    : 'border border-status-cancelled-border bg-status-cancelled-bg text-status-cancelled-text',
                )}
              >
                {trendBadge}
              </span>
            )}
          </div>

          <div className="inline-flex items-center rounded-lg border border-stone-200 bg-stone-100 p-1">
            {([
              ['7d', '7D'],
              ['30d', '30D'],
              ['ytd', 'YTD'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setRange(key)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-label-sm font-semibold transition-colors',
                  range === key ? 'bg-white text-espresso shadow-sm' : 'text-stone-600 hover:text-stone-900',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {alignedSeries.map((entry, index) => (
          <div key={entry.id} className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getSeriesColor(index, entry.color) }} />
            <span className="text-label-sm text-stone-700">{entry.label}</span>
          </div>
        ))}
      </div>

      <div ref={containerRef} className="mt-4">
        <svg width={width} height={height} role="img" aria-label={title}>
            <defs>
              {alignedSeries.map((entry, index) => {
                const color = getSeriesColor(index, entry.color);
                return (
                  <linearGradient key={`${gradientBaseId}-${entry.id}`} id={`${gradientBaseId}-grad-${index}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.45" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.05" />
                  </linearGradient>
                );
              })}
            </defs>

            {yTicks.map((tick) => (
              <g key={`${tick.y}-${tick.value}`}>
                <line
                  x1={paddingX}
                  y1={tick.y}
                  x2={paddingX + innerWidth}
                  y2={tick.y}
                  stroke="#E7E5E4"
                  strokeWidth={1}
                  strokeOpacity={0.8}
                />
                <text x={10} y={tick.y + 4} className="fill-stone-400 text-[10px] font-medium">
                  {valueFormatter(Math.round(tick.value))}
                </text>
              </g>
            ))}

            {areaPaths.map((path, index) =>
              path ? (
                <path
                  key={`${alignedSeries[index]?.id ?? index}-area`}
                  d={path}
                  fill={`url(#${gradientBaseId}-grad-${index})`}
                />
              ) : null,
            )}

            {linePaths.map((path, index) => (
              <path
                key={`${alignedSeries[index]?.id ?? index}-path`}
                d={path}
                fill="none"
                stroke={getSeriesColor(index, alignedSeries[index]?.color)}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}

            {templateData.map((_point, index) => {
              const previousX = pointsBySeries[0]?.[index - 1]?.x ?? pointsBySeries[0]?.[index]?.x ?? paddingX;
              const currentX = pointsBySeries[0]?.[index]?.x ?? paddingX;
              const nextX = pointsBySeries[0]?.[index + 1]?.x ?? currentX;
              const leftX = index === 0 ? paddingX : (previousX + currentX) / 2;
              const rightX = index === templateData.length - 1 ? paddingX + innerWidth : (nextX + currentX) / 2;

              return (
                <rect
                  key={`hover-${index}`}
                  x={leftX}
                  y={paddingY}
                  width={Math.max(rightX - leftX, 2)}
                  height={innerHeight}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseMove={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              );
            })}

            {hoveredIndex !== null &&
              pointsBySeries.map((points, index) => {
                const point = points[hoveredIndex];
                if (!point) {
                  return null;
                }

                return (
                  <circle
                    key={`${alignedSeries[index]?.id ?? index}-marker`}
                    cx={point.x}
                    cy={point.y}
                    r={4}
                    fill="white"
                    stroke={getSeriesColor(index, alignedSeries[index]?.color)}
                    strokeWidth={2}
                  />
                );
              })}

            {hoveredIndex !== null && hoveredLabel && tooltipSeriesValues.length > 0 && (
              <g>
                <rect x={tooltipX} y={tooltipY} rx={10} ry={10} width={236} height={tooltipHeight} fill="#1C1917" fillOpacity={0.96} />
                <text x={tooltipX + 12} y={tooltipY + 16} className="fill-crema text-[11px] font-semibold">
                  {tooltipTitle}
                </text>
                {tooltipSeriesValues.map((entry, index) => (
                  <text key={`${entry.label}-${index}`} x={tooltipX + 12} y={tooltipY + 32 + index * 14} className="fill-stone-200 text-[10px] font-medium">
                    {`${entry.label}: ${valueFormatter(entry.value)} ${tooltipUnit}`}
                  </text>
                ))}
              </g>
            )}

            {tickIndices.map((tickIndex) => {
              const point = pointsBySeries[0]?.[tickIndex];
              const dataPoint = templateData[tickIndex];
              if (!point || !dataPoint) {
                return null;
              }

              return (
                <text
                  key={`${dataPoint.label}-${point.x}-label`}
                  x={point.x}
                  y={height - 2}
                  textAnchor="middle"
                  className="fill-stone-600 text-[10px] font-medium"
                >
                  {dataPoint.label}
                </text>
              );
            })}
          </svg>
      </div>
    </section>
  );
}

// ── HourlyBarsChart ───────────────────────────────────────────────────────────

interface HourlyBarsChartProps {
  data: HourlyHeatmapReport;
  showDow?: boolean;
  className?: string;
}

// Coffee gradient: dark roast espresso → caramel latte
const DOW_BAR_GRADIENT = `linear-gradient(90deg, #1A0A05 0%, #7C3D0A 40%, ${CHART_AMBER} 75%, #E8B84A 100%)`;

function DowBars({ points }: { points: DowHeatmapPoint[] }): JSX.Element {
  const max = Math.max(...points.map((p) => p.avgOrderCount), 1);
  const sorted = [...points].sort((a, b) => b.avgOrderCount - a.avgOrderCount);
  return (
    <div className="mt-6 pt-5">
      {/* Section divider with centred badge — matches mockup */}
      <div className="mb-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#C8BEB4] to-transparent" />
        <span className="shrink-0 rounded-full border border-[#3D1F0D] bg-[#1A0A05] px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
          Busiest Days of the Week
        </span>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#C8BEB4] to-transparent" />
      </div>

      <div className="flex flex-col gap-y-1.5">
        {sorted.map((point, rank) => {
          const isPeak = rank === 0 && point.avgOrderCount > 0;
          const fillRatio = point.avgOrderCount > 0 ? point.avgOrderCount / max : 0;

          return (
            <div
              key={point.label}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-all ${
                isPeak ? 'bg-[#FFFBF5] shadow-sm ring-1 ring-[#C4862A]/20' : ''
              }`}
            >
              {/* Rank badge */}
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums ${
                  isPeak ? 'bg-[#1A0A05] text-white' : 'bg-[#F0EAE4] text-[#5C3A22]'
                }`}
              >
                {rank + 1}
              </span>

              {/* Day name */}
              <span className={`w-7 shrink-0 text-label-sm font-semibold ${isPeak ? 'text-[#1A0A05]' : 'text-stone-600'}`}>
                {point.label}
              </span>

              {/* Bar track — sharp corners */}
              <div className="relative h-[9px] flex-1 overflow-hidden rounded-none bg-[#F0EAE4]">
                <div
                  className="absolute inset-y-0 left-0 transition-all duration-700"
                  style={{ width: `${Math.round(fillRatio * 100)}%`, background: DOW_BAR_GRADIENT }}
                />
              </div>

              {/* Value */}
              <span className={`w-16 shrink-0 text-right text-body-sm font-bold tabular-nums ${isPeak ? 'text-[#1A0A05]' : 'text-[#8B6A50]'}`}>
                {point.avgOrderCount > 0 ? (
                  <>
                    {String(point.avgOrderCount)}{' '}
                    <span className="font-normal text-[10px] text-stone-400">/day</span>
                  </>
                ) : (
                  <span className="text-stone-300">—</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}


export function HourlyBarsChart({ data, showDow = false, className }: HourlyBarsChartProps): JSX.Element {
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);
  const gradientDineId = useId();
  const glowFilterId = useId();
  const [containerRef, containerWidth] = useContainerWidth(320);

  const maxCount = Math.max(...data.hourlyPoints.map((p) => p.orderCount), 1);
  const peakHour = data.hourlyPoints.reduce(
    (best, p) => (p.orderCount > best.orderCount ? p : best),
    data.hourlyPoints[0] ?? { hour: 0, orderCount: 0, label: '', byType: { DINE_IN: 0, TAKE_AWAY: 0, DELIVERY: 0 } },
  );
  const totalOrders = data.hourlyPoints.reduce((sum, p) => sum + p.orderCount, 0);

  const svgHeight = 240;
  const paddingTop = 36;
  const paddingBottom = 28;
  const paddingLeft = 36;
  const paddingRight = 12;
  const innerWidth = Math.max(containerWidth - paddingLeft - paddingRight, 1);
  const innerHeight = svgHeight - paddingTop - paddingBottom;

  const points = data.hourlyPoints;
  const barWidth = Math.max(innerWidth / points.length - 5, 2);
  const barSpacing = innerWidth / points.length;

  const xLabelHours = new Set([0, 3, 6, 9, 12, 15, 18, 21]);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    y: paddingTop + innerHeight * (1 - ratio),
    value: Math.round(maxCount * ratio),
  }));

  const hoveredPoint = hoveredHour !== null ? (points[hoveredHour] ?? null) : null;
  const hoveredBarX = hoveredHour !== null ? paddingLeft + hoveredHour * barSpacing + barSpacing / 2 : 0;

  return (
    <section className={cn('rounded-2xl border border-[#E8DDD0] bg-gradient-to-br from-[#FDFAF6] to-white p-4 shadow-md sm:p-6', className)}>
      {/* Header row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-body-sm text-stone-500">{data.organizationName}</p>
        <div className="flex flex-wrap items-center gap-2">
          {peakHour.orderCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-gradient-to-r from-amber-50 to-[#FDF3DC] px-3 py-1 text-label-sm font-bold text-[#7C3D0A] shadow-sm">
              <span className="text-amber-500">★</span>
              Peak {peakHour.label} · {peakHour.orderCount} orders
            </span>
          )}
          <span className="rounded-full bg-stone-100 px-3 py-1 text-label-sm font-medium text-stone-500">
            {totalOrders} total
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-2">
        {[
          { color: 'linear-gradient(135deg, #5C2E0F, #1A0A05)', label: 'Dine-In' },
          { color: '#007029', label: 'Take-Away' },
          { color: '#EAB308', label: 'Delivery' },
        ].map((item) => (
          <div
            key={item.label}
            className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 py-1 shadow-sm"
          >
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} />
            <span className="text-label-sm font-medium text-stone-600">{item.label}</span>
          </div>
        ))}
      </div>

      <div ref={containerRef} className="mt-5 select-none">
        <svg width={containerWidth} height={svgHeight} role="img" aria-label="Order volume by hour of day">
          <defs>
            {/* Dine-In: rich espresso gradient — bright top, deep base */}
            <linearGradient id={gradientDineId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A0522D" />
              <stop offset="45%" stopColor="#5C2E0F" />
              <stop offset="100%" stopColor="#1A0A05" />
            </linearGradient>
            {/* Glow filter for peak bar */}
            <filter id={glowFilterId} x="-40%" y="-20%" width="180%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Subtle background band for chart area */}
          <rect
            x={paddingLeft}
            y={paddingTop}
            width={innerWidth}
            height={innerHeight}
            fill="url(#chartBg)"
            rx={6}
            ry={6}
            fillOpacity={0.03}
          />

          {/* Y-axis gridlines */}
          {yTicks.map((tick) => (
            <g key={`ytick-${tick.value}`}>
              <line
                x1={paddingLeft}
                y1={tick.y}
                x2={paddingLeft + innerWidth}
                y2={tick.y}
                stroke={tick.value === 0 ? '#C8BFB5' : '#EDE8E2'}
                strokeWidth={tick.value === 0 ? 1.5 : 1}
                strokeDasharray={tick.value === 0 ? undefined : '4 6'}
              />
              <text
                x={paddingLeft - 6}
                y={tick.y + 4}
                textAnchor="end"
                className="fill-stone-600 text-[11px] font-semibold"
              >
                {tick.value}
              </text>
            </g>
          ))}

          {/* Bars */}
          {points.map((point, index) => {
            const isPeak = point.hour === peakHour.hour && point.orderCount > 0;
            const isHovered = hoveredHour === index;
            const barX = paddingLeft + index * barSpacing + (barSpacing - barWidth) / 2;
            const totalH = maxCount > 0 ? (point.orderCount / maxCount) * innerHeight : 0;
            const dineH = point.orderCount > 0 ? (point.byType.DINE_IN / point.orderCount) * totalH : 0;
            const takeH = point.orderCount > 0 ? (point.byType.TAKE_AWAY / point.orderCount) * totalH : 0;
            const delivH = totalH - dineH - takeH;
            const baseY = paddingTop + innerHeight;

            return (
              <g
                key={`bar-${point.hour}`}
                onMouseEnter={() => setHoveredHour(index)}
                onMouseLeave={() => setHoveredHour(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Hover background highlight */}
                {isHovered && (
                  <rect
                    x={paddingLeft + index * barSpacing + 1}
                    y={paddingTop}
                    width={barSpacing - 2}
                    height={innerHeight}
                    fill={CHART_AMBER}
                    fillOpacity={0.06}
                    rx={4}
                    ry={4}
                  />
                )}

                {/* Hit area */}
                <rect
                  x={paddingLeft + index * barSpacing}
                  y={paddingTop}
                  width={barSpacing}
                  height={innerHeight}
                  fill="transparent"
                />

                {totalH > 0 && (
                  <>
                    {/* Peak glow shadow */}
                    {isPeak && (
                      <rect
                        x={barX - 1}
                        y={baseY - totalH - 1}
                        width={barWidth + 2}
                        height={totalH + 1}
                        fill="#1A0A05"
                        fillOpacity={0.15}
                        filter={`url(#${glowFilterId})`}
                      />
                    )}

                    {/* Delivery segment — solid yellow, sharp corners */}
                    {delivH > 0 && (
                      <rect
                        x={barX}
                        y={baseY - totalH}
                        width={barWidth}
                        height={Math.max(delivH, 1)}
                        fill="#EAB308"
                        opacity={isHovered ? 1 : 0.95}
                      />
                    )}
                    {/* Take-away segment — solid forest green, sharp corners */}
                    {takeH > 0 && (
                      <rect
                        x={barX}
                        y={baseY - dineH - takeH}
                        width={barWidth}
                        height={Math.max(takeH, 1)}
                        fill="#007029"
                        opacity={isHovered ? 1 : 0.95}
                      />
                    )}
                    {/* Dine-in segment — espresso gradient, sharp corners */}
                    {dineH > 0 && (
                      <rect
                        x={barX}
                        y={baseY - dineH}
                        width={barWidth}
                        height={Math.max(dineH, 1)}
                        fill={`url(#${gradientDineId})`}
                        opacity={isHovered ? 1 : 0.95}
                      />
                    )}

                    {/* Peak star indicator */}
                    {isPeak && (
                      <>
                        <circle
                          cx={barX + barWidth / 2}
                          cy={baseY - totalH - 12}
                          r={8}
                          fill="#FFFBEB"
                          fillOpacity={0.9}
                        />
                        <text
                          x={barX + barWidth / 2}
                          y={baseY - totalH - 8}
                          textAnchor="middle"
                          fontSize={10}
                          fill="#92400E"
                          fontWeight="bold"
                        >
                          ★
                        </text>
                      </>
                    )}
                  </>
                )}

                {/* Zero bar stub — sharp */}
                {totalH === 0 && (
                  <rect x={barX} y={baseY - 3} width={barWidth} height={3} fill="#EDE8E2" />
                )}

                {/* X-axis labels */}
                {xLabelHours.has(point.hour) && (
                  <text
                    x={barX + barWidth / 2}
                    y={svgHeight - 6}
                    textAnchor="middle"
                    className="fill-stone-600 text-[11px] font-semibold"
                  >
                    {point.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Hover tooltip */}
          {hoveredPoint !== null && hoveredHour !== null && (
            <g>
              <line
                x1={hoveredBarX}
                y1={paddingTop}
                x2={hoveredBarX}
                y2={paddingTop + innerHeight}
                stroke={CHART_AMBER}
                strokeWidth={1.5}
                strokeDasharray="3 3"
                strokeOpacity={0.6}
              />
              {/* Tooltip shadow */}
              <rect
                x={clamp(hoveredBarX - 80, paddingLeft + 2, paddingLeft + innerWidth - 166) + 2}
                y={paddingTop + 6}
                rx={10}
                ry={10}
                width={164}
                height={82}
                fill="#000"
                fillOpacity={0.12}
              />
              {/* Tooltip body */}
              <rect
                x={clamp(hoveredBarX - 80, paddingLeft + 2, paddingLeft + innerWidth - 166)}
                y={paddingTop + 4}
                rx={10}
                ry={10}
                width={164}
                height={82}
                fill="#1C1917"
                fillOpacity={0.97}
              />
              {/* Accent line */}
              <rect
                x={clamp(hoveredBarX - 80, paddingLeft + 2, paddingLeft + innerWidth - 166)}
                y={paddingTop + 4}
                width={3}
                height={82}
                rx={2}
                ry={2}
                fill={CHART_AMBER}
              />
              <text
                x={clamp(hoveredBarX - 72, paddingLeft + 10, paddingLeft + innerWidth - 158)}
                y={paddingTop + 21}
                className="fill-white text-[11px] font-bold"
              >
                {hoveredPoint.label}
              </text>
              <text
                x={clamp(hoveredBarX - 72, paddingLeft + 10, paddingLeft + innerWidth - 158)}
                y={paddingTop + 37}
                className="fill-stone-300 text-[10px]"
              >
                {`Total: ${String(hoveredPoint.orderCount)} orders`}
              </text>
              <text
                x={clamp(hoveredBarX - 72, paddingLeft + 10, paddingLeft + innerWidth - 158)}
                y={paddingTop + 52}
                className="fill-stone-400 text-[9px]"
              >
                {`Dine-in ${String(hoveredPoint.byType.DINE_IN)} · T-Away ${String(hoveredPoint.byType.TAKE_AWAY)} · Deliv ${String(hoveredPoint.byType.DELIVERY)}`}
              </text>
              <text
                x={clamp(hoveredBarX - 72, paddingLeft + 10, paddingLeft + innerWidth - 158)}
                y={paddingTop + 67}
                className="fill-[#C4862A] text-[9px] font-semibold"
              >
                {totalOrders > 0
                  ? `${String(Math.round((hoveredPoint.orderCount / totalOrders) * 100))}% of daily volume`
                  : '0% of daily volume'}
              </text>
            </g>
          )}
        </svg>
      </div>

      {showDow && <DowBars points={data.dowPoints} />}
    </section>
  );
}

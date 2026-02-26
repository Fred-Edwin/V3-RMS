import { useEffect, useId, useMemo, useState } from 'react';
import { cn } from '@/lib/cn';

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

const seriesPalette = ['#2C1A12', '#C4862A', '#6B4E2E', '#9B6A3C', '#5A3E2B', '#7C5A3D'];

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
                  className="w-full rounded-md bg-gradient-to-t from-[#3B3024] via-[#5B4A39] to-[#C48D4E] shadow-[0_10px_24px_rgba(59,48,36,0.28)] transition-all duration-500"
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
                  className="h-full rounded-full bg-gradient-to-r from-[#3B3024] via-[#73522E] to-[#C48D4E] transition-all duration-500"
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
  valueFormatter = defaultFormatter,
  tooltipUnit = 'Orders',
  summaryLabel = 'Total Orders',
  showRangeToggle = true,
  className,
}: LineTrendProps): JSX.Element {
  const [range, setRange] = useState<RangeKey>('30d');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const gradientId = useId();

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

  const width = Math.max(700, filteredData.length * 36);
  const height = 220;
  const paddingX = 44;
  const paddingY = 20;
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;
  const yAxisTicks = 5;
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
    <section className={cn('rounded-xl border border-stone-200 bg-white p-5 shadow-sm', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-heading-sm font-semibold text-stone-900">{title}</h3>
          {subtitle && <p className="mt-1 text-body-sm text-stone-500">{subtitle}</p>}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-end gap-2">
            <span className="text-label-md font-medium text-stone-600">{summaryLabel}:</span>
            <span className="text-heading-md font-semibold text-espresso">{valueFormatter(totalOrders)}</span>
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
            <div className="inline-flex w-full items-center rounded-lg border border-stone-200 bg-stone-100 p-1">
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

      <div className="mt-5 overflow-x-auto">
        <div style={{ minWidth: `${width}px` }}>
          <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title} className="w-full">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C4862A" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#C4862A" stopOpacity="0" />
              </linearGradient>
            </defs>

            {yTicks.map((tick) => (
              <g key={`${tick.y}-${tick.value}`}>
                <line
                  x1={paddingX}
                  y1={tick.y}
                  x2={paddingX + innerWidth}
                  y2={tick.y}
                  stroke="#E8E5E1"
                  strokeWidth={1}
                  strokeDasharray="4 5"
                  strokeOpacity={0.75}
                />
                <text
                  x={10}
                  y={tick.y + 4}
                  className="fill-stone-500 text-[10px] font-medium"
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
                stroke="#2C1A12"
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
                  fill="#F5F0E8"
                  stroke="#C4862A"
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

  const width = Math.max(700, templateData.length * 36);
  const height = 240;
  const paddingX = 44;
  const paddingY = 20;
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;
  const baselineY = height - paddingY;
  const yAxisTicks = 5;

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
    <section className={cn('rounded-xl border border-stone-200 bg-white p-5 shadow-sm', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-heading-sm font-semibold text-stone-900">{title}</h3>
          {subtitle && <p className="mt-1 text-body-sm text-stone-500">{subtitle}</p>}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-end gap-2">
            <span className="text-label-md font-medium text-stone-600">{summaryLabel}:</span>
            <span className="text-heading-md font-semibold text-espresso">{valueFormatter(total)}</span>
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

      <div className="mt-4 flex flex-wrap gap-3">
        {alignedSeries.map((entry, index) => (
          <div key={entry.id} className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getSeriesColor(index, entry.color) }} />
            <span className="text-label-sm text-stone-700">{entry.label}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto">
        <div style={{ minWidth: `${width}px` }}>
          <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title} className="w-full">
            {yTicks.map((tick) => (
              <g key={`${tick.y}-${tick.value}`}>
                <line
                  x1={paddingX}
                  y1={tick.y}
                  x2={paddingX + innerWidth}
                  y2={tick.y}
                  stroke="#E8E5E1"
                  strokeWidth={1}
                  strokeDasharray="4 5"
                  strokeOpacity={0.75}
                />
                <text x={10} y={tick.y + 4} className="fill-stone-500 text-[10px] font-medium">
                  {valueFormatter(Math.round(tick.value))}
                </text>
              </g>
            ))}

            {linePaths.map((path, index) => (
              <path
                key={`${alignedSeries[index]?.id ?? index}-path`}
                d={path}
                fill="none"
                stroke={getSeriesColor(index, alignedSeries[index]?.color)}
                strokeWidth={2.5}
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
                    fill="#F5F0E8"
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
      </div>
    </section>
  );
}

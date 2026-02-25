import { cn } from '@/lib/cn';

interface ChartDatum {
  label: string;
  value: number;
  caption?: string;
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
  className?: string;
}

const defaultFormatter = (value: number): string => String(value);

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
  className,
}: LineTrendProps): JSX.Element {
  const width = 640;
  const height = 220;
  const paddingX = 28;
  const paddingY = 18;
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;

  const safeData = data.length > 0 ? data : [{ label: '', value: 0 }];
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

  const polylinePoints = points.map((point) => `${point.x},${point.y}`).join(' ');
  const areaPoints = `${paddingX},${height - paddingY} ${polylinePoints} ${paddingX + innerWidth},${height - paddingY}`;

  const yTicks = [0, 1, 2, 3, 4].map((index) => {
    const ratio = index / 4;
    const value = maxValue * (1 - ratio);
    const y = paddingY + innerHeight * ratio;
    return {
      y,
      value,
    };
  });

  return (
    <section className={cn('rounded-xl border border-stone-200 bg-white p-5 shadow-sm', className)}>
      <h3 className="text-heading-sm font-semibold text-stone-900">{title}</h3>
      {subtitle && <p className="mt-1 text-body-sm text-stone-500">{subtitle}</p>}

      <div className="mt-5 overflow-x-auto">
        <div className="min-w-[640px]">
          <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title} className="w-full">
            <defs>
              <linearGradient id="wendo-line-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C4862A" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#C4862A" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {yTicks.map((tick) => (
              <g key={tick.y}>
                <line
                  x1={paddingX}
                  y1={tick.y}
                  x2={paddingX + innerWidth}
                  y2={tick.y}
                  stroke="#E8E5E1"
                  strokeWidth={1}
                />
                <text
                  x={6}
                  y={tick.y + 4}
                  className="fill-stone-500 text-[10px] font-medium"
                >
                  {valueFormatter(Math.round(tick.value))}
                </text>
              </g>
            ))}

            <polygon points={areaPoints} fill="url(#wendo-line-fill)" />
            <polyline
              points={polylinePoints}
              fill="none"
              stroke="#2C1810"
              strokeWidth={3}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {points.map((point) => (
              <g key={`${point.label}-${point.x}`}>
                <circle cx={point.x} cy={point.y} r={5} fill="#F5F0E8" stroke="#C4862A" strokeWidth={2} />
              </g>
            ))}

            {points.map((point) => (
              <text
                key={`${point.label}-${point.x}-label`}
                x={point.x}
                y={height - 2}
                textAnchor="middle"
                className="fill-stone-600 text-[10px] font-medium"
              >
                {point.label}
              </text>
            ))}
          </svg>
        </div>
      </div>
    </section>
  );
}


interface GaugeProps {
  value: number; // 0-100
  label: string;
  metric?: "fuel" | "power" | "co2" | "diesel" | "efficiency";
  colorClass?: string; // optional override
}

export default function Gauge({
  value,
  label,
  metric,
  colorClass,
}: GaugeProps) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * c;

  // Choose color by metric or thresholds
  let colorVar = "--metric-power"; // default
  if (metric === "diesel") colorVar = "--metric-diesel";
  if (metric === "power") colorVar = "--metric-power";
  if (metric === "co2") colorVar = "--metric-co2";
  if (metric === "efficiency") colorVar = "--metric-yellow";
  if (metric === "fuel") {
    colorVar =
      pct < 20
        ? "--metric-red"
        : pct < 50
          ? "--metric-yellow"
          : "--metric-green";
  }

  const styleColor = colorClass
    ? undefined
    : ({ color: `hsl(var(${colorVar}))` } as React.CSSProperties);

  return (
    <div className="rounded-xl border border-white/20 bg-card p-6 lg:p-8 shadow-none h-36 md:h-40 lg:h-44 flex flex-col items-center justify-center text-center">
      <div className="flex flex-col items-center">
        <div className="text-lg lg:text-xl uppercase tracking-wider text-white/90 mb-2">{label}</div>
        <svg viewBox="0 0 100 100" className="h-24 w-24 lg:h-28 lg:w-28">
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="10"
            strokeLinecap="round"
          />
          {metric === "power" && (
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={`hsl(var(--metric-red))`}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${0.25 * c} ${0.75 * c}`}
              strokeDashoffset={`${0.75 * c}`}
              transform="rotate(-90 50 50)"
              opacity={0.6}
            />
          )}
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="currentColor"
            className={colorClass}
            style={styleColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
            transform="rotate(-90 50 50)"
          />
          <text
            x="50"
            y="54"
            textAnchor="middle"
            className="fill-foreground text-base lg:text-lg font-extrabold"
          >
            {pct.toFixed(0)}%
          </text>
        </svg>
        <div className="mt-2 text-4xl lg:text-5xl font-extrabold text-white">{pct.toFixed(1)}%</div>
      </div>
    </div>
  );
}

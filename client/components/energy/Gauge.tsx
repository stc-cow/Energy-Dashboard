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
  // Donut meter sized to avoid clipping
  const r = 42;
  const cx = 50, cy = 50;
  const pct = Math.max(0, Math.min(100, value));
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct / 100);

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

  // Pointer angle (top = 0%) clockwise
  const theta = -Math.PI / 2 + (2 * Math.PI * pct) / 100;
  const px = cx + (r - 6) * Math.cos(theta);
  const py = cy + (r - 6) * Math.sin(theta);

  return (
    <div className="rounded-xl border border-white/20 bg-card p-6 lg:p-8 shadow-none h-[315px] flex flex-col items-center justify-center text-center">
      <div className="flex flex-col items-center">
        <div className="text-lg lg:text-xl uppercase tracking-wider text-white/90 mb-2">{label}</div>
        <svg viewBox="0 0 100 100" className="h-40 w-40 sm:h-44 sm:w-44 mx-auto" style={styleColor}>
          {/* Track */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={12} />
          {/* Progress */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={colorClass ? undefined : "currentColor"}
            className={colorClass}
            strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={offset}
            transform="rotate(-90 50 50)"
          />
          {/* Center pointer */}
          <line
            x1={cx}
            y1={cy}
            x2={px}
            y2={py}
            stroke={colorClass ? undefined : "currentColor"}
            className={colorClass}
            strokeWidth={3}
            strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r={3} fill="white" stroke="#0b0b0b" strokeWidth={1} />
        </svg>
        <div className="mt-3 text-5xl lg:text-6xl font-extrabold text-white">{pct.toFixed(1)}%</div>
        {metric === "fuel" && (
          <div className="text-xs text-white/80 mt-1">Current Tank Average Level</div>
        )}
      </div>
    </div>
  );
}

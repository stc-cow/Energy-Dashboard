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
  // Radius leaves padding so the stroke doesn't clip the viewBox
  const r = 44;
  const pct = Math.max(0, Math.min(100, value));

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

  // Semicircle helpers (left=0%, right=100%) using BOTTOM half
  const cx = 50, cy = 50;
  const toXY = (ang: number) => ({ x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
  const arcPath = (start: number, end: number) => {
    const s = toXY(start);
    const e = toXY(end);
    const largeArc = 0; // <= 180°
    const sweep = 1; // clockwise (bottom arc)
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} ${sweep} ${e.x} ${e.y}`;
  };
  // Map 0% (left) -> π, 100% (right) -> 0 across bottom half
  const angleFor = (p: number) => Math.PI * (1 - p);
  const startAngle = angleFor(0); // π
  const greenEnd = angleFor(0.6);
  const yellowEnd = angleFor(0.85);
  const endAngle = angleFor(1); // 0
  const progressAngle = angleFor(pct / 100);

  return (
    <div className="rounded-xl border border-white/20 bg-card p-6 lg:p-8 shadow-none h-72 md:h-80 lg:h-96 flex flex-col items-center justify-center text-center">
      <div className="flex flex-col items-center">
        <div className="text-lg lg:text-xl uppercase tracking-wider text-white/90 mb-2">{label}</div>
        <svg viewBox="0 0 100 100" className="h-56 w-56 lg:h-64 lg:w-64 mx-auto">
          {/* green 0-60% */}
          <path d={arcPath(startAngle, greenEnd)} fill="none" stroke={`hsl(var(--metric-green))`} strokeWidth={12} strokeLinecap="round" />
          {/* yellow 60-85% */}
          <path d={arcPath(greenEnd, yellowEnd)} fill="none" stroke={`hsl(var(--metric-yellow))`} strokeWidth={12} strokeLinecap="round" />
          {/* red 85-100% */}
          <path d={arcPath(yellowEnd, endAngle)} fill="none" stroke={`hsl(var(--metric-red))`} strokeWidth={12} strokeLinecap="round" />

          {/* pointer needle */}
          {(() => {
            const a = progressAngle;
            const xt = cx + (r - 2) * Math.cos(a);
            const yt = cy + (r - 2) * Math.sin(a);
            return (
              <g>
                <line x1={cx} y1={cy} x2={xt} y2={yt} stroke="#0b0b0b" strokeWidth={3} strokeLinecap="round" />
                <circle cx={cx} cy={cy} r={3} fill="white" stroke="#0b0b0b" strokeWidth={1} />
              </g>
            );
          })()}
        </svg>
        <div className="mt-3 text-5xl lg:text-6xl font-extrabold text-white">{pct.toFixed(1)}%</div>
        {metric === "fuel" && (
          <div className="text-xs text-white/80 mt-1">Current Tank Average Level</div>
        )}
      </div>
    </div>
  );
}

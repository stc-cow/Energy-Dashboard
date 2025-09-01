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

  // Semicircle helpers (left=0%, right=100%) using TOP half (π to 0)
  const cx = 50, cy = 50;
  const toXY = (ang: number) => ({ x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
  const arcPath = (start: number, end: number) => {
    const s = toXY(start);
    const e = toXY(end);
    const largeArc = 0; // <= 180°
    const sweep = 1; // clockwise (bottom arc)
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} ${sweep} ${e.x} ${e.y}`;
  };
  const startAngle = Math.PI; // left
  const endAngle = Math.PI * 2; // right (360°)
  const progressAngle = Math.PI + (pct / 100) * Math.PI;

  return (
    <div className="rounded-xl border border-white/20 bg-card p-6 lg:p-8 shadow-none h-56 md:h-64 lg:h-72 flex flex-col items-center justify-center text-center">
      <div className="flex flex-col items-center">
        <div className="text-lg lg:text-xl uppercase tracking-wider text-white/90 mb-2">{label}</div>
        <svg viewBox="0 0 100 100" className="h-40 w-40 lg:h-48 lg:w-48">
          {/* base semicircle track */}
          <path d={arcPath(startAngle, endAngle)} fill="none" stroke="hsl(var(--muted))" strokeWidth={10} strokeLinecap="round" />

          {/* risk arc (last 25%) for generator load */}
          {metric === "power" && (
            <path d={arcPath(Math.PI * 1.75, endAngle)} fill="none" stroke={`hsl(var(--metric-red))`} strokeOpacity={0.6} strokeWidth={10} strokeLinecap="round" />
          )}

          {/* progress arc */}
          <path d={arcPath(startAngle, progressAngle)} fill="none" stroke="currentColor" className={colorClass} style={styleColor} strokeWidth={10} strokeLinecap="round" />

          {/* pointer needle */}
          {(() => {
            const a = progressAngle;
            const xt = cx + (r - 2) * Math.cos(a);
            const yt = cy + (r - 2) * Math.sin(a);
            return (
              <g>
                <line x1={cx} y1={cy} x2={xt} y2={yt} stroke="currentColor" style={styleColor} strokeWidth={3} strokeLinecap="round" />
                <circle cx={cx} cy={cy} r={2.5} fill="white" />
              </g>
            );
          })()}
        </svg>
        <div className="mt-2 text-4xl lg:text-5xl font-extrabold text-white">{pct.toFixed(1)}%</div>
        {metric === "fuel" && (
          <div className="text-xs text-white/80 mt-1">Current Tank Average Level</div>
        )}
      </div>
    </div>
  );
}

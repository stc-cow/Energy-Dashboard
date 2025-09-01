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

  return (
    <div className="rounded-xl border border-white/20 bg-card p-6 lg:p-8 shadow-none h-56 md:h-64 lg:h-72 flex flex-col items-center justify-center text-center">
      <div className="flex flex-col items-center">
        <div className="text-lg lg:text-xl uppercase tracking-wider text-white/90 mb-2">{label}</div>
        <svg viewBox="0 0 100 100" className="h-40 w-40 lg:h-48 lg:w-48">
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
          <text x="50" y="54" textAnchor="middle" className="fill-foreground text-base lg:text-lg font-extrabold">{pct.toFixed(0)}%</text>
          {Array.from({ length: 11 }).map((_, i) => {
            const a = i * 0.1 * Math.PI * 2 - Math.PI / 2;
            const x1 = 50 + r * Math.cos(a);
            const y1 = 50 + r * Math.sin(a);
            const x2 = 50 + (r - (i % 5 === 0 ? 8 : 5)) * Math.cos(a);
            const y2 = 50 + (r - (i % 5 === 0 ? 8 : 5)) * Math.sin(a);
            return (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.6)" strokeWidth={i % 5 === 0 ? 2 : 1} />
            );
          })}
          {(() => {
            const a = (pct / 100) * Math.PI * 2 - Math.PI / 2;
            const xt = 50 + (r - 2) * Math.cos(a);
            const yt = 50 + (r - 2) * Math.sin(a);
            return (
              <g>
                <line x1={50} y1={50} x2={xt} y2={yt} stroke="currentColor" style={styleColor} strokeWidth={3} strokeLinecap="round" />
                <circle cx={50} cy={50} r={2.5} fill="white" />
              </g>
            );
          })()}
        </svg>
        <div className="mt-1 w-full px-6 flex items-center justify-between text-white/70 text-xs">
          <span>0%</span>
          <span>100%</span>
        </div>
        <div className="mt-2 text-4xl lg:text-5xl font-extrabold text-white">{pct.toFixed(1)}%</div>
        {metric === "fuel" && (
          <div className="text-xs text-white/80 mt-1">Current Tank Average Level</div>
        )}
      </div>
    </div>
  );
}

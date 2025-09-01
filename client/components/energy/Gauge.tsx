interface GaugeProps {
  value: number; // 0-100
  label: string;
  metric?: "fuel" | "power" | "co2" | "diesel" | "efficiency";
  colorClass?: string; // optional override
}

export default function Gauge({ value, label, metric, colorClass }: GaugeProps) {
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
    colorVar = pct < 20 ? "--metric-red" : pct < 50 ? "--metric-yellow" : "--metric-green";
  }

  const styleColor = colorClass ? undefined : { color: `hsl(var(${colorVar}))` } as React.CSSProperties;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 100 100" className="h-20 w-20">
          <circle cx="50" cy="50" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" strokeLinecap="round" />
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
          <text x="50" y="54" textAnchor="middle" className="fill-foreground text-sm font-semibold">{pct.toFixed(0)}%</text>
        </svg>
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="text-lg font-semibold">{pct.toFixed(1)}%</div>
        </div>
      </div>
    </div>
  );
}

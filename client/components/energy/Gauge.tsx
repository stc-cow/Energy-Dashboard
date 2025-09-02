import GaugeChart from "react-gauge-chart";

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
  const pct = Math.max(0, Math.min(100, value));

  // Colors by thresholds
  const green = "hsl(var(--metric-green))";
  const yellow = "hsl(var(--metric-yellow))";
  const red = "hsl(var(--metric-red))";

  return (
    <div className="rounded-xl border border-white/20 bg-card p-6 lg:p-8 shadow-none h-[315px] flex flex-col items-center justify-center text-center">
      <div className="flex flex-col items-center">
        <div className="text-lg lg:text-xl uppercase tracking-wider text-white/90 mb-2">{label}</div>
        <div className="w-72">
          <GaugeChart
            id={`gauge-${label}`}
            nrOfLevels={20}
            arcsLength={[0.6, 0.25, 0.15]}
            colors={[green, yellow, red]}
            percent={pct / 100}
            needleColor="#ffffff"
            textColor="#ffffff"
            arcWidth={0.3}
            style={{ width: "100%" }}
          />
        </div>
        <div className="mt-2 text-5xl lg:text-6xl font-extrabold text-white">{pct.toFixed(1)}%</div>
        {metric === "fuel" && (
          <div className="text-xs text-white/80 mt-1">Current Tank Average Level</div>
        )}
      </div>
    </div>
  );
}

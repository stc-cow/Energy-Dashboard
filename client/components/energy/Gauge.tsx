import GaugeChart from "react-gauge-chart";

interface GaugeProps {
  value: number; // 0-100
  label: string;
  metric?: "fuel" | "power" | "co2" | "diesel" | "efficiency";
  colorClass?: string; // optional override
  height?: number; // px
}

export default function Gauge({
  value,
  label,
  metric,
  colorClass,
  height = 315,
}: GaugeProps) {
  const pct = Math.max(0, Math.min(100, value));

  // Colors: Red 0–25%, Yellow 25–50%, Green 50–100%
  const green = "hsl(var(--metric-green))";
  const yellow = "hsl(var(--metric-yellow))";
  const red = "hsl(var(--metric-red))";
  const colorsArr = [red, yellow, green];
  const arcs = [0.25, 0.25, 0.5];

  return (
    <div
      className="rounded-xl border border-white/20 bg-card p-6 lg:p-8 shadow-none flex flex-col items-center justify-center text-center"
      style={{ height }}
    >
      <div className="flex flex-col items-center">
        <div className="text-lg lg:text-xl tracking-wider text-white/90 mb-2 font-bold">
          {label}
        </div>
        <div className="w-72">
          <GaugeChart
            id={`gauge-${label}`}
            nrOfLevels={3}
            arcsLength={arcs}
            colors={colorsArr}
            percent={pct / 100}
            needleColor="#ffffff"
            textColor="transparent"
            formatTextValue={() => ""}
            arcWidth={0.3}
            cornerRadius={0}
            // @ts-ignore: arcPadding is supported by library but not in our d.ts
            arcPadding={0}
            style={{ width: "100%" }}
          />
        </div>
        <div className="mt-2 text-5xl lg:text-6xl font-extrabold text-white">
          {pct.toFixed(1)}%
        </div>
        {metric === "fuel" && (
          <div className="text-xs text-white/80 mt-1 font-bold">
            Current Tank Average Level
          </div>
        )}
      </div>
    </div>
  );
}

import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";

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

  // Chart sizing and pointer math
  const W = 240;
  const H = 160;
  const cx = W / 2;
  const cy = H; // place center at bottom for top half gauge
  const outerR = Math.min(cx, cy); // 120
  const innerR = outerR * 0.6; // matches innerRadius="60%"
  const ptrR = (innerR + outerR) / 2;
  const deg = 180 - (180 * pct) / 100; // 0..180 mapped to right..left
  const rad = (deg * Math.PI) / 180;
  const px = cx + ptrR * Math.cos(rad);
  const py = cy - ptrR * Math.sin(rad);

  return (
    <div className="rounded-xl border border-white/20 bg-card p-6 lg:p-8 shadow-none h-[315px] flex flex-col items-center justify-center text-center">
      <div className="flex flex-col items-center">
        <div className="text-lg lg:text-xl uppercase tracking-wider text-white/90 mb-2">{label}</div>
        <div className="mx-auto" style={styleColor}>
          <RadialBarChart
            width={W}
            height={H}
            cx={"50%"}
            cy={"100%"}
            innerRadius="60%"
            outerRadius="100%"
            barSize={14}
            startAngle={180}
            endAngle={0}
            data={[{ value: pct }]}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} angleAxisId={0} />
            <RadialBar
              clockWise
              background
              dataKey="value"
              cornerRadius={10}
              fill={colorClass ? undefined : "currentColor"}
              className={colorClass}
            />
            {/* Pointer overlay */}
            <g>
              <line x1={cx} y1={cy} x2={px} y2={py} stroke={colorClass ? undefined : "currentColor"} className={colorClass} strokeWidth={3} strokeLinecap="round" />
              <circle cx={cx} cy={cy} r={3} fill="white" stroke="#0b0b0b" strokeWidth={1} />
            </g>
          </RadialBarChart>
        </div>
        <div className="mt-2 text-5xl lg:text-6xl font-extrabold text-white">{pct.toFixed(1)}%</div>
        {metric === "fuel" && (
          <div className="text-xs text-white/80 mt-1">Current Tank Average Level</div>
        )}
      </div>
    </div>
  );
}

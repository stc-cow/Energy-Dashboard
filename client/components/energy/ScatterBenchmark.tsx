import { BenchmarkPoint } from "@shared/api";
import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

export default function ScatterBenchmark({ data }: { data: BenchmarkPoint[] }) {
  const d = data.map((p) => ({
    name: p.siteName,
    Diesel: p.dieselLiters,
    Power: p.powerKw,
    CO2: p.co2Tons,
  }));
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-2 text-sm font-semibold">
        Benchmark: Diesel vs Power (bubble = CO₂)
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
            <CartesianGrid
              stroke="rgba(255,255,255,0.2)"
              strokeDasharray="3 3"
            />
            <XAxis
              type="number"
              dataKey="Diesel"
              name="Diesel (L/day)"
              tick={{ fontSize: 12, fill: "#fff" }}
            />
            <YAxis
              type="number"
              dataKey="Power"
              name="Power (kW)"
              tick={{ fontSize: 12, fill: "#fff" }}
            />
            <ZAxis
              type="number"
              dataKey="CO2"
              range={[60, 400]}
              name="CO₂ (t/day)"
            />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} />
            <Legend />
            <Scatter name="Sites" data={d} fill="hsl(var(--metric-power))" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

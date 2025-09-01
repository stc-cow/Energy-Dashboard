import { BreakdownPoint } from "@shared/api";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function StackedBar({
  data,
  title,
}: {
  data: BreakdownPoint[];
  title: string;
}) {
  const d = data.map((p) => ({
    name: p.name,
    Diesel: p.dieselLiters,
    Energy: p.energyKwh,
  }));
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-2 text-sm font-semibold">{title}</div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={d} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
            <CartesianGrid
              stroke="rgba(255,255,255,0.2)"
              strokeDasharray="3 3"
            />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#fff" }} />
            <YAxis tick={{ fontSize: 12, fill: "#fff" }} />
            <Tooltip />
            <Legend />
            <Bar
              dataKey="Diesel"
              stackId="a"
              fill="hsl(var(--metric-diesel))"
            />
            <Bar dataKey="Energy" stackId="a" fill="hsl(var(--metric-power))" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

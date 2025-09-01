import { TimePoint } from "@shared/api";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function TimeSeriesChart({ data }: { data: TimePoint[] }) {
  const d = data.map((p) => ({
    t: new Date(p.t).toLocaleDateString(),
    Diesel: p.dieselLiters,
    CO2: p.co2Tons,
    Efficiency: p.efficiencyKwhPerLiter,
  }));
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-2 text-sm font-semibold">Trends: Diesel, CO₂, Efficiency</div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={d} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="d1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="t" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="l" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Area yAxisId="l" type="monotone" dataKey="Diesel" stroke="hsl(var(--primary))" fill="url(#d1)" />
            <Area yAxisId="l" type="monotone" dataKey="CO2" stroke="#10b981" fillOpacity={0.1} fill="#10b981" />
            <Area yAxisId="r" type="monotone" dataKey="Efficiency" stroke="#f59e0b" fillOpacity={0.05} fill="#f59e0b" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

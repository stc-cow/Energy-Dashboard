import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { TimePoint } from "@shared/api";

export default function Co2EmissionsChart({ data }: { data: TimePoint[] }) {
  const chartData = data.map((p) => ({
    date: new Date(p.t).toLocaleDateString(),
    co2: p.co2Tons,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis dataKey="date" stroke="rgba(255,255,255,0.6)" />
        <YAxis stroke="rgba(255,255,255,0.6)" />
        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(0,0,0,0.8)",
            border: "1px solid rgba(255,255,255,0.2)",
          }}
          labelStyle={{ color: "#fff" }}
        />
        <Legend />
        <Line
          dataKey="co2"
          name="CO₂ Emissions (Tons)"
          stroke="#ff3b3b"
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

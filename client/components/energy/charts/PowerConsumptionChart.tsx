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

export default function PowerConsumptionChart({ accum }: { accum: number }) {
  const chartData = [
    { date: "2025-01-01", power: accum * 0.1 },
    { date: "2025-01-02", power: accum * 0.2 },
    { date: "2025-01-03", power: accum * 0.35 },
    { date: "2025-01-04", power: accum * 0.5 },
    { date: "2025-01-05", power: accum * 0.65 },
    { date: "2025-01-06", power: accum * 0.8 },
    { date: "2025-01-07", power: accum },
  ];

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
          dataKey="power"
          name="Power Consumption (kWh)"
          stroke="#aaf255"
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

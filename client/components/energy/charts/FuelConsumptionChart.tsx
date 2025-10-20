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
import { useMemo } from "react";
import { makeCumulative } from "@/lib/chartUtils";

export default function FuelConsumptionChart({ data }: { data: any[] }) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // Make accumulative
    const cumulative = makeCumulative(data, ["fuel_consumption_l_total"]);
    
    return cumulative.map((row) => ({
      date: row.date,
      fuel: row.fuel_consumption_l_total || 0,
    }));
  }, [data]);

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
          type="monotone"
          dataKey="fuel"
          name="Fuel Consumption (L)"
          stroke="#ffcc00"
          strokeWidth={2}
          dot={false}
          isAnimationActive={true}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

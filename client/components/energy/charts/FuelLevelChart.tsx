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
import { extractMetricByCities } from "@/lib/chartUtils";

const CITY_COLORS = [
  "#00e0ff",
  "#ff3b3b",
  "#ffcc00",
  "#aaf255",
  "#ff9900",
  "#9d4edd",
  "#3a86ff",
  "#fb5607",
];

export default function FuelLevelChart({ data, cities }: { data: any[]; cities: string[] }) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    return extractMetricByCities(data, "fuel_level_%", cities);
  }, [data, cities]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis dataKey="date" stroke="rgba(255,255,255,0.6)" />
        <YAxis stroke="rgba(255,255,255,0.6)" domain={[0, 100]} />
        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(0,0,0,0.8)",
            border: "1px solid rgba(255,255,255,0.2)",
          }}
          labelStyle={{ color: "#fff" }}
        />
        <Legend />
        {cities.map((city, idx) => (
          <Line
            key={city}
            type="monotone"
            dataKey={city}
            name={`${city} Fuel Level (%)`}
            stroke={CITY_COLORS[idx % CITY_COLORS.length]}
            strokeWidth={2}
            dot={false}
            isAnimationActive={true}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

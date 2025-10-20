import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useMemo } from "react";
import { extractMetricByCities } from "@/lib/chartUtils";

const LOAD_COLORS = [
  "#ff9900",
  "#ff3b3b",
  "#aaf255",
  "#00e0ff",
  "#9d4edd",
  "#3a86ff",
  "#fb5607",
  "#ffcc00",
];

export default function GeneratorLoadChart({ data, cities }: { data: any[]; cities: string[] }) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0 || !cities || cities.length === 0) {
      return [];
    }
    
    return extractMetricByCities(data, "gen_load_%", cities);
  }, [data, cities]);

  if (!cities || cities.length === 0 || chartData.length === 0) {
    return <div className="text-white/60 p-4">No data available</div>;
  }

  // Limit to max 5 cities for better visualization
  const displayCities = cities.slice(0, 5);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis dataKey="date" stroke="rgba(255,255,255,0.6)" tick={{ fontSize: 12 }} />
        <YAxis stroke="rgba(255,255,255,0.6)" domain={[0, 100]} />
        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(0,0,0,0.8)",
            border: "1px solid rgba(255,255,255,0.2)",
          }}
          labelStyle={{ color: "#fff" }}
        />
        <Legend wrapperStyle={{ paddingTop: "16px" }} />
        {displayCities.map((city, idx) => (
          <Bar
            key={city}
            dataKey={city}
            name={`${city}`}
            fill={LOAD_COLORS[idx % LOAD_COLORS.length]}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

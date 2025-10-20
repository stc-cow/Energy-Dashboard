import {
  ComposedChart,
  Bar,
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
    if (!data || data.length === 0 || !cities || cities.length === 0) {
      return [];
    }
    
    const extracted = extractMetricByCities(data, "fuel_level_%", cities);
    
    // Calculate average for each date
    return extracted.map((row) => {
      const values = cities.map((city) => row[city] || 0);
      const average = values.reduce((a, b) => a + b, 0) / values.length;
      return {
        ...row,
        average: Math.round(average * 10) / 10,
      };
    });
  }, [data, cities]);

  if (!cities || cities.length === 0 || chartData.length === 0) {
    return <div className="text-white/60 p-4">No data available</div>;
  }

  // Limit to max 5 cities for better visualization
  const displayCities = cities.slice(0, 5);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={chartData} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
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
            fill={CITY_COLORS[idx % CITY_COLORS.length]}
            isAnimationActive={false}
            yAxisId="left"
          />
        ))}
        <Line
          type="monotone"
          dataKey="average"
          name="Average"
          stroke="#ffffff"
          strokeWidth={3}
          dot={false}
          isAnimationActive={false}
          yAxisId="left"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

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

const CO2_COLORS = [
  "#4B0082",
  "#00C5D4",
  "#FF3B61",
  "#FF7A33",
];

export default function Co2EmissionsChart({ data }: { data: any[] }) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // Extract all cities from data keys
    const citySet = new Set<string>();
    data.forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (key.startsWith("co2_emissions_tons_")) {
          const city = key.replace("co2_emissions_tons_", "");
          citySet.add(city);
        }
      });
    });

    const cities = Array.from(citySet).sort();

    return data.map((row) => {
      const result: any = { date: row.date };
      cities.forEach((city) => {
        result[city] = row[`co2_emissions_tons_${city}`] || 0;
      });
      return result;
    });
  }, [data]);

  if (chartData.length === 0) {
    return <div className="text-white/60 p-4">No data available</div>;
  }

  // Get cities from first row
  const cities = chartData.length > 0
    ? Object.keys(chartData[0]).filter(k => k !== "date")
    : [];

  const displayCities = cities.slice(0, 4);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis dataKey="date" stroke="rgba(255,255,255,0.6)" tick={{ fontSize: 12 }} />
        <YAxis stroke="rgba(255,255,255,0.6)" />
        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(0,0,0,0.8)",
            border: "1px solid rgba(255,255,255,0.2)",
          }}
          labelStyle={{ color: "#fff" }}
        />
        <Legend wrapperStyle={{ paddingTop: "16px" }} />
        {displayCities.map((city, idx) => (
          <Line
            key={city}
            type="monotone"
            dataKey={city}
            name={city}
            stroke={CO2_COLORS[idx % CO2_COLORS.length]}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

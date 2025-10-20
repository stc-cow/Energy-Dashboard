import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useMemo } from "react";

const CITY_COLORS = ["#4B0082", "#00C5D4", "#FF3B61", "#FF7A33"];

export default function FuelLevelChart({
  data,
  cities,
}: {
  data: any[];
  cities: string[];
}) {
  const { chartData, displayItems, averageValue } = useMemo(() => {
    if (!data || data.length === 0) {
      return { chartData: [], displayItems: [], averageValue: 0 };
    }

    // Extract all keys from the data row that represent regions/districts (excluding "name" and "gen_*" keys)
    const row = data[0];
    const displayItems: string[] = [];
    const allValues: number[] = [];

    Object.keys(row).forEach((key) => {
      if (key !== "name" && !key.startsWith("gen_")) {
        displayItems.push(key);
        const val = row[key];
        if (typeof val === "number") {
          allValues.push(val);
        }
      }
    });

    const avg =
      allValues.length > 0
        ? Math.round(
            (allValues.reduce((a, b) => a + b, 0) / allValues.length) * 10,
          ) / 10
        : 0;

    return { chartData: data, displayItems, averageValue: avg };
  }, [data, cities]);

  if (!displayItems || displayItems.length === 0 || chartData.length === 0) {
    return <div className="text-white/60 p-4">No data available</div>;
  }

  // Limit to max 5 regions/districts for better visualization
  const displayRegions = displayItems.slice(0, 5);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={{ left: 8, right: 8, top: 10, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis
          dataKey="name"
          stroke="rgba(255,255,255,0.6)"
          tick={{ fontSize: 12 }}
        />
        <YAxis stroke="rgba(255,255,255,0.6)" domain={[0, 100]} />
        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(0,0,0,0.8)",
            border: "1px solid rgba(255,255,255,0.2)",
          }}
          labelStyle={{ color: "#fff" }}
        />
        <Legend wrapperStyle={{ paddingTop: "16px" }} />
        {displayRegions.map((region, idx) => (
          <Bar
            key={region}
            dataKey={region}
            name={region}
            fill={CITY_COLORS[idx % CITY_COLORS.length]}
            isAnimationActive={false}
          />
        ))}
        <ReferenceLine
          y={averageValue}
          stroke="#ffffff"
          strokeWidth={2}
          label={{
            value: `Avg: ${averageValue}%`,
            position: "right",
            fill: "#ffffff",
            fontSize: 12,
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

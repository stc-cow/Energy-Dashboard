import React, { useMemo } from "react";
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
import CustomTooltip from "./CustomTooltip";

const FUEL_COLORS = ["#4B0082", "#00C5D4", "#FF3B61", "#FF7A33"];

function nextMonthLabel(dateStr: string) {
  // dateStr expected "YYYY-MM" or "YYYY-MM-DD" (we support YYYY-MM)
  const parts = dateStr.split("-").map(Number);
  const y = parts[0];
  const m = parts[1] || 1;
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function projectionSeries(accData: any[], monthsToProject = 1) {
  const len = accData.length;
  if (len < 2) return [];
  const last = accData[len - 1];
  const prev = accData[len - 2];

  // keys for cities
  const keys = Object.keys(last).filter((k) => k !== "date");
  const months: any[] = [];

  // compute a simple slope for each key and generate month(s)
  for (let i = 1; i <= monthsToProject; i++) {
    const nextRow: any = { date: nextMonthLabel(last.date) + (i > 1 ? `+${i - 1}` : "") };
    keys.forEach((k) => {
      const vLast = Number(last[k] ?? 0);
      const vPrev = Number(prev[k] ?? 0);
      const slope = vLast - vPrev;
      nextRow[k] = Math.max(0, Math.round(vLast + slope * i));
    });
    months.push(nextRow);
  }
  return months;
}

export default function FuelConsumptionChart({ data }: { data: any[] }) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // Extract cities from keys
    const citySet = new Set<string>();
    data.forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (key.startsWith("fuel_consumption_L_")) {
          const city = key.replace("fuel_consumption_L_", "");
          citySet.add(city);
        }
      });
    });

    const cities = Array.from(citySet).sort();

    const formatted = data.map((row) => {
      const result: any = { date: row.date };
      cities.forEach((city) => {
        result[city] = row[`fuel_consumption_L_${city}`] || 0;
      });
      return result;
    });

    return formatted;
  }, [data]);

  if (chartData.length === 0) {
    return <div className="text-white/60 p-4">No data available</div>;
  }

  // cities keys
  const cities =
    chartData.length > 0
      ? Object.keys(chartData[0]).filter((k) => k !== "date")
      : [];

  const displayCities = cities.slice(0, 4);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
        <XAxis dataKey="date" stroke="#FFFFFF" tick={{ fontSize: 13, fill: "#FFFFFF" }} />
        <YAxis stroke="#FFFFFF" tick={{ fontSize: 13, fill: "#FFFFFF" }} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ paddingTop: "16px", color: "#FFFFFF", fontSize: 13 }} />
        {displayCities.map((city, idx) => (
          <Line
            key={city}
            type="monotone"
            dataKey={city}
            name={city}
            stroke={FUEL_COLORS[idx % FUEL_COLORS.length]}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

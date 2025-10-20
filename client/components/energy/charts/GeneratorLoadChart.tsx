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
      console.warn("GeneratorLoadChart: Missing data or cities", { dataLen: data?.length, citiesLen: cities?.length });
      return [];
    }

    const result = extractMetricByCities(data, "gen_load_%", cities);
    console.log("GeneratorLoadChart data:", result.slice(0, 2), "cities:", cities);
    return result;
  }, [data, cities]);

  if (!cities || cities.length === 0) {
    return <div className="text-white/60 p-4">No cities selected</div>;
  }

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
            name={`${city} Generator Load (%)`}
            stroke={LOAD_COLORS[idx % LOAD_COLORS.length]}
            strokeWidth={2}
            dot={false}
            isAnimationActive={true}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

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

export default function FuelLevelChart({ data }: { data: TimePoint[] }) {
  const cities = ["Riyadh", "Jeddah", "Dammam", "Medina", "Abha"];

  const chartData = data.map((p, idx) => {
    const obj: any = {
      date: new Date(p.t).toLocaleDateString(),
    };
    cities.forEach((city, cityIdx) => {
      obj[city] = Math.max(15, 85 - ((idx + cityIdx) * 3) % 70);
    });
    return obj;
  });

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
            dataKey={city}
            name={`${city} Fuel Level (%)`}
            stroke={CITY_COLORS[idx % CITY_COLORS.length]}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

import React, { useMemo } from "react";
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
import CustomTooltip from "./CustomTooltip";

const CITY_COLORS = ["#4B0082", "#00C5D4", "#FF3B61", "#FF7A33"];

export default function FuelLevelChart({
  data,
  cities,
  lowThreshold = 20,
  highThreshold = 80,
  onBarClick,
}: {
  data: any[];
  cities: string[];
  lowThreshold?: number;
  highThreshold?: number;
  onBarClick?: (regionOrDistrict: string, payload?: any) => void;
}) {
  const { chartData, displayItems, averageValue } = useMemo(() => {
    if (!data || data.length === 0) {
      return { chartData: [], displayItems: [], averageValue: 0 };
    }

    // Extract keys that represent regions/districts (excluding "name" and "gen_*")
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
      <BarChart data={chartData} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
        <XAxis dataKey="name" stroke="#FFFFFF" tick={{ fontSize: 13, fill: "#FFFFFF" }} />
        <YAxis stroke="#FFFFFF" tick={{ fontSize: 13, fill: "#FFFFFF" }} domain={[0, 100]} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ paddingTop: "16px", color: "#FFFFFF", fontSize: 13 }} />
        {displayRegions.map((region, idx) => (
          <Bar
            key={region}
            dataKey={region}
            name={region}
            fill={CITY_COLORS[idx % CITY_COLORS.length]}
            isAnimationActive={false}
            onClick={(payload: any, index: number) => {
              // payload may be the value or object depending on Recharts version; guard
              const regionName = region;
              if (onBarClick) onBarClick(regionName, payload);
            }}
          />
        ))}

        {/* Threshold reference lines */}
        <ReferenceLine
          y={lowThreshold}
          stroke="rgba(255,0,0,0.8)"
          strokeDasharray="3 3"
          label={{ value: `Low ${lowThreshold}%`, position: "right", fill: "#fff" }}
        />
        <ReferenceLine
          y={highThreshold}
          stroke="rgba(0,255,0,0.6)"
          strokeDasharray="3 3"
          label={{ value: `High ${highThreshold}%`, position: "right", fill: "#fff" }}
        />

        {/* Average line */}
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

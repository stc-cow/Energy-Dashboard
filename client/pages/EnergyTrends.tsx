import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  fetchHierarchy,
  fetchTimeSeries,
  fetchAccumulations,
} from "@/lib/api";
import { HierarchyFilter } from "@shared/api";
import FilterBar from "@/components/energy/FilterBar";
import FuelConsumptionChart from "@/components/energy/charts/FuelConsumptionChart";
import Co2EmissionsChart from "@/components/energy/charts/Co2EmissionsChart";
import PowerConsumptionChart from "@/components/energy/charts/PowerConsumptionChart";
import FuelLevelChart from "@/components/energy/charts/FuelLevelChart";
import GeneratorLoadChart from "@/components/energy/charts/GeneratorLoadChart";

export default function EnergyTrends() {
  const [scope, setScope] = useState<HierarchyFilter>({ level: "national" });

  const { data: hierarchy } = useQuery({
    queryKey: ["hierarchy"],
    queryFn: async () => {
      const response = await fetch("/api/hierarchy");
      return response.json();
    },
  });

  const { data: tsDaily } = useQuery({
    queryKey: ["ts", scope, "daily"],
    queryFn: () =>
      fetchTimeSeries(scope, {
        granularity: "daily",
        from: "2025-01-01",
      }),
    enabled: !!hierarchy,
  });

  const { data: accum } = useQuery({
    queryKey: ["accum", scope],
    queryFn: () => fetchAccumulations(scope),
    enabled: !!hierarchy,
  });

  const sites = useMemo(() => hierarchy?.sites ?? [], [hierarchy]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
      <div className="max-w-6xl mx-auto bg-background min-h-screen p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white">
            COW Energy Trends (Accumulative & Current Metrics)
          </h1>
          <button
            onClick={() => window.history.back()}
            className="text-white/80 hover:text-white text-lg"
          >
            ✕
          </button>
        </div>

        {/* Filter Controls */}
        {hierarchy && (
          <div className="mb-8 bg-white/5 p-6 rounded-lg border border-white/10">
            <FilterBar
              regions={hierarchy.regions}
              cities={hierarchy.cities}
              sites={hierarchy.sites}
              scope={scope}
              onChange={setScope}
            />
          </div>
        )}

        {/* Charts Container */}
        <div className="space-y-8">
          {/* Accumulative Fuel Consumption */}
          <div className="rounded-lg border border-white/10 bg-card p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-white mb-4">
              Accumulative Fuel Consumption
            </h2>
            <div className="w-full h-80">
              <FuelConsumptionChart data={tsDaily?.series ?? []} />
            </div>
          </div>

          {/* Accumulative CO₂ Emissions */}
          <div className="rounded-lg border border-white/10 bg-card p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-white mb-4">
              Accumulative CO₂ Emissions
            </h2>
            <div className="w-full h-80">
              <Co2EmissionsChart data={tsDaily?.series ?? []} />
            </div>
          </div>

          {/* Accumulative Power Consumption */}
          <div className="rounded-lg border border-white/10 bg-card p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-white mb-4">
              Accumulative Power Consumption
            </h2>
            <div className="w-full h-80">
              <PowerConsumptionChart accum={accum?.powerKwh ?? 0} />
            </div>
          </div>

          {/* Current Fuel Level per City */}
          <div className="rounded-lg border border-white/10 bg-card p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-white mb-4">
              Current Fuel Level per City
            </h2>
            <div className="w-full h-80">
              <FuelLevelChart data={tsDaily?.series ?? []} />
            </div>
          </div>

          {/* Generator Load Trend */}
          <div className="rounded-lg border border-white/10 bg-card p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-white mb-4">
              Generator Load Trend
            </h2>
            <div className="w-full h-80">
              <GeneratorLoadChart data={tsDaily?.series ?? []} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

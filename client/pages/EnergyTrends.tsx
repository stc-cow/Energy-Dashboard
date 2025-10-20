import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchHierarchy } from "@/lib/api";
import { HierarchyFilter } from "@shared/api";
import Layout from "@/components/layout/Layout";
import FilterBar from "@/components/energy/FilterBar";
import FuelConsumptionChart from "@/components/energy/charts/FuelConsumptionChart";
import Co2EmissionsChart from "@/components/energy/charts/Co2EmissionsChart";
import PowerConsumptionChart from "@/components/energy/charts/PowerConsumptionChart";
import FuelLevelChart from "@/components/energy/charts/FuelLevelChart";
import GeneratorLoadChart from "@/components/energy/charts/GeneratorLoadChart";

interface TrendsResponse {
  data: Array<{ [key: string]: any }>;
  metrics: string[];
  cities: string[];
}

export default function EnergyTrends() {
  const [scope, setScope] = useState<HierarchyFilter>({ level: "national" });

  const { data: hierarchy } = useQuery({
    queryKey: ["hierarchy"],
    queryFn: fetchHierarchy,
  });

  const { data: trendsData, isLoading } = useQuery<TrendsResponse>({
    queryKey: ["energy-trends", scope],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("level", scope.level || "national");
      if (scope.regionId) params.set("regionId", scope.regionId);
      if (scope.cityId) params.set("cityId", scope.cityId);
      if (scope.siteId) params.set("siteId", scope.siteId);
      if (scope.district) params.set("district", scope.district);

      const url = `/api/energy/trends?${params.toString()}`;
      console.log("Fetching trends from:", url);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    },
    enabled: !!hierarchy,
    retry: 1,
  });

  const sites = useMemo(() => hierarchy?.sites ?? [], [hierarchy]);

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">
            COW Energy Trends (Accumulative & Current Metrics)
          </h1>
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
        {trendsData && (
          <div className="space-y-8">
            {/* Accumulative Fuel Consumption */}
            <div className="rounded-lg border border-white/10 bg-card p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-white mb-4">
                Accumulative Fuel Consumption
              </h2>
              <div className="w-full h-80">
                <FuelConsumptionChart data={trendsData.data} />
              </div>
            </div>

            {/* Accumulative CO₂ Emissions */}
            <div className="rounded-lg border border-white/10 bg-card p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-white mb-4">
                Accumulative CO₂ Emissions
              </h2>
              <div className="w-full h-80">
                <Co2EmissionsChart data={trendsData.data} />
              </div>
            </div>

            {/* Accumulative Power Consumption */}
            <div className="rounded-lg border border-white/10 bg-card p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-white mb-4">
                Accumulative Power Consumption
              </h2>
              <div className="w-full h-80">
                <PowerConsumptionChart data={trendsData.data} />
              </div>
            </div>

            {/* Current Fuel Level per City */}
            {trendsData.cities.length > 0 && (
              <div className="rounded-lg border border-white/10 bg-card p-6 shadow-lg">
                <h2 className="text-xl font-semibold text-white mb-4">
                  Current Fuel Level per City
                </h2>
                <div className="w-full h-80">
                  <FuelLevelChart
                    data={trendsData.data}
                    cities={trendsData.cities}
                  />
                </div>
              </div>
            )}

            {/* Generator Load Trend */}
            {trendsData.cities.length > 0 && (
              <div className="rounded-lg border border-white/10 bg-card p-6 shadow-lg">
                <h2 className="text-xl font-semibold text-white mb-4">
                  Generator Load Trend
                </h2>
                <div className="w-full h-80">
                  <GeneratorLoadChart
                    data={trendsData.data}
                    cities={trendsData.cities}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

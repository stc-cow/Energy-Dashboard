import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

// Import mock data function directly for client-side data generation
function generateMockTrendsData(
  scope: HierarchyFilter,
  allCities: { id: string; name: string; regionId?: string }[],
  allSites: { id: string; name: string; cityId: string }[]
): TrendsResponse {
  const seededRandom = (seed: number) => {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  // Filter cities based on scope
  let filteredCities = allCities;

  if (scope.cityId) {
    // If city is selected, only show that city
    filteredCities = allCities.filter((c) => c.id === scope.cityId);
  } else if (scope.regionId) {
    // If region is selected, filter cities in that region
    filteredCities = allCities.filter((c) => c.regionId === scope.regionId);
  }

  // Use city names for the chart
  const cities = filteredCities.map((c) => c.name);

  const days = 30;
  const now = new Date();

  const data = Array.from({ length: days }).map((_, dayIdx) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (days - 1 - dayIdx));
    const dateStr = date.toISOString().split("T")[0];

    const row: any = { date: dateStr };

    // Generate data for each filtered city
    cities.forEach((cityName, cityIdx) => {
      const baseSeed = dayIdx * 100 + cityIdx * 10;
      const diesel = 1000 + Math.floor(seededRandom(baseSeed) * 800);
      const power = 600 + Math.floor(seededRandom(baseSeed + 1) * 400);
      const co2 = Math.round(diesel * 2.68) / 1000;
      const fuelLevel = Math.round((40 + seededRandom(baseSeed + 2) * 50) * 10) / 10;
      const genLoad = Math.round((45 + seededRandom(baseSeed + 3) * 55) * 10) / 10;

      row[`fuel_consumption_l_${cityName}`] = diesel;
      row[`co2_ton_${cityName}`] = co2;
      row[`power_kw_${cityName}`] = power;
      row[`fuel_level_%_${cityName}`] = fuelLevel;
      row[`gen_load_%_${cityName}`] = genLoad;
    });

    // Aggregated totals from filtered cities
    const totalDiesel = cities.reduce((acc, _, i) => {
      return acc + (1000 + Math.floor(seededRandom(dayIdx * 100 + i) * 800));
    }, 0);
    const totalCo2 = Math.round(totalDiesel * 2.68) / 1000;
    const totalPower = cities.reduce((acc, _, i) => {
      return acc + (600 + Math.floor(seededRandom(dayIdx * 100 + i + 1) * 400));
    }, 0);

    row["fuel_consumption_l_total"] = totalDiesel;
    row["co2_ton_total"] = totalCo2;
    row["power_kw_total"] = totalPower;

    return row;
  });

  return {
    data,
    metrics: ["fuel_consumption_l", "co2_ton", "power_kw", "fuel_level_%", "gen_load_%"],
    cities,
  };
}

export default function EnergyTrends() {
  const [scope, setScope] = useState<HierarchyFilter>({ level: "national" });

  const { data: hierarchy } = useQuery({
    queryKey: ["hierarchy"],
    queryFn: fetchHierarchy,
  });

  const trendsData = useMemo(() => {
    if (!hierarchy) return null;
    return generateMockTrendsData(
      scope,
      hierarchy.cities || [],
      hierarchy.sites || []
    );
  }, [hierarchy, scope]);

  const isLoading = !hierarchy;
  const sites = useMemo(() => hierarchy?.sites ?? [], [hierarchy]);
  const allCities = useMemo(() => hierarchy?.cities ?? [], [hierarchy]);

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
        {isLoading && (
          <div className="text-center py-12">
            <p className="text-white/60">Loading trends data...</p>
          </div>
        )}

        {trendsData && trendsData.data && trendsData.data.length > 0 && (
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
            {trendsData.cities && trendsData.cities.length > 0 && (
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
            {trendsData.cities && trendsData.cities.length > 0 && (
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

        {!isLoading && (!trendsData || !trendsData.data || trendsData.data.length === 0) && (
          <div className="text-center py-12">
            <p className="text-white/60">No data available for the selected filters.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}

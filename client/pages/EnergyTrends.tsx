import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchHierarchy, fetchKPIs } from "@/lib/api";
import { HierarchyFilter } from "@shared/api";
import FuelConsumptionChart from "@/components/energy/charts/FuelConsumptionChart";
import Co2EmissionsChart from "@/components/energy/charts/Co2EmissionsChart";
import PowerConsumptionChart from "@/components/energy/charts/PowerConsumptionChart";
import FuelLevelChart from "@/components/energy/charts/FuelLevelChart";
import GeneratorLoadChart from "@/components/energy/charts/GeneratorLoadChart";

interface TrendsResponse {
  currentData: Array<{ [key: string]: any }>;
  accumulativeData: Array<{ [key: string]: any }>;
  metrics: string[];
  cities: string[];
}

function generateMockTrendsData(
  scope: HierarchyFilter,
  allCities: { id: string; name: string; regionId?: string }[],
  allSites: { id: string; name: string; cityId: string; district?: string }[],
): TrendsResponse {
  const currentData: any[] = [];
  const accumulativeData: any[] = [];
  const todayStr = "Today";

  const groupByDistrict = !!scope.district;
  const groupByRegion = !!scope.regionId && !scope.district;

  if (groupByDistrict) {
    currentData.push({
      name: todayStr,
      [scope.district]: Math.random() * 50 + 40,
      [`gen_${scope.district}`]: Math.random() * 50 + 40,
    });
  } else if (groupByRegion) {
    const regionSites = allSites.filter((s) => {
      const city = allCities.find((c) => c.id === s.cityId);
      return city && city.regionId === scope.regionId;
    });
    const districtSet = new Set<string>();
    regionSites.forEach((site) => {
      if (site.district) districtSet.add(site.district);
    });

    const row: any = { name: todayStr };
    Array.from(districtSet).forEach((district) => {
      row[district] = Math.random() * 50 + 40;
      row[`gen_${district}`] = Math.random() * 50 + 40;
    });
    if (Object.keys(row).length > 1) currentData.push(row);
  } else {
    const row: any = { name: todayStr };
    const regionSet = new Set<string>();
    allCities.forEach((city) => {
      if (city.regionId) regionSet.add(city.regionId);
    });
    Array.from(regionSet).forEach((region) => {
      row[region] = Math.random() * 50 + 40;
      row[`gen_${region}`] = Math.random() * 50 + 40;
    });
    if (Object.keys(row).length > 1) currentData.push(row);
  }

  for (let i = 0; i < 12; i++) {
    const monthDate = new Date(2025, i, 1);
    const monthStr = monthDate.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });

    if (groupByDistrict) {
      accumulativeData.push({
        name: monthStr,
        [scope.district]: Math.random() * 500 + 400,
        [`gen_${scope.district}`]: Math.random() * 500 + 400,
      });
    } else if (groupByRegion) {
      const regionSites = allSites.filter((s) => {
        const city = allCities.find((c) => c.id === s.cityId);
        return city && city.regionId === scope.regionId;
      });
      const districtSet = new Set<string>();
      regionSites.forEach((site) => {
        if (site.district) districtSet.add(site.district);
      });

      const row: any = { name: monthStr };
      Array.from(districtSet).forEach((district) => {
        row[district] = Math.random() * 500 + 400;
        row[`gen_${district}`] = Math.random() * 500 + 400;
      });
      if (Object.keys(row).length > 1) accumulativeData.push(row);
    } else {
      const row: any = { name: monthStr };
      const regionSet = new Set<string>();
      allCities.forEach((city) => {
        if (city.regionId) regionSet.add(city.regionId);
      });
      Array.from(regionSet).forEach((region) => {
        row[region] = Math.random() * 500 + 400;
        row[`gen_${region}`] = Math.random() * 500 + 400;
      });
      if (Object.keys(row).length > 1) accumulativeData.push(row);
    }
  }

  return { currentData, accumulativeData, metrics: [], cities: [] };
}

function generateCurrentDataFromRegionalKPIs(
  scope: HierarchyFilter,
  allCities: { id: string; name: string; regionId?: string }[],
  allSites: { id: string; name: string; cityId: string; district?: string }[],
  kpisDataMap: Map<string, any>,
): Array<{ [key: string]: any }> {
  const currentData = [];
  const todayStr = "Today";

  const groupByDistrict = !!scope.district;
  const groupByRegion = !!scope.regionId && !scope.district;

  if (groupByDistrict) {
    const kpisData = kpisDataMap.get(scope.district);
    if (kpisData) {
      const row: any = { name: todayStr };
      row[scope.district] = kpisData.fuelTankLevelPct?.value || 0;
      row[`gen_${scope.district}`] = kpisData.generatorLoadFactorPct?.value || 0;
      currentData.push(row);
    }
  } else if (groupByRegion) {
    const regionSites = allSites.filter((s) => {
      const city = allCities.find((c) => c.id === s.cityId);
      return city && city.regionId === scope.regionId;
    });
    const districtSet = new Set<string>();
    regionSites.forEach((site) => {
      if (site.district) districtSet.add(site.district);
    });

    const row: any = { name: todayStr };
    Array.from(districtSet).forEach((district) => {
      const kpisData = kpisDataMap.get(district);
      if (kpisData) {
        row[district] = kpisData.fuelTankLevelPct?.value || 0;
        row[`gen_${district}`] = kpisData.generatorLoadFactorPct?.value || 0;
      }
    });
    if (Object.keys(row).length > 1) currentData.push(row);
  } else {
    const row: any = { name: todayStr };
    const regionSet = new Set<string>();
    allCities.forEach((city) => {
      if (city.regionId) regionSet.add(city.regionId);
    });

    Array.from(regionSet).forEach((region) => {
      const kpisData = kpisDataMap.get(region);
      if (kpisData) {
        row[region] = kpisData.fuelTankLevelPct?.value || 0;
        row[`gen_${region}`] = kpisData.generatorLoadFactorPct?.value || 0;
      }
    });
    if (Object.keys(row).length > 1) currentData.push(row);
  }

  return currentData;
}

export default function EnergyTrends() {
  const navigate = useNavigate();
  const [scope, setScope] = useState<HierarchyFilter>({ level: "national" });

  const { data: hierarchy } = useQuery({
    queryKey: ["hierarchy"],
    queryFn: async () => {
      const res = await fetch("/api/hierarchy");
      return res.json();
    },
  });

  const { data: nationalKPIs } = useQuery({
    queryKey: ["trends-kpis-national"],
    queryFn: async () => {
      return await fetchKPIs({ level: "national" });
    },
  });

  const { data: regionKPIsMap } = useQuery({
    queryKey: ["trends-kpis-regions", hierarchy?.regions],
    queryFn: async () => {
      if (!hierarchy?.regions) return new Map();

      const map = new Map();
      for (const region of hierarchy.regions) {
        try {
          const kpis = await fetchKPIs({ level: "region", regionId: region.id });
          if (kpis?.kpis) {
            map.set(region.name, kpis.kpis);
          }
        } catch {
          // Ignore error and continue
        }
      }
      return map;
    },
    enabled: !!hierarchy?.regions,
  });

  const { data: districtKPIsMap } = useQuery({
    queryKey: ["trends-kpis-districts", hierarchy?.sites],
    queryFn: async () => {
      if (!hierarchy?.sites) return new Map();

      const map = new Map();
      const districtSet = new Set<string>();
      hierarchy.sites.forEach((site) => {
        if (site.district) districtSet.add(site.district);
      });

      for (const district of districtSet) {
        try {
          const kpis = await fetchKPIs({
            level: "city",
            district,
          });
          if (kpis?.kpis) {
            map.set(district, kpis.kpis);
          }
        } catch {
          // Ignore error and continue
        }
      }
      return map;
    },
    enabled: !!hierarchy?.sites,
  });

  const trendsData = useMemo(() => {
    if (!hierarchy) return null;

    const mockData = generateMockTrendsData(
      scope,
      hierarchy.cities || [],
      hierarchy.sites || [],
    );

    let realCurrentData: Array<{ [key: string]: any }> = [];

    if (scope.district && districtKPIsMap) {
      realCurrentData = generateCurrentDataFromRegionalKPIs(
        scope,
        hierarchy.cities || [],
        hierarchy.sites || [],
        districtKPIsMap,
      );
    } else if (scope.regionId && districtKPIsMap) {
      realCurrentData = generateCurrentDataFromRegionalKPIs(
        scope,
        hierarchy.cities || [],
        hierarchy.sites || [],
        districtKPIsMap,
      );
    } else if (regionKPIsMap) {
      realCurrentData = generateCurrentDataFromRegionalKPIs(
        scope,
        hierarchy.cities || [],
        hierarchy.sites || [],
        regionKPIsMap,
      );
    }

    return {
      ...mockData,
      currentData: realCurrentData.length > 0 ? realCurrentData : mockData.currentData,
    };
  }, [hierarchy, scope, regionKPIsMap, districtKPIsMap]);

  const isLoading = !hierarchy || !nationalKPIs || !regionKPIsMap;

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="text-white">Loading Energy Trends...</div>
      </div>
    );
  }

  if (!trendsData) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="text-white">No data available</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-purple-900 via-purple-800 to-blue-900 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto border border-purple-500/30">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Energy Trends</h2>
            <button
              onClick={() => navigate("/")}
              className="text-white hover:text-purple-300 text-xl"
            >
              ✕
            </button>
          </div>

          <div className="mb-6">
            <label className="text-white/70 block mb-2">Filter by Region</label>
            <select
              value={scope.regionId || ""}
              onChange={(e) =>
                setScope({ level: "national", regionId: e.target.value || undefined })
              }
              className="bg-purple-700/50 border border-purple-500/30 text-white rounded px-4 py-2 w-full"
            >
              <option value="">All Regions</option>
              {hierarchy?.regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">
                Current Fuel Level by Region (Today)
              </h3>
              <div className="h-64 bg-black/30 rounded-lg p-4">
                <FuelLevelChart data={trendsData.currentData} cities={[]} />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-4">
                Generator Load Trend by Region (Today)
              </h3>
              <div className="h-64 bg-black/30 rounded-lg p-4">
                <GeneratorLoadChart data={trendsData.currentData} cities={[]} />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-4">
                Accumulative Fuel Consumption (Monthly from 1/1/2025)
              </h3>
              <div className="h-64 bg-black/30 rounded-lg p-4">
                <FuelConsumptionChart data={trendsData.accumulativeData} cities={[]} />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-4">
                Accumulative CO₂ Emissions (Monthly from 1/1/2025)
              </h3>
              <div className="h-64 bg-black/30 rounded-lg p-4">
                <Co2EmissionsChart data={trendsData.accumulativeData} cities={[]} />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-4">
                Accumulative Power Consumption (Monthly from 1/1/2025)
              </h3>
              <div className="h-64 bg-black/30 rounded-lg p-4">
                <PowerConsumptionChart data={trendsData.accumulativeData} cities={[]} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

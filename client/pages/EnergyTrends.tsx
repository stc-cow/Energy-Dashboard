import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { HierarchyFilter } from "@shared/api";
import { fetchHierarchy, getRows } from "@/lib/api";
import FilterBar from "@/components/energy/FilterBar";
import FuelLevelChart from "@/components/energy/charts/FuelLevelChart";
import GeneratorLoadChart from "@/components/energy/charts/GeneratorLoadChart";
import FuelConsumptionChart from "@/components/energy/charts/FuelConsumptionChart";
import Co2EmissionsChart from "@/components/energy/charts/Co2EmissionsChart";
import PowerConsumptionChart from "@/components/energy/charts/PowerConsumptionChart";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

function getRegionName(r: any): string {
  const candidates = ["Region", "region", "RegionName", "regionName", "col5"];
  for (const c of candidates) {
    if (r[c] !== undefined && r[c] !== "") return String(r[c]).trim();
  }
  return "";
}

function getCityName(r: any): string {
  const candidates = ["City", "city", "CityName", "cityName", "col6"];
  for (const c of candidates) {
    if (r[c] !== undefined && r[c] !== "") return String(r[c]).trim();
  }
  return "";
}

function getDistrictName(r: any): string {
  const candidates = [
    "District",
    "district",
    "DistrictName",
    "districtName",
    "col7",
  ];
  for (const c of candidates) {
    if (r[c] !== undefined && r[c] !== "") return String(r[c]).trim();
  }
  return "";
}

function getStatus(row: any): string {
  const candidates = ["COWStatus", "Status", "cowStatus", "status"];
  for (const c of candidates) {
    if (row[c] !== undefined && row[c] !== "") {
      return String(row[c]).trim();
    }
  }
  return "";
}

function parseGeneratorCapacity(row: any): number | null {
  const candidates = [
    "GeneratorCapacity",
    "generatorCapacity",
    "genCapacity",
    "Capacity",
    "capacity",
  ];
  for (const c of candidates) {
    if (row[c] !== undefined && row[c] !== "") {
      const raw = String(row[c]).trim();
      const m = raw.match(/(\d+(\.\d+)?)/);
      if (m) return Number(m[1]);
    }
  }
  return null;
}

function getFuelPct(row: any): number | null {
  const candidates = [
    "fuelTankLevelPct",
    "Fuel Tank Level %",
    "Fuel Level %",
    "fuel_level_pct",
    "fuel_tank_level_pct",
    "fuelTankLevel",
    "fuelTankLevelPercent",
    "col24",
  ];
  for (const cand of candidates) {
    if (row[cand] !== undefined && row[cand] !== "") {
      const raw = String(row[cand]).replace(/,/g, "").trim();
      const n = parseFloat(raw);
      if (!isNaN(n)) return n;
    }
  }
  return null;
}

function getGenLoadPct(row: any): number | null {
  const candidates = [
    "generatorLoadFactorPct",
    "Load Factor %",
    "Generator Load Factor %",
    "load_factor_pct",
    "gen_load_factor_pct",
    "generatorLoad",
    "col25",
  ];
  for (const cand of candidates) {
    if (row[cand] !== undefined && row[cand] !== "") {
      const raw = String(row[cand]).replace(/,/g, "").trim();
      const n = parseFloat(raw);
      if (!isNaN(n)) return n;
    }
  }
  return null;
}

async function generateCurrentData(
  scope: HierarchyFilter,
  allCities: { id: string; name: string; regionId?: string }[],
  allSites: { id: string; name: string; cityId: string; district?: string }[],
): Promise<Array<{ [key: string]: any }>> {
  const rawData = await getRows();
  if (!rawData || rawData.length === 0) {
    return [];
  }

  const todayStr = "Today";

  const filteredRows = rawData.filter((r) => {
    const regionName = getRegionName(r);
    const cityName = getCityName(r);
    const districtName = getDistrictName(r);

    const matchingCity = allCities.find((c) => c.name === cityName);
    const matchingRegion = matchingCity?.regionId;

    if (scope.district && districtName && districtName !== scope.district) {
      return false;
    }
    if (scope.regionId && matchingRegion !== scope.regionId) {
      return false;
    }
    if (scope.cityId && matchingCity?.id !== scope.cityId) {
      return false;
    }

    const status = getStatus(r).toLowerCase();
    const isOnAir =
      status.includes("on-air") ||
      status.includes("in progress") ||
      status.includes("inprogress");
    if (!isOnAir) {
      return false;
    }

    return true;
  });

  if (filteredRows.length === 0) {
    return [];
  }

  function computeAverages(values: number[]) {
    const simple = values.length
      ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) /
        10
      : 0;
    return simple;
  }

  const currentData: Array<{ [key: string]: any }> = [];

  if (scope.district) {
    const fuels: number[] = [];
    const loads: number[] = [];

    filteredRows.forEach((row) => {
      const fuel = getFuelPct(row);
      const load = getGenLoadPct(row);
      if (fuel !== null) fuels.push(fuel);
      if (load !== null) loads.push(load);
    });

    const row: any = { name: todayStr };
    row[scope.district] = computeAverages(fuels);
    row[`gen_${scope.district}`] = computeAverages(loads);

    currentData.push(row);
  } else if (scope.regionId) {
    const districtMap = new Map<string, { fuels: number[]; loads: number[] }>();

    filteredRows.forEach((row) => {
      const districtName = getDistrictName(row) || "Unknown";
      if (!districtMap.has(districtName)) {
        districtMap.set(districtName, { fuels: [], loads: [] });
      }
      const bucket = districtMap.get(districtName)!;
      const fuel = getFuelPct(row);
      const load = getGenLoadPct(row);
      if (fuel !== null) bucket.fuels.push(fuel);
      if (load !== null) bucket.loads.push(load);
    });

    const row: any = { name: todayStr };
    districtMap.forEach(({ fuels, loads }, district) => {
      row[district] = computeAverages(fuels);
      row[`gen_${district}`] = computeAverages(loads);
    });

    if (Object.keys(row).length > 1) currentData.push(row);
  } else {
    const regionMap = new Map<string, { fuels: number[]; loads: number[] }>();

    filteredRows.forEach((row) => {
      const region = getRegionName(row) || "Unknown";
      if (!regionMap.has(region)) {
        regionMap.set(region, { fuels: [], loads: [] });
      }
      const bucket = regionMap.get(region)!;
      const fuel = getFuelPct(row);
      const load = getGenLoadPct(row);
      if (fuel !== null) bucket.fuels.push(fuel);
      if (load !== null) bucket.loads.push(load);
    });

    const row: any = { name: todayStr };
    regionMap.forEach(({ fuels, loads }, region) => {
      row[region] = computeAverages(fuels);
      row[`gen_${region}`] = computeAverages(loads);
    });

    if (Object.keys(row).length > 1) currentData.push(row);
  }

  return currentData;
}

export default function EnergyTrends() {
  const [scope, setScope] = useState<HierarchyFilter>({ level: "national" });
  const [isClosing, setIsClosing] = useState(false);

  const { data: hierarchy } = useQuery({
    queryKey: ["hierarchy"],
    queryFn: fetchHierarchy,
  });

  const { data: currentData, isLoading: currentLoading } = useQuery({
    queryKey: ["trends-current", scope],
    queryFn: async () => {
      return generateCurrentData(
        scope,
        hierarchy?.cities || [],
        hierarchy?.sites || [],
      );
    },
    enabled: !!hierarchy,
  });

  const { data: accumulativeData, isLoading: accumLoading } = useQuery({
    queryKey: ["trends-accumulative", scope],
    queryFn: async () => {
      const cities = hierarchy?.cities?.map((c) => c.name) || [];
      const citiesParam = cities.length > 0 ? cities.join(",") : "";
      const url = `/api/trends/accumulative?start=2025-01${citiesParam ? `&cities=${citiesParam}` : ""}`;
      try {
        const res = await fetch(url);
        return res.json();
      } catch {
        return [];
      }
    },
    enabled: !!hierarchy,
  });

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      window.history.back();
    }, 200);
  };

  return (
    <Layout>
      <div className="w-full h-full flex flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
        <div className="flex-none bg-slate-900/50 backdrop-blur border-b border-slate-700/50 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Energy Trends</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className={`text-white/60 hover:text-white hover:bg-slate-700/30 transition-all ${isClosing ? "opacity-0" : ""}`}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          {hierarchy && (
            <FilterBar
              regions={hierarchy.regions || []}
              cities={hierarchy.cities || []}
              sites={hierarchy.sites || []}
              scope={scope}
              onChange={setScope}
            />
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {(currentLoading || accumLoading) && (
              <div className="text-center text-white/50 py-8">
                Loading data...
              </div>
            )}

            {!currentLoading && !accumLoading && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-slate-900/50 backdrop-blur border border-slate-700/30 rounded-lg p-4 h-80">
                    <h2 className="text-lg font-semibold mb-4">
                      Current Fuel Level per City
                    </h2>
                    <FuelLevelChart data={currentData || []} cities={[]} />
                  </div>

                  <div className="bg-slate-900/50 backdrop-blur border border-slate-700/30 rounded-lg p-4 h-80">
                    <h2 className="text-lg font-semibold mb-4">
                      Generator Load Trend
                    </h2>
                    <GeneratorLoadChart data={currentData || []} cities={[]} />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-slate-900/50 backdrop-blur border border-slate-700/30 rounded-lg p-4 h-80">
                    <h2 className="text-lg font-semibold mb-4">
                      Fuel Consumption (Monthly)
                    </h2>
                    <FuelConsumptionChart data={accumulativeData || []} />
                  </div>

                  <div className="bg-slate-900/50 backdrop-blur border border-slate-700/30 rounded-lg p-4 h-80">
                    <h2 className="text-lg font-semibold mb-4">
                      CO₂ Emissions (Monthly)
                    </h2>
                    <Co2EmissionsChart data={accumulativeData || []} />
                  </div>
                </div>

                <div className="bg-slate-900/50 backdrop-blur border border-slate-700/30 rounded-lg p-4 h-80">
                  <h2 className="text-lg font-semibold mb-4">
                    Power Consumption (Monthly)
                  </h2>
                  <PowerConsumptionChart data={accumulativeData || []} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

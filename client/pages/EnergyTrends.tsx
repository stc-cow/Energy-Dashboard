import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchHierarchy } from "@/lib/api";
import { HierarchyFilter } from "@shared/api";
import FuelConsumptionChart from "@/components/energy/charts/FuelConsumptionChart";
import Co2EmissionsChart from "@/components/energy/charts/Co2EmissionsChart";
import PowerConsumptionChart from "@/components/energy/charts/PowerConsumptionChart";
import FuelLevelChart from "@/components/energy/charts/FuelLevelChart";
import GeneratorLoadChart from "@/components/energy/charts/GeneratorLoadChart";

// Helper to get region name for a city ID
function getRegionNameForCity(
  cityId: string,
  allCities: { id: string; name: string; regionId?: string }[],
): string {
  const city = allCities.find((c) => c.id === cityId);
  return city?.regionId || "Unknown";
}

// Helper function to fetch and parse raw sheet data (mimic api.ts logic)
async function getRawSheetData(): Promise<any[]> {
  try {
    const sheetUrl =
      (typeof import.meta !== "undefined" &&
        (import.meta as any).env?.VITE_SHEET_URL) ||
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vS0GkXnQMdKYZITuuMsAzeWDtGUqEJ3lWwqNdA67NewOsDOgqsZHKHECEEkea4nrukx4-DqxKmf62nC/pub?gid=1149576218&single=true&output=csv";

    const resp = await fetch(
      `/api/sheet?sheet=${encodeURIComponent(sheetUrl || "")}`,
    );
    if (resp.ok) {
      const data = await resp.json();
      return Array.isArray(data) ? data : [];
    }
  } catch {
    /* fallback to mock data */
  }
  return [];
}

// Helper functions to extract KPI values from row (matching api.ts)
function getFuelTankLevelPct(r: any): number {
  const keys = Object.keys(r || {});
  let value: any = undefined;

  // Try common header names first
  const candidates = [
    "fuelTankLevelPct",
    "Fuel Tank Level %",
    "Fuel Level %",
    "fuel_level_pct",
    "fuel_tank_level_pct",
    "col24",
  ];

  for (const cand of candidates) {
    if (r[cand] !== undefined) {
      value = r[cand];
      break;
    }
  }

  if (value === undefined) {
    return 0;
  }

  const num = parseFloat(String(value).replace(/,/g, "").trim());
  return isNaN(num) ? 0 : num;
}

function getGeneratorLoadFactorPct(r: any): number {
  const keys = Object.keys(r || {});
  let value: any = undefined;

  // Try common header names first
  const candidates = [
    "generatorLoadFactorPct",
    "Load Factor %",
    "Generator Load Factor %",
    "load_factor_pct",
    "gen_load_factor_pct",
    "col25",
  ];

  for (const cand of candidates) {
    if (r[cand] !== undefined) {
      value = r[cand];
      break;
    }
  }

  if (value === undefined) {
    return 0;
  }

  const num = parseFloat(String(value).replace(/,/g, "").trim());
  return isNaN(num) ? 0 : num;
}

function getRegionName(r: any): string {
  const candidates = [
    "regionName",
    "Region",
    "region",
    "Region Name",
    "region_name",
    "Province",
    "province",
    "Area",
    "area",
    "col3",
  ];

  for (const cand of candidates) {
    if (r[cand] !== undefined && r[cand] !== "") {
      return String(r[cand]).trim();
    }
  }
  return "Unknown";
}

function getCityName(r: any): string {
  const candidates = [
    "cityName",
    "City",
    "city",
    "City Name",
    "city_name",
    "Municipality",
    "municipality",
    "Governorate",
    "governorate",
    "col5",
  ];

  for (const cand of candidates) {
    if (r[cand] !== undefined && r[cand] !== "") {
      return String(r[cand]).trim();
    }
  }
  return "Unknown";
}

function getDistrictName(r: any): string {
  const candidates = [
    "districtName",
    "district",
    "District",
    "District Name",
    "district_name",
    "Neighborhood",
    "neighborhood",
    "Subdistrict",
    "subdistrict",
    "col4",
  ];

  for (const cand of candidates) {
    if (r[cand] !== undefined && r[cand] !== "") {
      return String(r[cand]).trim();
    }
  }
  return "";
}

interface TrendsResponse {
  currentData: Array<{ [key: string]: any }>; // Today's data for fuel level and generator load
  accumulativeData: Array<{ [key: string]: any }>; // Monthly data for accumulative charts
  metrics: string[];
  cities: string[];
}

// Helper to clamp fuel level to 60-95 range
function clampFuelLevel(value: number): number {
  return Math.max(60, Math.min(95, value));
}

// Helper to clamp generator load to 45-90 range
function clampGeneratorLoad(value: number): number {
  return Math.max(45, Math.min(90, value));
}

// Generate current data by aggregating raw sheet data by region/district separately
async function generateCurrentDataFromRawSheets(
  scope: HierarchyFilter,
  allCities: { id: string; name: string; regionId?: string }[],
  allSites: { id: string; name: string; cityId: string; district?: string }[],
): Promise<Array<{ [key: string]: any }>> {
  const rawData = await getRawSheetData();
  if (!rawData || rawData.length === 0) {
    return [];
  }

  const currentData = [];
  const todayStr = "Today";

  // Filter rows based on scope
  const filteredRows = rawData.filter((r) => {
    const regionName = getRegionName(r);
    const cityName = getCityName(r);
    const districtName = getDistrictName(r);

    // Match against hierarchy
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

    return true;
  });

  if (filteredRows.length === 0) {
    return [];
  }

  const groupByDistrict = !!scope.district;
  const groupByRegion = !!scope.regionId && !scope.district;

  if (groupByDistrict) {
    // Show single district with its aggregated values
    const districtFuels: number[] = [];
    const districtLoads: number[] = [];

    filteredRows.forEach((row) => {
      const fuel = getFuelTankLevelPct(row);
      const load = getGeneratorLoadFactorPct(row);
      if (fuel > 0 || fuel === 0) districtFuels.push(fuel);
      if (load > 0 || load === 0) districtLoads.push(load);
    });

    let avgFuel = districtFuels.length
      ? Math.round(
          (districtFuels.reduce((a, b) => a + b, 0) / districtFuels.length) *
            10,
        ) / 10
      : 0;
    let avgLoad = districtLoads.length
      ? Math.round(
          (districtLoads.reduce((a, b) => a + b, 0) / districtLoads.length) *
            10,
        ) / 10
      : 0;

    avgFuel = clampFuelLevel(avgFuel);
    avgLoad = clampGeneratorLoad(avgLoad);

    const row: any = { name: todayStr };
    row[scope.district] = avgFuel;
    row[`gen_${scope.district}`] = avgLoad;
    currentData.push(row);
  } else if (groupByRegion) {
    // Show districts within the selected region with separate aggregates
    const districtMap = new Map<string, { fuels: number[]; loads: number[] }>();

    filteredRows.forEach((row) => {
      const districtName = getDistrictName(row);
      const district = districtName || "Unknown";
      const fuel = getFuelTankLevelPct(row);
      const load = getGeneratorLoadFactorPct(row);

      if (!districtMap.has(district)) {
        districtMap.set(district, { fuels: [], loads: [] });
      }

      const data = districtMap.get(district)!;
      if (fuel > 0 || fuel === 0) data.fuels.push(fuel);
      if (load > 0 || load === 0) data.loads.push(load);
    });

    const row: any = { name: todayStr };
    districtMap.forEach(({ fuels, loads }, district) => {
      let avgFuel = fuels.length
        ? Math.round((fuels.reduce((a, b) => a + b, 0) / fuels.length) * 10) /
          10
        : 0;
      let avgLoad = loads.length
        ? Math.round((loads.reduce((a, b) => a + b, 0) / loads.length) * 10) /
          10
        : 0;
      avgFuel = clampFuelLevel(avgFuel);
      avgLoad = clampGeneratorLoad(avgLoad);
      row[district] = avgFuel;
      row[`gen_${district}`] = avgLoad;
    });

    if (Object.keys(row).length > 1) currentData.push(row);
  } else {
    // Show all regions with separate aggregates for each
    const regionMap = new Map<string, { fuels: number[]; loads: number[] }>();

    filteredRows.forEach((row) => {
      const regionName = getRegionName(row);
      const region = regionName || "Unknown";
      const fuel = getFuelTankLevelPct(row);
      const load = getGeneratorLoadFactorPct(row);

      if (!regionMap.has(region)) {
        regionMap.set(region, { fuels: [], loads: [] });
      }

      const data = regionMap.get(region)!;
      if (fuel > 0 || fuel === 0) data.fuels.push(fuel);
      if (load > 0 || load === 0) data.loads.push(load);
    });

    const row: any = { name: todayStr };
    regionMap.forEach(({ fuels, loads }, region) => {
      let avgFuel = fuels.length
        ? Math.round((fuels.reduce((a, b) => a + b, 0) / fuels.length) * 10) /
          10
        : 0;
      let avgLoad = loads.length
        ? Math.round((loads.reduce((a, b) => a + b, 0) / loads.length) * 10) /
          10
        : 0;
      avgFuel = clampFuelLevel(avgFuel);
      avgLoad = clampGeneratorLoad(avgLoad);
      row[region] = avgFuel;
      row[`gen_${region}`] = avgLoad;
    });

    if (Object.keys(row).length > 1) currentData.push(row);
  }

  return currentData;
}

// Default regions to display in accumulative charts
// These are the four main regions that should be shown by default
const DEFAULT_REGION_IDS = new Set<string>();

// Helper to check if a city belongs to a default region
function isDefaultRegionCity(city: { id: string; name: string; regionId?: string }, allCities: { id: string; name: string; regionId?: string }[]): boolean {
  // If DEFAULT_REGION_IDS is not yet populated, populate it based on actual cities
  if (DEFAULT_REGION_IDS.size === 0 && allCities.length > 0) {
    // Find all unique region IDs
    const regionIds = new Set<string>();
    allCities.forEach(c => {
      if (c.regionId) regionIds.add(c.regionId);
    });

    // Add the first 4 region IDs as defaults (representing Central, East, West, South)
    let count = 0;
    for (const id of regionIds) {
      if (count >= 4) break;
      DEFAULT_REGION_IDS.add(id);
      count++;
    }
  }

  return city.regionId && DEFAULT_REGION_IDS.has(city.regionId);
}

// Import mock data function directly for client-side data generation
function generateMockTrendsData(
  scope: HierarchyFilter,
  allCities: { id: string; name: string; regionId?: string }[],
  allSites: { id: string; name: string; cityId: string; district?: string }[],
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

  // If district is selected, further filter cities that have sites in that district
  if (scope.district) {
    const citiesWithDistrict = new Set<string>();
    allSites.forEach((site) => {
      if (site.district === scope.district) {
        citiesWithDistrict.add(site.cityId);
      }
    });
    filteredCities = filteredCities.filter((c) => citiesWithDistrict.has(c.id));
  }

  // Use city names for the chart
  const cities = filteredCities.map((c) => c.name);

  // Filter cities for accumulative data - only include default regions
  let citiesForAccumulative = filteredCities;
  if (!scope.district && !scope.regionId) {
    // Only filter to default regions when no region/district is selected
    citiesForAccumulative = filteredCities.filter((c) => {
      const regionName = getRegionNameFromId(c.regionId);
      return regionName && DEFAULT_REGIONS.has(regionName);
    });
  }

  const startDate = new Date(2025, 0, 1); // January 1, 2025
  const today = new Date();

  // ===== CURRENT DATA (Mock fallback - will be overridden by real data if available) =====
  const currentData: Array<{ [key: string]: any }> = [];
  const todayStr = "Today";

  // Determine if grouping by region or district
  const groupByDistrict = !!scope.district;
  const groupByRegion = !!scope.regionId && !scope.district;

  if (groupByDistrict) {
    // Show single district for selected region
    const row: any = { name: todayStr };
    row[scope.district] = clampFuelLevel(Math.round(seededRandom(123) * 100));
    row[`gen_${scope.district}`] = clampGeneratorLoad(
      Math.round(seededRandom(456) * 100),
    );
    if (Object.keys(row).length > 1) currentData.push(row);
  } else if (groupByRegion) {
    // Show districts within the selected region
    const regionSites = allSites.filter((s) => {
      const city = filteredCities.find((c) => c.id === s.cityId);
      return city && city.regionId === scope.regionId;
    });
    const districtSet = new Set<string>();

    regionSites.forEach((site) => {
      if (site.district) {
        districtSet.add(site.district);
      }
    });

    const row: any = { name: todayStr };
    let seed = 789;
    Array.from(districtSet).forEach((district) => {
      row[district] = clampFuelLevel(Math.round(seededRandom(seed++) * 100));
      row[`gen_${district}`] = clampGeneratorLoad(
        Math.round(seededRandom(seed++) * 100),
      );
    });
    if (Object.keys(row).length > 1) currentData.push(row);
  } else {
    // Show all regions - use actual region names from hierarchy
    const regionMap = new Map<string, { name: string; values: number[] }>();
    const regionGenMap = new Map<string, { name: string; values: number[] }>();

    // Build region map with actual names
    const regionNameMap = new Map<string, string>();
    if (
      typeof import.meta !== "undefined" &&
      (import.meta as any).env?.VITE_SHEET_URL
    ) {
      // If we have real data source, we can map region IDs to names
      allCities.forEach((city) => {
        if (city.regionId && !regionNameMap.has(city.regionId)) {
          // Extract actual region name from city data if available
          regionNameMap.set(city.regionId, city.regionId); // fallback to ID
        }
      });
    }

    filteredCities.forEach((city, idx) => {
      const regionId = city.regionId || "Unknown";
      const regionName = regionNameMap.get(regionId) || regionId; // Use name if available
      const seed = idx * 100;

      if (!regionMap.has(regionName)) {
        regionMap.set(regionName, { name: regionName, values: [] });
      }
      if (!regionGenMap.has(regionName)) {
        regionGenMap.set(regionName, { name: regionName, values: [] });
      }

      regionMap
        .get(regionName)!
        .values.push(clampFuelLevel(Math.round(seededRandom(seed + 11) * 100)));
      regionGenMap
        .get(regionName)!
        .values.push(
          clampGeneratorLoad(Math.round(seededRandom(seed + 13) * 100)),
        );
    });

    const row: any = { name: todayStr };
    regionMap.forEach(({ name, values }) => {
      const avg =
        values.length > 0
          ? clampFuelLevel(
              Math.round(values.reduce((a, b) => a + b, 0) / values.length),
            )
          : clampFuelLevel(0);
      row[name] = avg;
    });
    regionGenMap.forEach(({ name, values }) => {
      const avg =
        values.length > 0
          ? clampGeneratorLoad(
              Math.round(values.reduce((a, b) => a + b, 0) / values.length),
            )
          : clampGeneratorLoad(0);
      row[`gen_${name}`] = avg;
    });
    if (Object.keys(row).length > 1) currentData.push(row);
  }

  // ===== ACCUMULATIVE DATA (Monthly from Jan 2025 to today) =====
  const accumulativeData = [];
  const monthsArr: string[] = [];

  // build months from Jan 2025 to current month
  for (
    let m = new Date(2025, 0, 1);
    m <= new Date();
    m = new Date(m.getFullYear(), m.getMonth() + 1, 1)
  ) {
    monthsArr.push(
      `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`,
    );
  }
  const numMonths = Math.max(1, monthsArr.length);

  // Get city names for accumulative data (filtered to default regions)
  const accumulativeCities = citiesForAccumulative.map((c) => c.name);

  // Derive a single "current month accumulative" base per city (seeded when real totals are not available).
  // This base value will be used as the current-month average and used to backfill a linear trend from Jan 2025.
  const baseValues = accumulativeCities.map((city, idx) => {
    const seed = idx + 17;
    // seed-based base between ~50k and ~250k liters (adjust scale here if you prefer larger/smaller numbers)
    return Math.round(seededRandom(seed) * 200000) + 50000;
  });

  // Build accumulative rows. For each month, distribute the base linearly up to the current month and add small noise.
  monthsArr.forEach((monthStr, monthIdx) => {
    const monthRow: any = { date: monthStr };
    accumulativeCities.forEach((city, cityIdx) => {
      const base = baseValues[cityIdx];
      // small noise (±5% of base)
      const noise = seededRandom(cityIdx * 31 + monthIdx) * base * 0.05;
      // linear distribution from Jan -> currentMonth so the latest month approximates `base`
      const value = Math.round(base * ((monthIdx + 1) / numMonths) + noise);

      monthRow[`fuel_consumption_L_${city}`] = value;
      // CO2 in tons (approximation using factor 2.68 kg CO2 / L and convert to tons)
      monthRow[`co2_emissions_tons_${city}`] =
        Math.round(((value * 2.68) / 1000) * 100) / 100;
      // Power (kWh) rough proportional factor (adjust factor as you prefer)
      monthRow[`power_consumption_kWh_${city}`] = Math.round(value * 0.9);
    });

    accumulativeData.push(monthRow);
  });

  return { currentData, accumulativeData, metrics: [], cities };
}

// Helper function to extract metric from grouped data
function extractMetricFromGroupedData(
  data: Array<{ [key: string]: any }>,
  cities: string[],
  metricPrefix: string,
): Array<{ [key: string]: any }> {
  return data.map((row) => {
    const result: any = { name: row.name };
    cities.forEach((city) => {
      const key = `${metricPrefix}_${city}`;
      if (row[key] !== undefined) {
        result[city] = row[key];
      } else {
        result[city] = row[city] ?? 0;
      }
    });
    return result;
  });
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

  // Fetch real current data (fuel level and generator load) aggregated by region/district
  const { data: realCurrentData, isLoading: isLoadingCurrentData } = useQuery({
    queryKey: ["trends-current-data", scope],
    queryFn: async () => {
      return await generateCurrentDataFromRawSheets(
        scope,
        hierarchy?.cities || [],
        hierarchy?.sites || [],
      );
    },
    enabled: !!hierarchy,
  });

  const trendsData = useMemo(() => {
    if (!hierarchy) return null;

    // Generate base mock data structure
    const mockData = generateMockTrendsData(
      scope,
      hierarchy.cities || [],
      hierarchy.sites || [],
    );

    // Use real data if available, otherwise fall back to mock
    const currentDataToUse =
      realCurrentData && realCurrentData.length > 0
        ? realCurrentData
        : mockData.currentData;

    return {
      ...mockData,
      currentData: currentDataToUse,
    };
  }, [hierarchy, scope, realCurrentData]);

  const isLoading = !hierarchy || isLoadingCurrentData;

  // Get districts for selected region
  const filteredCities = useMemo(() => {
    if (!hierarchy) return [];
    if (!scope.regionId) return hierarchy.cities || [];
    return hierarchy.cities?.filter((c) => c.regionId === scope.regionId) || [];
  }, [hierarchy, scope.regionId]);

  // Get distinct districts from sites in filtered cities
  const districts = useMemo(() => {
    if (!hierarchy || filteredCities.length === 0) return [];
    const filteredCityIds = new Set(filteredCities.map((c) => c.id));
    const districtSet = new Set<string>();

    (hierarchy.sites || []).forEach((site) => {
      if (filteredCityIds.has(site.cityId) && site.district) {
        districtSet.add(site.district);
      }
    });

    return Array.from(districtSet).sort();
  }, [hierarchy, filteredCities]);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={() => navigate("/")}
    >
      <div
        style={{
          backgroundColor: "#5c0ba2",
          borderRadius: "12px",
          padding: "24px",
          maxHeight: "90vh",
          overflowY: "auto",
          maxWidth: "1200px",
          width: "95%",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h1
            style={{
              color: "white",
              fontSize: "24px",
              fontWeight: "bold",
              margin: 0,
            }}
          >
            Energy Trends
          </h1>
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors flex-shrink-0"
          >
            Close
          </button>
        </div>

        {/* Filters */}
        {!isLoading && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
              marginBottom: "20px",
            }}
          >
            {/* Region Filter */}
            <div>
              <label className="block text-white text-sm font-semibold mb-2">
                Region
              </label>
              <select
                value={scope.regionId || ""}
                onChange={(e) => {
                  const regionId = e.target.value || undefined;
                  setScope((prev) => ({
                    ...prev,
                    regionId,
                    district: undefined,
                  }));
                }}
                className="w-full px-4 py-2 bg-white/10 text-black border border-white/20 rounded-lg hover:bg-white/20 transition-colors"
              >
                <option value="" style={{ color: "black" }}>
                  All Regions
                </option>
                {hierarchy?.regions?.map((region) => (
                  <option
                    key={region.id}
                    value={region.id}
                    style={{ color: "black" }}
                  >
                    {region.name}
                  </option>
                ))}
              </select>
            </div>

            {/* District Filter */}
            <div>
              <label className="block text-white text-sm font-semibold mb-2">
                District
              </label>
              <select
                disabled={!scope.regionId}
                value={scope.district || ""}
                onChange={(e) => {
                  const district = e.target.value || undefined;
                  setScope((prev) => ({ ...prev, district }));
                }}
                className="w-full px-4 py-2 bg-white/10 text-black border border-white/20 rounded-lg hover:bg-white/20 transition-colors disabled:opacity-50"
              >
                <option value="" style={{ color: "black" }}>
                  All Districts
                </option>
                {districts.map((district) => (
                  <option
                    key={district}
                    value={district}
                    style={{ color: "black" }}
                  >
                    {district}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Charts Container */}
        {isLoading && (
          <div className="text-center py-12">
            <p className="text-white/60">Loading trends data...</p>
          </div>
        )}

        {trendsData &&
          trendsData.currentData &&
          trendsData.accumulativeData && (
            <div className="space-y-8">
              {/* Current Fuel Level and Generator Load side-by-side */}
              {trendsData.currentData && trendsData.currentData.length > 0 && (
                <div className="grid grid-cols-2 gap-6">
                  <div className="rounded-lg border border-white/10 bg-card p-6 shadow-lg">
                    <h2 className="text-xl font-semibold text-white mb-4">
                      Current Fuel Level by{" "}
                      {scope.district
                        ? "District"
                        : scope.regionId
                          ? "District"
                          : "Region"}{" "}
                      (Today)
                    </h2>
                    <div className="w-full h-80">
                      <FuelLevelChart
                        data={trendsData.currentData}
                        cities={trendsData.cities}
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-card p-6 shadow-lg">
                    <h2 className="text-xl font-semibold text-white mb-4">
                      Generator Load Trend by{" "}
                      {scope.district
                        ? "District"
                        : scope.regionId
                          ? "District"
                          : "Region"}{" "}
                      (Today)
                    </h2>
                    <div className="w-full h-80">
                      <GeneratorLoadChart
                        data={trendsData.currentData}
                        cities={trendsData.cities}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Accumulative Fuel Consumption */}
              <div className="rounded-lg border border-white/10 bg-card p-6 shadow-lg">
                <h2 className="text-xl font-semibold text-white mb-4">
                  Accumulative Fuel Consumption (Monthly from 1/1/2025)
                </h2>
                <div className="w-full h-80">
                  <FuelConsumptionChart data={trendsData.accumulativeData} />
                </div>
              </div>

              {/* Accumulative CO₂ Emissions */}
              <div className="rounded-lg border border-white/10 bg-card p-6 shadow-lg">
                <h2 className="text-xl font-semibold text-white mb-4">
                  Accumulative CO₂ Emissions (Monthly from 1/1/2025)
                </h2>
                <div className="w-full h-80">
                  <Co2EmissionsChart data={trendsData.accumulativeData} />
                </div>
              </div>

              {/* Accumulative Power Consumption */}
              <div className="rounded-lg border border-white/10 bg-card p-6 shadow-lg">
                <h2 className="text-xl font-semibold text-white mb-4">
                  Accumulative Power Consumption (Monthly from 1/1/2025)
                </h2>
                <div className="w-full h-80">
                  <PowerConsumptionChart data={trendsData.accumulativeData} />
                </div>
              </div>
            </div>
          )}

        {!isLoading &&
          (!trendsData ||
            !trendsData.currentData ||
            !trendsData.accumulativeData) && (
            <div className="text-center py-12">
              <p className="text-white/60">
                No data available for the selected filters.
              </p>
            </div>
          )}
      </div>
    </div>
  );
}

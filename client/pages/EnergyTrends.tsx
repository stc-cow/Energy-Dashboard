import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchHierarchy } from "@/lib/api";
import { HierarchyFilter } from "@shared/api";
import FuelConsumptionChart from "@/components/energy/charts/FuelConsumptionChart";
import Co2EmissionsChart from "@/components/energy/charts/Co2EmissionsChart";
import PowerConsumptionChart from "@/components/energy/charts/PowerConsumptionChart";
import FuelLevelChart from "@/components/energy/charts/FuelLevelChart";
import GeneratorLoadChart from "@/components/energy/charts/GeneratorLoadChart";

// Function to fetch real fuel level and generator load data from Google Sheet
async function fetchRealTrendsData(
  scope: HierarchyFilter,
  allCities: { id: string; name: string; regionId?: string }[],
  allSites: { id: string; name: string; cityId: string; district?: string }[],
): Promise<{ fuelByRegion: Map<string, number[]>; genLoadByRegion: Map<string, number[]> }> {
  try {
    // Fetch from the sheet API endpoint
    const response = await fetch(`/api/sheet?sheet=${encodeURIComponent(
      typeof import.meta !== "undefined" &&
      (import.meta as any).env?.VITE_SHEET_URL ||
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vS0GkXnQMdKYZITuuMsAzeWDtGUqEJ3lWwqNdA67NewOsDOgqsZHKHECEEkea4nrukx4-DqxKmf62nC/pub?gid=1149576218&single=true&output=csv"
    )}`);

    if (!response.ok) {
      return { fuelByRegion: new Map(), genLoadByRegion: new Map() };
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return { fuelByRegion: new Map(), genLoadByRegion: new Map() };
    }

    const fuelByRegion = new Map<string, number[]>();
    const genLoadByRegion = new Map<string, number[]>();

    // Process each row
    for (const row of data) {
      // Get region name
      const regionName = String(
        row["regionName"] ?? row["Region"] ?? row["region"] ?? ""
      ).trim();
      if (!regionName) continue;

      // Get fuel level and generator load
      const fuelLevel = parseFloat(row["fuelTankLevelPct"] ?? 0);
      const genLoad = parseFloat(row["generatorLoadFactorPct"] ?? 0);

      // Initialize maps if needed
      if (!fuelByRegion.has(regionName)) fuelByRegion.set(regionName, []);
      if (!genLoadByRegion.has(regionName)) genLoadByRegion.set(regionName, []);

      // Add values
      if (fuelLevel || fuelLevel === 0) {
        fuelByRegion.get(regionName)!.push(fuelLevel);
      }
      if (genLoad || genLoad === 0) {
        genLoadByRegion.get(regionName)!.push(genLoad);
      }
    }

    return { fuelByRegion, genLoadByRegion };
  } catch {
    return { fuelByRegion: new Map(), genLoadByRegion: new Map() };
  }
}

interface TrendsResponse {
  currentData: Array<{ [key: string]: any }>; // Today's data for fuel level and generator load
  accumulativeData: Array<{ [key: string]: any }>; // Monthly data for accumulative charts
  metrics: string[];
  cities: string[];
}

// Generate current data with real fuel level and generator load from Google Sheet
function generateCurrentDataFromSheetData(
  scope: HierarchyFilter,
  allCities: { id: string; name: string; regionId?: string }[],
  allSites: { id: string; name: string; cityId: string; district?: string }[],
  fuelByRegion: Map<string, number[]>,
  genLoadByRegion: Map<string, number[]>,
): Array<{ [key: string]: any }> {
  const currentData = [];
  const todayStr = "Today";

  // Determine if grouping by region or district
  const groupByDistrict = !!scope.district;
  const groupByRegion = !!scope.regionId && !scope.district;

  if (groupByDistrict) {
    // Show single district for selected region
    const row: any = { name: todayStr };
    row[scope.district] = 0; // Will be set if data exists
    row[`gen_${scope.district}`] = 0;
    if (Object.keys(row).length > 1) currentData.push(row);
  } else if (groupByRegion) {
    // Show districts within the selected region
    const regionSites = allSites.filter((s) => {
      const city = allCities.find((c) => c.id === s.cityId);
      return city && city.regionId === scope.regionId;
    });
    const districtSet = new Set<string>();

    regionSites.forEach((site) => {
      if (site.district) {
        districtSet.add(site.district);
      }
    });

    const row: any = { name: todayStr };
    Array.from(districtSet).forEach((district) => {
      row[district] = 0;
      row[`gen_${district}`] = 0;
    });
    if (Object.keys(row).length > 1) currentData.push(row);
  } else {
    // Show all regions
    const row: any = { name: todayStr };

    fuelByRegion.forEach((values, regionName) => {
      // Average fuel level for this region
      const avgFuel = values.length > 0
        ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
        : 0;
      row[regionName] = avgFuel;
    });

    genLoadByRegion.forEach((values, regionName) => {
      // Average generator load for this region
      const avgGenLoad = values.length > 0
        ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
        : 0;
      row[`gen_${regionName}`] = avgGenLoad;
    });

    if (Object.keys(row).length > 1) currentData.push(row);
  }

  return currentData;
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
    row[scope.district] = Math.round(seededRandom(123) * 100);
    row[`gen_${scope.district}`] = Math.round(seededRandom(456) * 100);
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
      row[district] = Math.round(seededRandom(seed++) * 100);
      row[`gen_${district}`] = Math.round(seededRandom(seed++) * 100);
    });
    if (Object.keys(row).length > 1) currentData.push(row);
  } else {
    // Show all regions - use actual region names from hierarchy
    const regionMap = new Map<string, { name: string; values: number[] }>();
    const regionGenMap = new Map<string, { name: string; values: number[] }>();

    // Build region map with actual names
    const regionNameMap = new Map<string, string>();
    if (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_SHEET_URL) {
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

      regionMap.get(regionName)!.values.push(Math.round(seededRandom(seed + 11) * 100));
      regionGenMap.get(regionName)!.values.push(Math.round(seededRandom(seed + 13) * 100));
    });

    const row: any = { name: todayStr };
    regionMap.forEach(({ name, values }) => {
      const avg = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
      row[name] = avg;
    });
    regionGenMap.forEach(({ name, values }) => {
      const avg = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
      row[`gen_${name}`] = avg;
    });
    if (Object.keys(row).length > 1) currentData.push(row);
  }

  // ===== ACCUMULATIVE DATA (Monthly from Jan 2025 to today) =====
  const accumulativeData = [];
  const currentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0); // Last day of current month

  for (let m = new Date(2025, 0, 1); m <= today; m.setMonth(m.getMonth() + 1)) {
    const monthStr = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
    const monthRow: any = { date: monthStr };

    cities.forEach((city, cityIdx) => {
      const cityId = filteredCities[cityIdx].id;

      // Calculate total days elapsed until end of this month
      const monthEnd = new Date(m.getFullYear(), m.getMonth() + 1, 0);
      const effectiveEndDate = monthEnd <= today ? monthEnd : today;
      const dayOffset = Math.floor(
        (effectiveEndDate.getTime() - startDate.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      const seed = `${cityId}-${monthStr}`.length;

      // Accumulative fuel (liters) - for FuelConsumptionChart
      monthRow[`fuel_consumption_L_${city}`] =
        (dayOffset + 1) * 1000 + Math.round(seededRandom(seed * 17) * 500);

      // Accumulative CO2 (tons) - for Co2EmissionsChart
      monthRow[`co2_emissions_tons_${city}`] =
        ((dayOffset + 1) * 50 + Math.round(seededRandom(seed * 19) * 30)) / 10;

      // Accumulative power (kWh) - for PowerConsumptionChart
      monthRow[`power_consumption_kWh_${city}`] =
        (dayOffset + 1) * 500 + Math.round(seededRandom(seed * 23) * 200);
    });

    accumulativeData.push(monthRow);
  }

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

  // Fetch real fuel and generator load data
  const { data: sheetData } = useQuery({
    queryKey: ["trends-sheet-data"],
    queryFn: async () => {
      return await fetchRealTrendsData(
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

    // If we have real sheet data, use it for current fuel and generator load
    if (sheetData && (sheetData.fuelByRegion.size > 0 || sheetData.genLoadByRegion.size > 0)) {
      const realCurrentData = generateCurrentDataFromSheetData(
        scope,
        hierarchy.cities || [],
        hierarchy.sites || [],
        sheetData.fuelByRegion,
        sheetData.genLoadByRegion,
      );

      return {
        ...mockData,
        currentData: realCurrentData.length > 0 ? realCurrentData : mockData.currentData,
      };
    }

    return mockData;
  }, [hierarchy, scope, sheetData]);

  const isLoading = !hierarchy;

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
              {/* Current Fuel Level by Region/District */}
              {trendsData.currentData && trendsData.currentData.length > 0 && (
                <div className="rounded-lg border border-white/10 bg-card p-6 shadow-lg">
                  <h2 className="text-xl font-semibold text-white mb-4">
                    Current Fuel Level by {scope.district ? "District" : scope.regionId ? "District" : "Region"} (Today)
                  </h2>
                  <div className="w-full h-80">
                    <FuelLevelChart
                      data={trendsData.currentData}
                      cities={trendsData.cities}
                    />
                  </div>
                </div>
              )}

              {/* Generator Load Trend by Region/District */}
              {trendsData.currentData && trendsData.currentData.length > 0 && (
                <div className="rounded-lg border border-white/10 bg-card p-6 shadow-lg">
                  <h2 className="text-xl font-semibold text-white mb-4">
                    Generator Load Trend by {scope.district ? "District" : scope.regionId ? "District" : "Region"} (Today)
                  </h2>
                  <div className="w-full h-80">
                    <GeneratorLoadChart
                      data={trendsData.currentData}
                      cities={trendsData.cities}
                    />
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

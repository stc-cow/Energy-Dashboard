import { useState, useMemo } from "react";
import type { CSSProperties } from "react";
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

// Helper to get default region IDs from hierarchy
// Returns the IDs of the first 4 unique regions (representing Central, East, West, South)
function getDefaultRegionIds(
  allCities: { id: string; name: string; regionId?: string }[],
): Set<string> {
  const defaultIds = new Set<string>();

  // Collect unique region IDs in order
  const regionIds: string[] = [];
  const seenIds = new Set<string>();

  allCities.forEach((city) => {
    if (city.regionId && !seenIds.has(city.regionId)) {
      regionIds.push(city.regionId);
      seenIds.add(city.regionId);
    }
  });

  // Take the first 4 regions as defaults
  regionIds.slice(0, 4).forEach((id) => defaultIds.add(id));

  return defaultIds;
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
    const defaultRegionIds = getDefaultRegionIds(allCities);
    citiesForAccumulative = filteredCities.filter(
      (c) => c.regionId && defaultRegionIds.has(c.regionId),
    );
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

  // For accumulative data, group cities by region and use region name as the key
  // This ensures the legend shows region names instead of city names
  let accumulativeCities = citiesForAccumulative.map((c) => c.name);
  let accumulativeRegionMap: Map<string, string> = new Map(); // maps region display name to regionId

  // If we're filtering to default regions, group by region and use region as the key
  if (!scope.district && !scope.regionId && citiesForAccumulative.length > 0) {
    // Group cities by regionId
    const regionMap = new Map<string, string[]>();
    citiesForAccumulative.forEach((city) => {
      const regionId = city.regionId || "Unknown";
      if (!regionMap.has(regionId)) {
        regionMap.set(regionId, []);
      }
      regionMap.get(regionId)!.push(city.name);
    });

    // Create display names for regions (e.g., "Central", "East", "West", "South")
    const regionNames = ["Central", "East", "West", "South"];
    let regionIdx = 0;
    accumulativeCities = [];
    regionMap.forEach((cities, regionId) => {
      const displayName =
        regionIdx < regionNames.length
          ? regionNames[regionIdx]
          : `Region ${regionIdx}`;
      accumulativeRegionMap.set(displayName, regionId);
      accumulativeCities.push(displayName);
      regionIdx++;
    });
  }

  // Derive a single "current month accumulative" base per city/region (seeded when real totals are not available).
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

  const highlightMetrics = useMemo(() => {
    if (!trendsData?.currentData?.length) {
      return [] as Array<{ label: string; fuel: number; load: number }>;
    }

    const entry = trendsData.currentData[0];

    return Object.keys(entry)
      .filter((key) => key !== "name" && !key.startsWith("gen_"))
      .map((label) => ({
        label,
        fuel: Number(entry[label] ?? 0),
        load: Number(entry[`gen_${label}`] ?? 0),
      }))
      .sort((a, b) => b.fuel - a.fuel)
      .slice(0, 3);
  }, [trendsData]);

  const heroMetrics = useMemo(() => {
    if (highlightMetrics.length > 0) {
      return highlightMetrics;
    }

    return [
      { label: "Aurora Corridor", fuel: 88, load: 64 },
      { label: "Nebula Reach", fuel: 79, load: 71 },
      { label: "Quantum Ridge", fuel: 92, load: 58 },
    ];
  }, [highlightMetrics]);

  const heroAverages = useMemo(() => {
    if (!heroMetrics.length) {
      return { fuel: 0, load: 0 };
    }

    const totals = heroMetrics.reduce(
      (acc, metric) => {
        acc.fuel += metric.fuel;
        acc.load += metric.load;
        return acc;
      },
      { fuel: 0, load: 0 },
    );

    return {
      fuel: Math.round((totals.fuel / heroMetrics.length) * 10) / 10,
      load: Math.round((totals.load / heroMetrics.length) * 10) / 10,
    };
  }, [heroMetrics]);

  const accentGradients = [
    "from-emerald-400/80 via-emerald-500/40 to-emerald-500/0",
    "from-sky-400/80 via-cyan-400/40 to-cyan-500/0",
    "from-fuchsia-400/80 via-purple-500/40 to-purple-500/0",
  ];

  const buildPanelStyle = useMemo(
    () =>
      (depth: number): CSSProperties => ({
        transform: `translateZ(${depth}px)` + " rotateY(-6deg)",
        transformStyle: "preserve-3d",
        background:
          "linear-gradient(165deg, rgba(24,16,64,0.92), rgba(9,6,28,0.88))",
        boxShadow:
          "0 45px 80px rgba(7,3,24,0.68), inset 0 0 0 1px rgba(255,255,255,0.06)",
      }),
    [],
  );

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{
        background:
          "radial-gradient(140% 100% at 12% 40%, rgba(10,7,38,0.98) 0%, rgba(6,5,25,0.96) 48%, rgba(2,1,12,0.92) 70%, rgba(1,0,8,0.85) 100%)",
        zIndex: 50,
      }}
      onClick={() => navigate("/")}
    >
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(160deg, rgba(94,72,255,0.45) 0%, rgba(0,210,255,0.25) 50%, rgba(255,20,147,0.4) 100%)",
            mixBlendMode: "screen",
          }}
        />
        <div
          className="absolute inset-y-0 right-0 w-2/3 translate-x-1/4 bg-[url('/images/energy-pointer-hand.svg')] bg-contain bg-right bg-no-repeat opacity-40"
        />
        <div
          className="absolute -left-24 top-1/2 h-[42rem] w-[42rem] -translate-y-1/2 rounded-full bg-purple-700/40 blur-3xl"
        />
        <div
          className="absolute bottom-10 right-1/4 h-72 w-72 rotate-12 rounded-[3rem] border border-cyan-400/40 bg-cyan-500/10 backdrop-blur-xl"
          style={{
            boxShadow: "0 0 120px rgba(56,189,248,0.35)",
            transform: "translateZ(120px)",
          }}
        />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 20%, rgba(147,197,253,0.16), transparent 55%), radial-gradient(circle at 85% 80%, rgba(244,114,182,0.18), transparent 60%)",
          }}
        />
      </div>

      <button
        onClick={() => navigate("/")}
        className="absolute right-6 top-6 z-50 rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-white/90 shadow-[0_12px_24px_rgba(14,8,48,0.4)] transition hover:bg-white/20"
      >
        Close
      </button>

      <div
        className="relative z-40 flex h-full w-full items-center justify-center px-6 py-12"
        style={{ perspective: "2200px" }}
      >
        <div
          className="relative flex w-full max-w-6xl flex-col gap-10 lg:flex-row"
          style={{ transformStyle: "preserve-3d" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="relative w-full overflow-hidden rounded-[34px] border border-white/15 text-white lg:max-w-sm"
            style={{
              transform: "rotateY(-24deg) rotateX(6deg) translateZ(220px)",
              transformStyle: "preserve-3d",
              background:
                "linear-gradient(160deg, rgba(48,16,94,0.96), rgba(14,10,40,0.9))",
              boxShadow:
                "0 70px 120px rgba(8,2,24,0.72), inset 0 0 0 1px rgba(255,255,255,0.08)",
            }}
          >
            <div
              className="absolute inset-0 opacity-70"
              style={{
                backgroundImage:
                  "linear-gradient(125deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.04) 28%, rgba(56,189,248,0.2) 100%)",
                mixBlendMode: "screen",
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(180deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 10px)",
                opacity: 0.3,
                transform: "translateZ(40px)",
              }}
            />
            <div className="relative z-20 flex h-full flex-col justify-between p-8">
              <div>
                <p className="text-xs uppercase tracking-[0.45em] text-purple-100/80">
                  Quantum Deep Trend Capsule
                </p>
                <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
                  Energy Trends
                </h1>
                <p className="mt-5 max-w-xs text-sm text-purple-100/80">
                  Immersive telemetry rendered with multi-layer depth, aligned to
                  the districts leading today&apos;s energy harmony.
                </p>
              </div>

              <div className="mt-6 space-y-4">
                {heroMetrics.map((metric, idx) => (
                  <div
                    key={metric.label}
                    className="relative overflow-hidden rounded-2xl border border-white/15 bg-white/5 px-5 py-4 shadow-[0_25px_45px_rgba(8,2,28,0.6)]"
                    style={{ transform: `translateZ(${45 - idx * 8}px)` }}
                  >
                    <div
                      className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${accentGradients[idx % accentGradients.length]} opacity-70 blur-lg`}
                      style={{ transform: "translateZ(-10px)" }}
                    />
                    <div className="relative z-10 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[0.65rem] uppercase tracking-[0.4em] text-white/70">
                          {metric.label}
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-white">
                          {Math.round(metric.fuel)}%
                        </p>
                        <p className="text-[0.7rem] text-white/60">Fuel Stability</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[0.65rem] uppercase tracking-[0.3em] text-cyan-100/80">
                          Load
                        </p>
                        <p className="mt-2 text-xl font-semibold text-cyan-100">
                          {Math.round(metric.load)}%
                        </p>
                        <p className="text-[0.7rem] text-white/60">Generator Pulse</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div
                className="relative mt-8 h-56 overflow-hidden rounded-3xl border border-white/20 bg-black/30 p-5"
                style={{ transform: "translateZ(55px)" }}
              >
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 15% 15%, rgba(59,130,246,0.25), transparent 55%), radial-gradient(circle at 85% 85%, rgba(192,132,252,0.28), transparent 60%)",
                    opacity: 0.85,
                  }}
                />
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    backgroundImage:
                      "linear-gradient(120deg, rgba(255,255,255,0.25) 0%, transparent 45%, transparent 60%, rgba(255,255,255,0.18) 100%)",
                    mixBlendMode: "screen",
                  }}
                />
                <div className="relative z-20 flex h-full items-end justify-between gap-3">
                  {heroMetrics.map((metric, idx) => {
                    const fuelHeight = Math.max(18, Math.min(95, metric.fuel));
                    const loadHeight = Math.max(12, Math.min(85, metric.load));

                    return (
                      <div
                        key={`${metric.label}-tower`}
                        className="flex w-1/3 flex-col items-center gap-2"
                      >
                        <div className="flex w-full items-end gap-2">
                          <div
                            className="flex-1 rounded-t-2xl bg-gradient-to-t from-purple-800/80 via-purple-500/70 to-fuchsia-300/90 shadow-[0_20px_45px_rgba(180,104,255,0.6)]"
                            style={{ height: `${fuelHeight}%` }}
                          />
                          <div
                            className="flex-1 rounded-t-2xl bg-gradient-to-t from-cyan-900/80 via-cyan-500/70 to-sky-300/90 shadow-[0_18px_35px_rgba(56,189,248,0.6)]"
                            style={{ height: `${loadHeight}%` }}
                          />
                        </div>
                        <p className="text-[0.7rem] uppercase tracking-[0.25em] text-white/70">
                          {metric.label.split(" ")[0] ?? metric.label}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-8 h-12 bg-gradient-to-r from-transparent via-white/20 to-transparent blur-2xl" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 via-black/60 to-transparent" />
                <div className="absolute left-5 top-5 flex items-baseline gap-3 text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
                  <span>Avg Fuel</span>
                  <span className="text-white/90">{heroAverages.fuel}%</span>
                  <span className="ml-3 text-cyan-200/80">Load</span>
                  <span className="text-cyan-100/90">{heroAverages.load}%</span>
                </div>
              </div>
            </div>
          </div>

          <div
            className="relative flex w-full flex-col gap-8 text-white"
            style={{
              transform: "rotateY(-10deg) rotateX(2deg) translateZ(140px)",
              transformStyle: "preserve-3d",
            }}
          >
            <div
              className="relative overflow-hidden rounded-[28px] border border-white/15 px-8 py-6 backdrop-blur-2xl"
              style={{
                ...buildPanelStyle(180),
                background:
                  "linear-gradient(160deg, rgba(32,22,74,0.92), rgba(10,8,32,0.88))",
              }}
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{
                  backgroundImage:
                    "linear-gradient(120deg, rgba(255,255,255,0.18) 0%, transparent 35%, transparent 60%, rgba(56,189,248,0.2) 100%)",
                  mixBlendMode: "screen",
                }}
              />
              <div className="relative z-20 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-white/70">
                    Immersive Telemetry Portal
                  </p>
                  <p className="mt-2 max-w-md text-sm text-white/70">
                    Refine the holographic canvas by region and district to alter
                    the depth of the rendered trend volumes.
                  </p>
                </div>
                {!isLoading && (
                  <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                        Region Scope
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
                        className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white/90 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur"
                      >
                        <option value="">All Regions</option>
                        {hierarchy?.regions?.map((region) => (
                          <option key={region.id} value={region.id}>
                            {region.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                        District Layer
                      </label>
                      <select
                        disabled={!scope.regionId}
                        value={scope.district || ""}
                        onChange={(e) => {
                          const district = e.target.value || undefined;
                          setScope((prev) => ({ ...prev, district }));
                        }}
                        className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white/90 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur disabled:opacity-50"
                      >
                        <option value="">All Districts</option>
                        {districts.map((district) => (
                          <option key={district} value={district}>
                            {district}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {isLoading && (
              <div
                className="rounded-[26px] border border-white/10 px-8 py-12 text-center text-white/60"
                style={buildPanelStyle(150)}
              >
                Loading trends data...
              </div>
            )}

            {trendsData &&
              trendsData.currentData &&
              trendsData.accumulativeData && (
                <div className="flex flex-col gap-8">
                  {trendsData.currentData.length > 0 && (
                    <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
                      <div
                        className="rounded-[26px] border border-white/10 p-6"
                        style={buildPanelStyle(140)}
                      >
                        <h2 className="text-xl font-semibold text-white">
                          Current Fuel Level by{" "}
                          {scope.district
                            ? "District"
                            : scope.regionId
                              ? "District"
                              : "Region"}{" "}
                          (Today)
                        </h2>
                        <p className="mt-1 text-sm text-white/60">
                          Layered bars projected across the immersive viewport
                          for instant comparison.
                        </p>
                        <div className="mt-6 h-80 w-full">
                          <FuelLevelChart
                            data={trendsData.currentData}
                            cities={trendsData.cities}
                          />
                        </div>
                      </div>

                      <div
                        className="rounded-[26px] border border-white/10 p-6"
                        style={buildPanelStyle(135)}
                      >
                        <h2 className="text-xl font-semibold text-white">
                          Generator Load Trend by{" "}
                          {scope.district
                            ? "District"
                            : scope.regionId
                              ? "District"
                              : "Region"}{" "}
                          (Today)
                        </h2>
                        <p className="mt-1 text-sm text-white/60">
                          Dual-axis generator harmonics mapped to the current
                          scope.
                        </p>
                        <div className="mt-6 h-80 w-full">
                          <GeneratorLoadChart
                            data={trendsData.currentData}
                            cities={trendsData.cities}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div
                    className="rounded-[26px] border border-white/10 p-6"
                    style={buildPanelStyle(128)}
                  >
                    <h2 className="text-xl font-semibold text-white">
                      Accumulative Fuel Consumption (Monthly from 1/1/2025)
                    </h2>
                    <p className="mt-1 text-sm text-white/60">
                      Extruded streamlines show the cumulative upward drift of
                      consumption.
                    </p>
                    <div className="mt-6 h-80 w-full">
                      <FuelConsumptionChart data={trendsData.accumulativeData} />
                    </div>
                  </div>

                  <div
                    className="rounded-[26px] border border-white/10 p-6"
                    style={buildPanelStyle(122)}
                  >
                    <h2 className="text-xl font-semibold text-white">
                      Accumulative CO₂ Emissions (Monthly from 1/1/2025)
                    </h2>
                    <p className="mt-1 text-sm text-white/60">
                      Atmospheric density ribbons reveal the emissions
                      trajectory.
                    </p>
                    <div className="mt-6 h-80 w-full">
                      <Co2EmissionsChart data={trendsData.accumulativeData} />
                    </div>
                  </div>

                  <div
                    className="rounded-[26px] border border-white/10 p-6"
                    style={buildPanelStyle(116)}
                  >
                    <h2 className="text-xl font-semibold text-white">
                      Accumulative Power Consumption (Monthly from 1/1/2025)
                    </h2>
                    <p className="mt-1 text-sm text-white/60">
                      Power utilization arcs plotted across the deep timeline.
                    </p>
                    <div className="mt-6 h-80 w-full">
                      <PowerConsumptionChart data={trendsData.accumulativeData} />
                    </div>
                  </div>
                </div>
              )}

            {!isLoading &&
              (!trendsData ||
                !trendsData.currentData ||
                !trendsData.accumulativeData) && (
                <div
                  className="rounded-[26px] border border-white/10 px-8 py-12 text-center text-white/60"
                  style={buildPanelStyle(120)}
                >
                  No data available for the selected filters.
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}

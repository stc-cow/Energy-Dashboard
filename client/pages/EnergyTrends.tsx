import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import FuelConsumptionChart from "@/components/energy/charts/FuelConsumptionChart";
import Co2EmissionsChart from "@/components/energy/charts/Co2EmissionsChart";
import PowerConsumptionChart from "@/components/energy/charts/PowerConsumptionChart";
import FuelLevelChart from "@/components/energy/charts/FuelLevelChart";
import GeneratorLoadChart from "@/components/energy/charts/GeneratorLoadChart";
import { objectsToCSV, downloadCSV } from "@/lib/csv";

// Minimal local type so the file is self-contained
type HierarchyFilter = {
  level?: string;
  regionId?: string | undefined;
  cityId?: string | undefined;
  district?: string | undefined;
};

// -------------------- Sheet / parsing helpers --------------------

async function getRawSheetData(): Promise<any[]> {
  try {
    // App expects a server-side proxy at /api/sheet which returns JSON rows,
    // or you can set VITE_SHEET_URL and the server will use it.
    const sheetUrl =
      (typeof import.meta !== "undefined" &&
        (import.meta as any).env?.VITE_SHEET_URL) ||
      "";
    const url = `/api/sheet?sheet=${encodeURIComponent(sheetUrl)}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn("sheet proxy returned", resp.status);
      return [];
    }
    const json = await resp.json();
    return Array.isArray(json) ? json : [];
  } catch (err) {
    console.error("getRawSheetData error", err);
    return [];
  }
}

function getFuelTankLevelPct(r: any): number {
  if (!r) return 0;
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
  for (const k of candidates) {
    if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== "") {
      const raw = String(r[k]).replace(/,/g, "").replace(/%/g, "").trim();
      const n = parseFloat(raw);
      return isNaN(n) ? 0 : n;
    }
  }
  return 0;
}

function getGeneratorLoadFactorPct(r: any): number {
  if (!r) return 0;
  const candidates = [
    "generatorLoadFactorPct",
    "Load Factor %",
    "Generator Load Factor %",
    "load_factor_pct",
    "gen_load_factor_pct",
    "generatorLoad",
    "col25",
  ];
  for (const k of candidates) {
    if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== "") {
      const raw = String(r[k]).replace(/,/g, "").replace(/%/g, "").trim();
      const n = parseFloat(raw);
      return isNaN(n) ? 0 : n;
    }
  }
  return 0;
}

function getRegionName(r: any): string {
  const candidates = [
    "RegionName",
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
  for (const c of candidates) {
    if (r[c] !== undefined && r[c] !== null && String(r[c]).trim() !== "") {
      return String(r[c]).trim();
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
  for (const c of candidates) {
    if (r[c] !== undefined && r[c] !== null && String(r[c]).trim() !== "") {
      return String(r[c]).trim();
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
  for (const c of candidates) {
    if (r[c] !== undefined && r[c] !== null && String(r[c]).trim() !== "") {
      return String(r[c]).trim();
    }
  }
  return "";
}

// -------------------- The improved generateCurrentDataFromRawSheets --------------------

async function generateCurrentDataFromRawSheets(
  scope: HierarchyFilter,
  allCities: { id: string; name: string; regionId?: string }[],
  allSites: { id: string; name: string; cityId: string; district?: string }[],
): Promise<Array<{ [key: string]: any }>> {
  const rawData = await getRawSheetData();
  if (!rawData || rawData.length === 0) {
    return [];
  }

  const todayStr = "Today";

  // Helper: normalize status (try multiple column names)
  function getStatus(row: any): string {
    const candidates = ["COWStatus", "Status", "cowStatus", "status"];
    for (const c of candidates) {
      if (row[c] !== undefined && row[c] !== "") {
        return String(row[c]).trim();
      }
    }
    return "";
  }

  // Helper: parse GeneratorCapacity like "35KVA" or "25 KVA" -> 35 or 25
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

  // Helper: get fuel % as number (handles "57.00%", "57", "57.00")
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
        const raw = String(row[cand])
          .replace(/,/g, "")
          .replace(/%/g, "")
          .trim();
        const n = parseFloat(raw);
        if (!isNaN(n)) return n;
      }
    }
    return null;
  }

  // Helper: get generator load % as number
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
        const raw = String(row[cand])
          .replace(/,/g, "")
          .replace(/%/g, "")
          .trim();
        const n = parseFloat(raw);
        if (!isNaN(n)) return n;
      }
    }
    return null;
  }

  // Filter rows based on hierarchy scope AND status (include ON-AIR and In Progress)
  const filteredRows = rawData.filter((r) => {
    const regionName = getRegionName(r);
    const cityName = getCityName(r);
    const districtName = getDistrictName(r);

    // hierarchy matching
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

    // status: only include ON-AIR or In Progress by default (ignore OFF-AIR)
    const status = getStatus(r).toLowerCase();
    if (
      !(
        status === "on-air" ||
        status === "onair" ||
        status === "on air" ||
        status === "in progress" ||
        status === "inprogress"
      )
    ) {
      return false;
    }

    return true;
  });

  if (filteredRows.length === 0) {
    return [];
  }

  // Decide grouping
  const groupByDistrict = !!scope.district;
  const groupByRegion = !!scope.regionId && !scope.district;

  // Utility to compute simple & capacity-weighted average from arrays
  function computeAverages(values: number[], capacities: Array<number | null>) {
    const validPairs: Array<{ v: number; cap: number | null }> = values.map(
      (v, i) => ({ v, cap: capacities[i] ?? null }),
    );
    // simple average
    const simple = values.length
      ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) /
        10
      : 0;
    // capacity weighted average if we have at least one valid capacity > 0
    const caps = validPairs.map((p) => (p.cap && p.cap > 0 ? p.cap : 0));
    const capSum = caps.reduce((a, b) => a + b, 0);
    let weighted = simple;
    if (capSum > 0) {
      const weightedSum = validPairs.reduce((acc, p) => {
        const c = p.cap && p.cap > 0 ? p.cap : 0;
        return acc + p.v * c;
      }, 0);
      weighted = Math.round((weightedSum / capSum) * 10) / 10;
    }
    return { simple, weighted, usedWeighted: capSum > 0, capSum };
  }

  const currentData: Array<{ [key: string]: any }> = [];

  if (groupByDistrict) {
    // Aggregate all rows for the selected district
    const fuels: number[] = [];
    const loads: number[] = [];
    const fuelCaps: Array<number | null> = [];
    const loadCaps: Array<number | null> = [];

    filteredRows.forEach((row) => {
      const fuel = getFuelPct(row);
      const load = getGenLoadPct(row);
      const cap = parseGeneratorCapacity(row);
      if (fuel !== null) {
        fuels.push(fuel);
        fuelCaps.push(cap);
      }
      if (load !== null) {
        loads.push(load);
        loadCaps.push(cap);
      }
    });

    const fuelAvg = computeAverages(fuels, fuelCaps);
    const loadAvg = computeAverages(loads, loadCaps);

    const row: any = { name: todayStr };
    // prefer capacity-weighted if available, else simple
    row[scope.district!] = fuelAvg.usedWeighted
      ? fuelAvg.weighted
      : fuelAvg.simple;
    row[`gen_${scope.district}`] = loadAvg.usedWeighted
      ? loadAvg.weighted
      : loadAvg.simple;

    currentData.push(row);
  } else if (groupByRegion) {
    // Group rows by district within the selected region
    const districtMap = new Map<
      string,
      {
        fuels: number[];
        fuelCaps: Array<number | null>;
        loads: number[];
        loadCaps: Array<number | null>;
      }
    >();

    filteredRows.forEach((row) => {
      const districtName = getDistrictName(row) || "Unknown";
      if (!districtMap.has(districtName)) {
        districtMap.set(districtName, {
          fuels: [],
          fuelCaps: [],
          loads: [],
          loadCaps: [],
        });
      }
      const bucket = districtMap.get(districtName)!;
      const fuel = getFuelPct(row);
      const load = getGenLoadPct(row);
      const cap = parseGeneratorCapacity(row);
      if (fuel !== null) {
        bucket.fuels.push(fuel);
        bucket.fuelCaps.push(cap);
      }
      if (load !== null) {
        bucket.loads.push(load);
        bucket.loadCaps.push(cap);
      }
    });

    const row: any = { name: todayStr };
    districtMap.forEach(({ fuels, fuelCaps, loads, loadCaps }, district) => {
      const fAvg = computeAverages(fuels, fuelCaps);
      const lAvg = computeAverages(loads, loadCaps);
      row[district] = fAvg.usedWeighted ? fAvg.weighted : fAvg.simple;
      row[`gen_${district}`] = lAvg.usedWeighted ? lAvg.weighted : lAvg.simple;
    });

    if (Object.keys(row).length > 1) currentData.push(row);
  } else {
    // National / all regions: group by region
    const regionMap = new Map<
      string,
      {
        fuels: number[];
        fuelCaps: Array<number | null>;
        loads: number[];
        loadCaps: Array<number | null>;
      }
    >();

    filteredRows.forEach((row) => {
      const region = getRegionName(row) || "Unknown";
      if (!regionMap.has(region)) {
        regionMap.set(region, {
          fuels: [],
          fuelCaps: [],
          loads: [],
          loadCaps: [],
        });
      }
      const bucket = regionMap.get(region)!;
      const fuel = getFuelPct(row);
      const load = getGenLoadPct(row);
      const cap = parseGeneratorCapacity(row);
      if (fuel !== null) {
        bucket.fuels.push(fuel);
        bucket.fuelCaps.push(cap);
      }
      if (load !== null) {
        bucket.loads.push(load);
        bucket.loadCaps.push(cap);
      }
    });

    const row: any = { name: todayStr };
    regionMap.forEach(({ fuels, fuelCaps, loads, loadCaps }, region) => {
      const fAvg = computeAverages(fuels, fuelCaps);
      const lAvg = computeAverages(loads, loadCaps);
      row[region] = fAvg.usedWeighted ? fAvg.weighted : fAvg.simple;
      row[`gen_${region}`] = lAvg.usedWeighted ? lAvg.weighted : lAvg.simple;
    });

    if (Object.keys(row).length > 1) currentData.push(row);
  }

  return currentData;
}

// -------------------- Mock accumulative + current data generator (fallback) --------------------

function generateMockTrendsData(
  scope: HierarchyFilter,
  allCities: { id: string; name: string; regionId?: string }[],
  allSites: { id: string; name: string; cityId: string; district?: string }[],
) {
  // seeded random for deterministic mock
  const seededRandom = (seed: number) => {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  let filteredCities = allCities;
  if (scope.cityId) {
    filteredCities = allCities.filter((c) => c.id === scope.cityId);
  } else if (scope.regionId) {
    filteredCities = allCities.filter((c) => c.regionId === scope.regionId);
  }

  if (scope.district) {
    const citiesWithDistrict = new Set<string>();
    allSites.forEach((s) => {
      if (s.district === scope.district) citiesWithDistrict.add(s.cityId);
    });
    filteredCities = filteredCities.filter((c) => citiesWithDistrict.has(c.id));
  }

  const cities = filteredCities.map((c) => c.name);
  const startDate = new Date(2025, 0, 1);
  const today = new Date();
  const monthsArr: string[] = [];
  for (
    let m = new Date(startDate);
    m <= today;
    m = new Date(m.getFullYear(), m.getMonth() + 1, 1)
  ) {
    monthsArr.push(
      `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`,
    );
  }

  // current data
  const currentData: Array<{ [key: string]: any }> = [];
  const todayStr = "Today";
  const row: any = { name: todayStr };
  // generate per-region/district mock depending on scope
  if (scope.district) {
    row[scope.district] = Math.round(seededRandom(123) * 100);
    row[`gen_${scope.district}`] = Math.round(seededRandom(456) * 100);
    currentData.push(row);
  } else if (scope.regionId) {
    // gather districts in the region via sites
    const districtSet = new Set<string>();
    allSites.forEach((s) => {
      const city = allCities.find((c) => c.id === s.cityId);
      if (city && city.regionId === scope.regionId && s.district)
        districtSet.add(s.district);
    });
    let seed = 789;
    Array.from(districtSet).forEach((d) => {
      row[d] = Math.round(seededRandom(seed++) * 100);
      row[`gen_${d}`] = Math.round(seededRandom(seed++) * 100);
    });
    currentData.push(row);
  } else {
    // regions
    const regionSet = new Set<string>();
    allCities.forEach((c) => {
      if (c.regionId) regionSet.add(c.regionId);
    });
    let seed = 500;
    Array.from(regionSet).forEach((r) => {
      row[r] = Math.round(seededRandom(seed++) * 100);
      row[`gen_${r}`] = Math.round(seededRandom(seed++) * 100);
    });
    currentData.push(row);
  }

  // accumulative data
  const accumulativeData: any[] = [];
  const baseValues = cities.map(
    (_, idx) => Math.round(seededRandom(idx + 17) * 200000) + 50000,
  );
  const numMonths = Math.max(1, monthsArr.length);
  monthsArr.forEach((monthStr, monthIdx) => {
    const monthRow: any = { date: monthStr };
    cities.forEach((city, cityIdx) => {
      const base = baseValues[cityIdx];
      const noise = seededRandom(cityIdx * 31 + monthIdx) * base * 0.05;
      const value = Math.round(base * ((monthIdx + 1) / numMonths) + noise);
      monthRow[`fuel_consumption_L_${city}`] = value;
      monthRow[`co2_emissions_tons_${city}`] =
        Math.round(((value * 2.68) / 1000) * 100) / 100;
      monthRow[`power_consumption_kWh_${city}`] = Math.round(value * 0.9);
    });
    accumulativeData.push(monthRow);
  });

  return { currentData, accumulativeData, cities, metrics: [] };
}

// -------------------- Component --------------------

export default function EnergyTrends() {
  const navigate = useNavigate();
  const [scope, setScope] = useState<HierarchyFilter>({ level: "national" });
  const [range, setRange] = useState<"1m" | "3m" | "6m" | "12m" | "all">("all");
  const [searchParams] = useSearchParams();

  const { data: hierarchy } = useQuery({
    queryKey: ["hierarchy"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/hierarchy");
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    },
  });

  const {
    data: realCurrentData,
    isLoading: isLoadingCurrentData,
    isError: isErrorCurrentData,
  } = useQuery({
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

    const mock = generateMockTrendsData(
      scope,
      hierarchy.cities || [],
      hierarchy.sites || [],
    );
    const currentToUse =
      realCurrentData && realCurrentData.length
        ? realCurrentData
        : mock.currentData;
    return {
      ...mock,
      currentData: currentToUse,
    };
  }, [hierarchy, scope, realCurrentData]);

  useEffect(() => {
    // If opened from a KPI link with metric query param, optionally set default scope
    const metric = searchParams.get("metric");
    if (metric === "diesel") {
      // for example - you can set scope or filters here
    }
  }, [searchParams]);

  const filteredCities = useMemo(() => {
    if (!hierarchy) return [];
    if (!scope.regionId) return hierarchy.cities || [];
    return (
      hierarchy.cities?.filter((c: any) => c.regionId === scope.regionId) || []
    );
  }, [hierarchy, scope.regionId]);

  const districts = useMemo(() => {
    if (!hierarchy || filteredCities.length === 0) return [];
    const filteredCityIds = new Set(filteredCities.map((c: any) => c.id));
    const districtSet = new Set<string>();
    (hierarchy.sites || []).forEach((site: any) => {
      if (filteredCityIds.has(site.cityId) && site.district)
        districtSet.add(site.district);
    });
    return Array.from(districtSet).sort();
  }, [hierarchy, filteredCities]);

  // Build accumulative data range (adjust months based on range)
  function buildAccumulativeForRange(accumulativeData: any[]) {
    if (!accumulativeData || accumulativeData.length === 0)
      return accumulativeData || [];
    if (range === "all") return accumulativeData;
    const monthsMap = accumulativeData.map((r) => r.date);
    const endIndex = monthsMap.length - 1;
    const monthsBack =
      range === "1m" ? 1 : range === "3m" ? 3 : range === "6m" ? 6 : 12;
    const startIndex = Math.max(0, endIndex - (monthsBack - 1));
    return accumulativeData.slice(startIndex);
  }

  const accumulativeForDisplay = useMemo(() => {
    if (!trendsData) return [];
    return buildAccumulativeForRange(trendsData.accumulativeData);
  }, [trendsData, range]);

  const exportCSV = () => {
    if (!trendsData || !trendsData.accumulativeData) return;
    const csv = objectsToCSV(trendsData.accumulativeData);
    downloadCSV("accumulative_trends.csv", csv);
  };

  const isLoading = !hierarchy || isLoadingCurrentData;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="energy-trends-title"
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
        zIndex: 60,
      }}
      onClick={() => navigate("/")}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "#5c0ba2",
          borderRadius: 12,
          padding: 24,
          maxHeight: "90vh",
          overflowY: "auto",
          width: "95%",
          maxWidth: 1200,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h1
            id="energy-trends-title"
            style={{ color: "white", fontSize: 24, fontWeight: 700 }}
          >
            Energy Trends
          </h1>
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold"
          >
            Close
          </button>
        </div>

        {!isLoading && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              marginBottom: 20,
            }}
          >
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
                className="w-full px-4 py-2 bg-white/10 text-black border border-white/20 rounded-lg"
                style={{ color: "black" }}
              >
                <option value="">All Regions</option>
                {hierarchy?.regions?.map((r: any) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-white text-sm font-semibold mb-2">
                District
              </label>
              <select
                disabled={!scope.regionId}
                value={scope.district || ""}
                onChange={(e) =>
                  setScope((prev) => ({
                    ...prev,
                    district: e.target.value || undefined,
                  }))
                }
                className="w-full px-4 py-2 bg-white/10 text-black border border-white/20 rounded-lg disabled:opacity-50"
                style={{ color: "black" }}
              >
                <option value="">All Districts</option>
                {districts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {isLoading && (
          <div style={{ color: "white", opacity: 0.8, padding: 24 }}>
            Loading trends data...
          </div>
        )}

        {!isLoading && trendsData && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Today's charts side-by-side */}
            {trendsData.currentData && trendsData.currentData.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 24,
                }}
              >
                <div
                  style={{
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.03)",
                    padding: 16,
                  }}
                >
                  <h2 style={{ color: "#fff", fontSize: 18, marginBottom: 12 }}>
                    Current Fuel Level by{" "}
                    {scope.district
                      ? "District"
                      : scope.regionId
                        ? "District"
                        : "Region"}{" "}
                    (Today)
                  </h2>
                  <div style={{ height: 320 }}>
                    <FuelLevelChart
                      data={trendsData.currentData}
                      cities={trendsData.cities}
                      lowThreshold={25}
                      highThreshold={85}
                    />
                  </div>
                </div>

                <div
                  style={{
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.03)",
                    padding: 16,
                  }}
                >
                  <h2 style={{ color: "#fff", fontSize: 18, marginBottom: 12 }}>
                    Generator Load Trend by{" "}
                    {scope.district
                      ? "District"
                      : scope.regionId
                        ? "District"
                        : "Region"}{" "}
                    (Today)
                  </h2>
                  <div style={{ height: 320 }}>
                    <GeneratorLoadChart
                      data={trendsData.currentData}
                      cities={trendsData.cities}
                      lowThreshold={20}
                      highThreshold={90}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Accumulative charts */}
            <div
              style={{
                borderRadius: 8,
                background: "rgba(255,255,255,0.03)",
                padding: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <h2 style={{ color: "#fff", fontSize: 18 }}>
                  Accumulative Fuel Consumption (Monthly from 1/1/2025)
                </h2>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select
                    value={range}
                    onChange={(e) => setRange(e.target.value as any)}
                    style={{ padding: "6px 10px", borderRadius: 6 }}
                  >
                    <option value="all">From 2025-01</option>
                    <option value="12m">Last 12 months</option>
                    <option value="6m">Last 6 months</option>
                    <option value="3m">Last 3 months</option>
                    <option value="1m">Last 1 month</option>
                  </select>
                  <button
                    onClick={exportCSV}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 6,
                      background: "#ffffff",
                      color: "#5c0ba2",
                      fontWeight: 700,
                    }}
                  >
                    Export CSV
                  </button>
                </div>
              </div>

              <div style={{ height: 360 }}>
                <FuelConsumptionChart data={accumulativeForDisplay} />
              </div>
            </div>

            <div
              style={{
                borderRadius: 8,
                background: "rgba(255,255,255,0.03)",
                padding: 16,
              }}
            >
              <h2 style={{ color: "#fff", fontSize: 18, marginBottom: 12 }}>
                Accumulative CO₂ Emissions (Monthly from 1/1/2025)
              </h2>
              <div style={{ height: 320 }}>
                <Co2EmissionsChart data={accumulativeForDisplay} />
              </div>
            </div>

            <div
              style={{
                borderRadius: 8,
                background: "rgba(255,255,255,0.03)",
                padding: 16,
              }}
            >
              <h2 style={{ color: "#fff", fontSize: 18, marginBottom: 12 }}>
                Accumulative Power Consumption (Monthly from 1/1/2025)
              </h2>
              <div style={{ height: 320 }}>
                <PowerConsumptionChart data={accumulativeForDisplay} />
              </div>
            </div>
          </div>
        )}

        {!isLoading &&
          (!trendsData ||
            !trendsData.currentData ||
            !trendsData.accumulativeData) && (
            <div style={{ color: "white", opacity: 0.9, padding: 24 }}>
              No data available for the selected filters.
            </div>
          )}
      </div>
    </div>
  );
}

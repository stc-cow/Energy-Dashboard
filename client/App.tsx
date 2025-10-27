import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import FuelLevelChart from "@/components/energy/charts/FuelLevelChart";
import GeneratorLoadChart from "@/components/energy/charts/GeneratorLoadChart";
import FuelConsumptionChart from "@/components/energy/charts/FuelConsumptionChart";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

/**
 * EnergyTrends.tsx
 * - Self-contained page that fetches hierarchy + sheet data and renders:
 *   - Today's Fuel & Generator charts (side-by-side)
 *   - Accumulative Fuel, CO2, Power charts (monthly from 2025-01)
 *
 * Notes:
 * - This implementation fetches /api/hierarchy and /api/sheet (proxy).
 * - Expects FuelLevelChart, GeneratorLoadChart, FuelConsumptionChart files to exist.
 */

// Simple CSV helpers (so we don't rely on external file)
function objectsToCSV(rows: any[]) {
  if (!rows || rows.length === 0) return "";
  const keys = Object.keys(rows[0]);
  const header = keys.join(",");
  const lines = rows.map((r) =>
    keys
      .map((k) => {
        const v = r[k] ?? "";
        const s = String(v).replace(/"/g, '""');
        return `"${s}"`;
      })
      .join(",")
  );
  return [header, ...lines].join("\n");
}

function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Minimal HierarchyFilter type
type HierarchyFilter = {
  level?: string;
  regionId?: string | undefined;
  cityId?: string | undefined;
  district?: string | undefined;
};

// ---------- sheet parsing helpers ----------

async function getRawSheetData(): Promise<any[]> {
  try {
    // Server proxy endpoint that expects VITE_SHEET_URL to be configured or sheet param.
    const sheetUrl =
      (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_SHEET_URL) || "";
    // if sheetUrl empty, server /api/sheet should still return something (or we handle empty)
    const url = `/api/sheet?sheet=${encodeURIComponent(sheetUrl)}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn("Sheet proxy returned", resp.status);
      return [];
    }
    const json = await resp.json();
    return Array.isArray(json) ? json : [];
  } catch (err) {
    console.error("getRawSheetData error", err);
    return [];
  }
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
  ];
  for (const c of candidates) {
    if (r[c] !== undefined && r[c] !== null && String(r[c]).trim() !== "") return String(r[c]).trim();
  }
  return "Unknown";
}
function getCityName(r: any): string {
  const candidates = ["cityName", "City", "city", "City Name", "city_name"];
  for (const c of candidates) {
    if (r[c] !== undefined && r[c] !== null && String(r[c]).trim() !== "") return String(r[c]).trim();
  }
  return "Unknown";
}
function getDistrictName(r: any): string {
  const candidates = ["districtName", "district", "District", "District Name", "district_name"];
  for (const c of candidates) {
    if (r[c] !== undefined && r[c] !== null && String(r[c]).trim() !== "") return String(r[c]).trim();
  }
  return "";
}

// fuel & generator parsing helpers
function parseGeneratorCapacity(row: any): number | null {
  const candidates = ["GeneratorCapacity", "generatorCapacity", "genCapacity", "Capacity", "capacity"];
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
  if (!row) return null;
  const candidates = [
    "fuelTankLevelPct",
    "Fuel Tank Level %",
    "Fuel Level %",
    "fuel_level_pct",
    "fuel_tank_level_pct",
    "fuelTankLevel",
    "fuelTankLevelPercent",
  ];
  for (const cand of candidates) {
    if (row[cand] !== undefined && row[cand] !== null && String(row[cand]).trim() !== "") {
      const raw = String(row[cand]).replace(/,/g, "").replace(/%/g, "").trim();
      const n = parseFloat(raw);
      if (!isNaN(n)) return n;
    }
  }
  return null;
}
function getGenLoadPct(row: any): number | null {
  if (!row) return null;
  const candidates = [
    "generatorLoadFactorPct",
    "Load Factor %",
    "Generator Load Factor %",
    "load_factor_pct",
    "gen_load_factor_pct",
    "generatorLoad",
  ];
  for (const cand of candidates) {
    if (row[cand] !== undefined && row[cand] !== null && String(row[cand]).trim() !== "") {
      const raw = String(row[cand]).replace(/,/g, "").replace(/%/g, "").trim();
      const n = parseFloat(raw);
      if (!isNaN(n)) return n;
    }
  }
  return null;
}
function getStatus(row: any): string {
  const candidates = ["COWStatus", "Status", "cowStatus", "status"];
  for (const c of candidates) {
    if (row[c] !== undefined && row[c] !== null && String(row[c]).trim() !== "") return String(row[c]).trim();
  }
  return "";
}

// ---------- improved current data generator ----------
async function generateCurrentDataFromRawSheets(
  scope: HierarchyFilter,
  allCities: { id: string; name: string; regionId?: string }[],
  allSites: { id: string; name: string; cityId: string; district?: string }[]
): Promise<Array<{ [key: string]: any }>> {
  const rawData = await getRawSheetData();
  if (!rawData || rawData.length === 0) return [];

  const todayStr = "Today";

  // filter rows by scope & status (include ON-AIR and In Progress)
  const filteredRows = rawData.filter((r: any) => {
    const regionName = getRegionName(r);
    const cityName = getCityName(r);
    const districtName = getDistrictName(r);
    const matchingCity = allCities.find((c) => c.name === cityName);
    const matchingRegion = matchingCity?.regionId;

    if (scope.district && districtName && districtName !== scope.district) return false;
    if (scope.regionId && matchingRegion !== scope.regionId) return false;
    if (scope.cityId && matchingCity?.id !== scope.cityId) return false;

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

  if (filteredRows.length === 0) return [];

  const groupByDistrict = !!scope.district;
  const groupByRegion = !!scope.regionId && !scope.district;

  function computeAverages(values: number[], capacities: Array<number | null>) {
    const validPairs = values.map((v, i) => ({ v, cap: capacities[i] ?? null }));
    const simple = values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : 0;
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
    const fuels: number[] = [];
    const loads: number[] = [];
    const fuelCaps: Array<number | null> = [];
    const loadCaps: Array<number | null> = [];

    filteredRows.forEach((row: any) => {
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
    row[scope.district!] = fuelAvg.usedWeighted ? fuelAvg.weighted : fuelAvg.simple;
    row[`gen_${scope.district}`] = loadAvg.usedWeighted ? loadAvg.weighted : loadAvg.simple;
    currentData.push(row);
  } else if (groupByRegion) {
    const districtMap = new Map<
      string,
      { fuels: number[]; fuelCaps: Array<number | null>; loads: number[]; loadCaps: Array<number | null> }
    >();

    filteredRows.forEach((row: any) => {
      const districtName = getDistrictName(row) || "Unknown";
      if (!districtMap.has(districtName)) {
        districtMap.set(districtName, { fuels: [], fuelCaps: [], loads: [], loadCaps: [] });
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
    const regionMap = new Map<string, { fuels: number[]; fuelCaps: Array<number | null>; loads: number[]; loadCaps: Array<number | null> }>();

    filteredRows.forEach((row: any) => {
      const region = getRegionName(row) || "Unknown";
      if (!regionMap.has(region)) regionMap.set(region, { fuels: [], fuelCaps: [], loads: [], loadCaps: [] });
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

// ---------- Mock accumulative generator as fallback ----------
function generateMockTrendsData(scope: HierarchyFilter, allCities: any[], allSites: any[]) {
  const seededRandom = (seed: number) => {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  let filteredCities = allCities;
  if (scope.cityId) filteredCities = allCities.filter((c) => c.id === scope.cityId);
  else if (scope.regionId) filteredCities = allCities.filter((c) => c.regionId === scope.regionId);

  if (scope.district) {
    const cityIds = new Set<string>();
    allSites.forEach((s: any) => {
      if (s.district === scope.district) cityIds.add(s.cityId);
    });
    filteredCities = filteredCities.filter((c) => cityIds.has(c.id));
  }

  const cities = filteredCities.map((c) => c.name);
  const startDate = new Date(2025, 0, 1);
  const today = new Date();
  const monthsArr: string[] = [];
  for (let m = new Date(startDate); m <= today; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
    monthsArr.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`);
  }

  // current
  const currentData: any[] = [{ name: "Today" }];
  if (scope.district) {
    currentData[0][scope.district] = Math.round(seededRandom(123) * 100);
    currentData[0][`gen_${scope.district}`] = Math.round(seededRandom(456) * 100);
  } else if (scope.regionId) {
    const districtSet = new Set<string>();
    allSites.forEach((s) => {
      const city = allCities.find((c) => c.id === s.cityId);
      if (city && city.regionId === scope.regionId && s.district) districtSet.add(s.district);
    });
    let seed = 789;
    Array.from(districtSet).forEach((d) => {
      currentData[0][d] = Math.round(seededRandom(seed++) * 100);
      currentData[0][`gen_${d}`] = Math.round(seededRandom(seed++) * 100);
    });
  } else {
    const regionSet = new Set<string>();
    allCities.forEach((c) => { if (c.regionId) regionSet.add(c.regionId); });
    let seed = 500;
    Array.from(regionSet).forEach((r) => {
      currentData[0][r] = Math.round(seededRandom(seed++) * 100);
      currentData[0][`gen_${r}`] = Math.round(seededRandom(seed++) * 100);
    });
  }

  // accumulative
  const accumulativeData: any[] = [];
  const baseValues = cities.map((_, idx) => Math.round(seededRandom(idx + 17) * 200000) + 50000);
  const nMonths = monthsArr.length || 1;
  monthsArr.forEach((monthStr, monthIdx) => {
    const row: any = { date: monthStr };
    cities.forEach((city, ci) => {
      const base = baseValues[ci];
      const noise = seededRandom(ci * 31 + monthIdx) * base * 0.05;
      const value = Math.round(base * ((monthIdx + 1) / nMonths) + noise);
      row[`fuel_consumption_L_${city}`] = value;
      row[`co2_emissions_tons_${city}`] = Math.round((value * 2.68) / 1000 * 100) / 100;
      row[`power_consumption_kWh_${city}`] = Math.round(value * 0.9);
    });
    accumulativeData.push(row);
  });

  return { currentData, accumulativeData, cities };
}

// ---------- Small inline charts for CO2 & Power ----------
function Co2Chart({ data }: { data: any[] }) {
  const keys = useMemo(() => {
    if (!data || !data.length) return [];
    return Object.keys(data[0]).filter((k) => k !== "date").slice(0, 4);
  }, [data]);

  if (!data || data.length === 0) return <div style={{ color: "white" }}>No data</div>;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
        <XAxis dataKey="date" stroke="#FFFFFF" tick={{ fontSize: 13, fill: "#FFFFFF" }} />
        <YAxis stroke="#FFFFFF" tick={{ fontSize: 13, fill: "#FFFFFF" }} />
        <ReTooltip />
        <Legend wrapperStyle={{ paddingTop: 8, color: "#fff" }} />
        {keys.map((k, i) => (
          <Line key={k} type="monotone" dataKey={k} stroke={["#4B0082", "#00C5D4", "#FF3B61", "#FF7A33"][i % 4]} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function PowerChart({ data }: { data: any[] }) {
  const keys = useMemo(() => {
    if (!data || !data.length) return [];
    return Object.keys(data[0]).filter((k) => k !== "date").slice(0, 4);
  }, [data]);

  if (!data || data.length === 0) return <div style={{ color: "white" }}>No data</div>;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
        <XAxis dataKey="date" stroke="#FFFFFF" tick={{ fontSize: 13, fill: "#FFFFFF" }} />
        <YAxis stroke="#FFFFFF" tick={{ fontSize: 13, fill: "#FFFFFF" }} />
        <ReTooltip />
        <Legend wrapperStyle={{ paddingTop: 8, color: "#fff" }} />
        {keys.map((k, i) => (
          <Line key={k} type="monotone" dataKey={k} stroke={["#00C5D4", "#FF3B61", "#FF7A33", "#4B0082"][i % 4]} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ---------- Main component ----------
export default function EnergyTrends() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [hierarchy, setHierarchy] = useState<any | null>(null);
  const [loadingHierarchy, setLoadingHierarchy] = useState(true);
  const [hierarchyError, setHierarchyError] = useState<string | null>(null);

  const [scope, setScope] = useState<HierarchyFilter>({ level: "national" });
  const [range, setRange] = useState<"1m" | "3m" | "6m" | "12m" | "all">("all");

  const [trendsData, setTrendsData] = useState<any | null>(null);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [trendsError, setTrendsError] = useState<string | null>(null);

  // fetch hierarchy once
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingHierarchy(true);
        const res = await fetch("/api/hierarchy");
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = await res.json();
        if (mounted) setHierarchy(json);
      } catch (err: any) {
        console.error("hierarchy fetch error", err);
        if (mounted) setHierarchyError(String(err));
      } finally {
        if (mounted) setLoadingHierarchy(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // compute trends data when hierarchy or scope changes
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingTrends(true);
        setTrendsError(null);

        // when hierarchy not ready, skip
        if (!hierarchy) {
          setTrendsData(null);
          return;
        }

        // try real current data from sheet
        const current = await generateCurrentDataFromRawSheets(scope, hierarchy.cities || [], hierarchy.sites || []);
        // try accumulative from server endpoint
        let accumResp = null;
        try {
          const qStart = "2025-01";
          const qEnd = undefined;
          const url = `/api/trends/accumulative?start=${encodeURIComponent(qStart)}${qEnd ? `&end=${encodeURIComponent(qEnd)}` : ""}`;
          const r = await fetch(url);
          if (r.ok) accumResp = await r.json();
        } catch (err) {
          // ignore
        }

        // If accumResp empty use mock
        let mock = generateMockTrendsData(scope, hierarchy.cities || [], hierarchy.sites || []);
        const accumulativeData = Array.isArray(accumResp) && accumResp.length ? accumResp : mock.accumulativeData;
        const cities = mock.cities;

        const final = {
          currentData: current && current.length ? current : mock.currentData,
          accumulativeData,
          cities,
        };

        if (mounted) setTrendsData(final);
      } catch (err: any) {
        console.error("trends data error", err);
        if (mounted) setTrendsError(String(err));
      } finally {
        if (mounted) setLoadingTrends(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [hierarchy, scope]);

  // build accumulative range from selected range
  const accumulativeForDisplay = useMemo(() => {
    if (!trendsData || !trendsData.accumulativeData) return [];
    const all = trendsData.accumulativeData;
    if (range === "all") return all;
    const months = all.map((r: any) => r.date);
    const end = months.length - 1;
    const back = range === "1m" ? 1 : range === "3m" ? 3 : range === "6m" ? 6 : 12;
    const start = Math.max(0, end - (back - 1));
    return all.slice(start);
  }, [trendsData, range]);

  const exportCSV = () => {
    if (!trendsData || !trendsData.accumulativeData) return;
    const csv = objectsToCSV(trendsData.accumulativeData);
    downloadCSV("accumulative_trends.csv", csv);
  };

  // Loading / error states
  const isLoading = loadingHierarchy || loadingTrends;
  const error = hierarchyError || trendsError;

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
        backgroundColor: "rgba(0,0,0,0.6)",
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
          background: "#5c0ba2",
          borderRadius: 12,
          width: "95%",
          maxWidth: 1200,
          padding: 20,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 id="energy-trends-title" style={{ color: "#fff", fontSize: 22, fontWeight: 700 }}>
            Energy Trends
          </h2>
          <button
            onClick={() => navigate("/")}
            style={{ background: "#e53e3e", color: "#fff", padding: "8px 12px", borderRadius: 8, border: "none" }}
          >
            Close
          </button>
        </div>

        {isLoading && <div style={{ color: "#fff", padding: 12 }}>Loading...</div>}
        {error && <div style={{ color: "salmon", padding: 12 }}>Error: {error}</div>}

        {!isLoading && !error && (
          <>
            {/* Filters */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ color: "#fff", fontWeight: 700 }}>Region</label>
                <select
                  value={scope.regionId || ""}
                  onChange={(e) => setScope((p) => ({ ...p, regionId: e.target.value || undefined, district: undefined }))}
                  style={{ width: "100%", padding: 8, borderRadius: 6, marginTop: 6 }}
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
                <label style={{ color: "#fff", fontWeight: 700 }}>District</label>
                <select
                  value={scope.district || ""}
                  onChange={(e) => setScope((p) => ({ ...p, district: e.target.value || undefined }))}
                  disabled={!scope.regionId}
                  style={{ width: "100%", padding: 8, borderRadius: 6, marginTop: 6 }}
                >
                  <option value="">All Districts</option>
                  {(() => {
                    if (!hierarchy || !scope.regionId) return [];
                    // compute districts for region
                    const cities = hierarchy.cities?.filter((c: any) => c.regionId === scope.regionId) || [];
                    const cityIds = new Set(cities.map((c: any) => c.id));
                    const districts = new Set<string>();
                    (hierarchy.sites || []).forEach((s: any) => {
                      if (cityIds.has(s.cityId) && s.district) districts.add(s.district);
                    });
                    return Array.from(districts).map((d) => <option key={d} value={d}>{d}</option>);
                  })()}
                </select>
              </div>
            </div>

            {/* Two charts side-by-side */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: 12, borderRadius: 8 }}>
                <h3 style={{ color: "#fff", marginBottom: 8 }}>Current Fuel Level by {scope.district ? "District" : scope.regionId ? "District" : "Region"} (Today)</h3>
                <div style={{ height: 320 }}>
                  <FuelLevelChart data={trendsData?.currentData || []} cities={trendsData?.cities || []} />
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.03)", padding: 12, borderRadius: 8 }}>
                <h3 style={{ color: "#fff", marginBottom: 8 }}>Generator Load Trend by {scope.district ? "District" : scope.regionId ? "District" : "Region"} (Today)</h3>
                <div style={{ height: 320 }}>
                  <GeneratorLoadChart data={trendsData?.currentData || []} cities={trendsData?.cities || []} />
                </div>
              </div>
            </div>

            {/* Accumulative Fuel */}
            <div style={{ background: "rgba(255,255,255,0.03)", padding: 12, borderRadius: 8, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <h3 style={{ color: "#fff" }}>Accumulative Fuel Consumption (Monthly from 1/1/2025)</h3>
                <div style={{ display: "flex", gap: 8 }}>
                  <select value={range} onChange={(e) => setRange(e.target.value as any)} style={{ padding: 6 }}>
                    <option value="all">From 2025-01</option>
                    <option value="12m">Last 12 months</option>
                    <option value="6m">Last 6 months</option>
                    <option value="3m">Last 3 months</option>
                    <option value="1m">Last 1 month</option>
                  </select>
                  <button onClick={() => { if (trendsData) { const csv = objectsToCSV(trendsData.accumulativeData || []); downloadCSV("accumulative_trends.csv", csv); } }} style={{ padding: "6px 10px", background: "#fff", borderRadius: 6, color: "#5c0ba2", fontWeight: 700 }}>
                    Export CSV
                  </button>
                </div>
              </div>
              <div style={{ height: 360 }}>
                <FuelConsumptionChart data={accumulativeForDisplay} />
              </div>
            </div>

            {/* CO2 */}
            <div style={{ background: "rgba(255,255,255,0.03)", padding: 12, borderRadius: 8, marginBottom: 16 }}>
              <h3 style={{ color: "#fff", marginBottom: 8 }}>Accumulative CO₂ Emissions (Monthly from 1/1/2025)</h3>
              <div style={{ height: 320 }}>
                <Co2Chart data={accumulativeForDisplay.map((r: any) => {
                  const out: any = { date: r.date };
                  Object.keys(r).forEach((k) => {
                    if (k.startsWith("co2_emissions_tons_")) out[k.replace("co2_emissions_tons_", "")] = r[k];
                  });
                  return out;
                })} />
              </div>
            </div>

            {/* Power */}
            <div style={{ background: "rgba(255,255,255,0.03)", padding: 12, borderRadius: 8, marginBottom: 16 }}>
              <h3 style={{ color: "#fff", marginBottom: 8 }}>Accumulative Power Consumption (Monthly from 1/1/2025)</h3>
              <div style={{ height: 320 }}>
                <PowerChart data={accumulativeForDisplay.map((r: any) => {
                  const out: any = { date: r.date };
                  Object.keys(r).forEach((k) => {
                    if (k.startsWith("power_consumption_kWh_")) out[k.replace("power_consumption_kWh_", "")] = r[k];
                  });
                  return out;
                })} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

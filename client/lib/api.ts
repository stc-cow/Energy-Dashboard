import {
  AlertsResponse,
  BenchmarkResponse,
  BreakdownResponse,
  HierarchyFilter,
  HierarchyResponse,
  KPIsResponse,
  TimeSeriesQuery,
  TimeSeriesResponse,
} from "@shared/api";

function toQuery(params: Record<string, any>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

import {
  mockAlerts,
  mockBenchmark,
  mockBreakdown,
  mockHierarchy,
  mockKPIs,
  mockTimeSeries,
} from "./mocks";

const isStatic =
  typeof window !== "undefined" &&
  (window.location.hostname.includes("github.io") ||
    window.location.protocol === "file:");

// Sheet data wiring
const SHEET_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_SHEET_URL) ||
  "https://docs.google.com/spreadsheets/d/1Y_GvVbzKWb_p1r-xYCjcb4l1EvLwsz47J-7dyyUqh-g/edit?usp=sharing";

let sheetPromise: Promise<any[]> | null = null;

function toNumber(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/,/g, "").trim());
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function slug(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function getDateKey(rows: any[]): string | null {
  const keys = rows.length ? Object.keys(rows[0]) : [];
  let bestKey: string | null = null;
  let bestCount = 0;
  for (const k of keys) {
    let count = 0;
    for (let i = 0; i < Math.min(rows.length, 200); i++) {
      const v = rows[i]?.[k];
      if (!v) continue;
      const d = new Date(v as any);
      if (!isNaN(d.getTime())) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      bestKey = count > 0 ? k : bestKey;
    }
  }
  return bestKey;
}

function parseGVizJSON(text: string): any[] {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return [];
  try {
    const json = JSON.parse(text.slice(start, end + 1));
    const table = json.table;
    const headers: string[] = (table.cols || []).map((c: any) =>
      String(c.label || ""),
    );
    const rows: any[] = [];
    for (const row of table.rows || []) {
      const obj: any = {};
      (row.c || []).forEach((cell: any, i: number) => {
        const key = headers[i] || `col${i}`;
        obj[key] = cell ? cell.v : null;
      });
      rows.push(obj);
    }
    return rows;
  } catch {
    return [];
  }
}

function googleGVizUrl(u: string): string | null {
  const m = u.match(
    /https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
  );
  if (!m) return null;
  const id = m[1];
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json`;
}

async function getRows(): Promise<any[]> {
  if (!SHEET_URL || isStatic) return [];
  if (!sheetPromise) {
    const gviz = googleGVizUrl(SHEET_URL);
    if (gviz) {
      sheetPromise = fetch(gviz)
        .then((r) => {
          if (!r.ok) throw new Error(`sheet fetch failed: ${r.status}`);
          return r.text();
        })
        .then((text) => parseGVizJSON(text))
        .catch(() => [] as any[]);
    } else {
      sheetPromise = fetch(SHEET_URL)
        .then((r) => {
          if (!r.ok) throw new Error(`sheet fetch failed: ${r.status}`);
          return r.json();
        })
        .then((data) => {
          if (Array.isArray(data)) return data as any[];
          if (data && Array.isArray((data as any).data))
            return (data as any).data;
          return [] as any[];
        })
        .catch(() => [] as any[]);
    }
  }
  return sheetPromise;
}

function buildHierarchy(rows: any[]): HierarchyResponse {
  const regionMap = new Map<string, { id: string; name: string }>();
  const cityMap = new Map<
    string,
    { id: string; name: string; regionId: string }
  >();
  const siteMap = new Map<
    string,
    { id: string; name: string; cityId: string; lat: number; lng: number }
  >();

  for (const r of rows) {
    const regionName = String(
      r["regionName"] ?? r["Region"] ?? r["region"] ?? "",
    ).trim();
    const cityName = String(
      r["cityName"] ?? r["City"] ?? r["city"] ?? "",
    ).trim();
    const siteName = String(
      r["siteName"] ?? r["Site"] ?? r["site"] ?? "",
    ).trim();

    const regionId = slug(regionName || "unknown-region");
    const cityId = slug(cityName || `city-${regionId}`);
    const siteId = slug(siteName || `site-${cityId}`);

    if (regionName && !regionMap.has(regionId)) {
      regionMap.set(regionId, { id: regionId, name: regionName });
    }
    if (cityName && !cityMap.has(cityId)) {
      cityMap.set(cityId, { id: cityId, name: cityName, regionId });
    }
    if (siteName && !siteMap.has(siteId)) {
      const lat = toNumber(r["lat"] ?? r["latitude"] ?? r["Lat"] ?? 0);
      const lng = toNumber(
        r["lng"] ?? r["longitude"] ?? r["Lon"] ?? r["long"] ?? 0,
      );
      siteMap.set(siteId, { id: siteId, name: siteName, cityId, lat, lng });
    }
  }

  return {
    regions: Array.from(regionMap.values()),
    cities: Array.from(cityMap.values()),
    sites: Array.from(siteMap.values()),
  };
}

function rowsInScope(rows: any[], scope: HierarchyFilter) {
  return rows.filter((r) => {
    const regionId = slug(
      String(r["regionName"] ?? r["Region"] ?? r["region"] ?? ""),
    );
    const cityId = slug(String(r["cityName"] ?? r["City"] ?? r["city"] ?? ""));
    const siteId = slug(String(r["siteName"] ?? r["Site"] ?? r["site"] ?? ""));

    if (scope.level === "national") return true;
    if (scope.level === "region")
      return scope.regionId ? regionId === scope.regionId : true;
    if (scope.level === "city") {
      if (scope.cityId) return cityId === scope.cityId;
      return scope.regionId ? regionId === scope.regionId : true;
    }
    if (scope.level === "site") {
      if (scope.siteId) return siteId === scope.siteId;
      if (scope.cityId) return cityId === scope.cityId;
      if (scope.regionId) return regionId === scope.regionId;
    }
    return true;
  });
}

export async function fetchHierarchy(): Promise<HierarchyResponse> {
  if (isStatic || !SHEET_URL) return mockHierarchy();
  try {
    const rows = await getRows();
    if (!rows.length) return mockHierarchy();
    return buildHierarchy(rows);
  } catch {
    return mockHierarchy();
  }
}

export async function fetchKPIs(scope: HierarchyFilter): Promise<KPIsResponse> {
  if (isStatic || !SHEET_URL) return mockKPIs(scope);
  try {
    const rowsAll = await getRows();
    const rows = rowsInScope(rowsAll, scope);

    const diesel = rows.reduce(
      (s, r) => s + toNumber(r["dieselLitersPerDay"]),
      0,
    );
    const powerKw = rows.reduce((s, r) => s + toNumber(r["powerDemandKw"]), 0);
    const co2 = rows.reduce((s, r) => s + toNumber(r["co2Tons"]), 0);

    const fuelLevels = rows
      .map((r) => toNumber(r["fuelTankLevelPct"]))
      .filter((n) => n > 0 || n === 0);
    const avgFuel = fuelLevels.length
      ? fuelLevels.reduce((a, b) => a + b, 0) / fuelLevels.length
      : 0;

    const genLoads = rows
      .map((r) => toNumber(r["generatorLoadFactorPct"]))
      .filter((n) => n > 0 || n === 0);
    const avgLoad = genLoads.length
      ? genLoads.reduce((a, b) => a + b, 0) / genLoads.length
      : 0;

    const eff = diesel > 0 ? (powerKw * 24) / diesel : 0;

    // Top sites by diesel and low fuel list
    const siteAgg = new Map<
      string,
      {
        siteId: string;
        siteName: string;
        diesel: number;
        co2: number;
        fuel: number[];
      }
    >();
    for (const r of rows) {
      const siteName = String(
        r["siteName"] ?? r["Site"] ?? r["site"] ?? "",
      ).trim();
      if (!siteName) continue;
      const siteId = slug(siteName);
      const d = toNumber(r["dieselLitersPerDay"]);
      const c = toNumber(r["co2Tons"]);
      const f = toNumber(r["fuelTankLevelPct"]);
      if (!siteAgg.has(siteId))
        siteAgg.set(siteId, { siteId, siteName, diesel: 0, co2: 0, fuel: [] });
      const a = siteAgg.get(siteId)!;
      a.diesel += d;
      a.co2 += c;
      if (f || f === 0) a.fuel.push(f);
    }

    const topSites = Array.from(siteAgg.values())
      .map((x) => ({
        siteId: x.siteId,
        siteName: x.siteName,
        dieselLitersPerDay: Math.round(x.diesel),
        co2TonsPerDay: Math.round(x.co2 * 100) / 100,
      }))
      .sort((a, b) => b.dieselLitersPerDay - a.dieselLitersPerDay)
      .slice(0, 10);

    const lowFuelWarnings = Array.from(siteAgg.values())
      .map((x) => ({
        siteId: x.siteId,
        siteName: x.siteName,
        fuelTankLevelPct: x.fuel.length
          ? Math.round(
              (x.fuel.reduce((a, b) => a + b, 0) / x.fuel.length) * 10,
            ) / 10
          : 0,
      }))
      .filter((x) => x.fuelTankLevelPct <= 20)
      .slice(0, 20);

    const response: KPIsResponse = {
      asOf: new Date().toISOString(),
      scope,
      kpis: {
        dieselLitersPerDay: {
          label: "Diesel",
          value: Math.round(diesel),
          unit: "L/day",
        },
        powerDemandKw: {
          label: "Power Demand",
          value: Math.round(powerKw),
          unit: "kW",
        },
        co2TonsPerDay: {
          label: "CO₂ Emissions",
          value: Math.round(co2 * 100) / 100,
          unit: "t/day",
        },
        fuelTankLevelPct: {
          label: "Fuel Tank",
          value: Math.round(avgFuel * 10) / 10,
          unit: "%",
        },
        co2ReductionYoYPct: {
          label: "CO₂ YoY",
          value: 0,
          unit: "%",
        },
        energyEfficiencyKwhPerLiter: {
          label: "Efficiency",
          value: Math.round(eff * 100) / 100,
          unit: "kWh/L",
        },
        generatorLoadFactorPct: {
          label: "Load Factor",
          value: Math.round(avgLoad * 10) / 10,
          unit: "%",
        },
        runningVsStandbyHours: {
          runningHours: { label: "Running", value: 0, unit: "h/day" },
          standbyHours: { label: "Standby", value: 0, unit: "h/day" },
        },
      },
      topSites,
      lowFuelWarnings,
    };

    return response;
  } catch {
    return mockKPIs(scope);
  }
}

export async function fetchTimeSeries(
  scope: HierarchyFilter,
  q: TimeSeriesQuery,
): Promise<TimeSeriesResponse> {
  if (isStatic || !SHEET_URL) return mockTimeSeries(scope, q.granularity);
  try {
    const rowsAll = await getRows();
    const rows = rowsInScope(rowsAll, scope);
    const dateKey = getDateKey(rows) || "";

    type Bucket = { diesel: number; co2: number; powerKw: number };
    const buckets = new Map<string, Bucket>();

    function bucketKey(d: Date): string {
      if (q.granularity === "yearly")
        return new Date(Date.UTC(d.getUTCFullYear(), 0, 1)).toISOString();
      if (q.granularity === "monthly")
        return new Date(
          Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1),
        ).toISOString();
      return new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
      ).toISOString();
    }

    for (const r of rows) {
      let d = new Date();
      if (dateKey) {
        const cand = new Date(r[dateKey]);
        if (!isNaN(cand.getTime())) d = cand;
      }
      const key = bucketKey(d);
      if (!buckets.has(key))
        buckets.set(key, { diesel: 0, co2: 0, powerKw: 0 });
      const b = buckets.get(key)!;
      b.diesel += toNumber(r["dieselLitersPerDay"]);
      b.co2 += toNumber(r["co2Tons"]);
      b.powerKw += toNumber(r["powerDemandKw"]);
    }

    const from = q.from ? new Date(q.from) : null;
    const to = q.to ? new Date(q.to) : null;

    const series = Array.from(buckets.entries())
      .map(([t, b]) => ({
        t,
        dieselLiters: b.diesel,
        co2Tons: b.co2,
        efficiencyKwhPerLiter: b.diesel > 0 ? (b.powerKw * 24) / b.diesel : 0,
      }))
      .filter((p) => {
        const dt = new Date(p.t).getTime();
        if (from && dt < from.getTime()) return false;
        if (to && dt > to.getTime()) return false;
        return true;
      })
      .sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime());

    return { scope, granularity: q.granularity, series };
  } catch {
    return mockTimeSeries(scope, q.granularity);
  }
}

export async function fetchBreakdown(
  scope: HierarchyFilter,
  by: "region" | "site",
): Promise<BreakdownResponse> {
  if (isStatic || !SHEET_URL) return mockBreakdown(scope, by);
  try {
    const rowsAll = await getRows();
    const rows = rowsInScope(rowsAll, scope);

    if (by === "region") {
      const map = new Map<
        string,
        { name: string; diesel: number; energy: number }
      >();
      for (const r of rows) {
        const regionName = String(
          r["regionName"] ?? r["Region"] ?? r["region"] ?? "",
        ).trim();
        const key = slug(regionName);
        if (!map.has(key))
          map.set(key, { name: regionName || "Unknown", diesel: 0, energy: 0 });
        const m = map.get(key)!;
        const d = toNumber(r["dieselLitersPerDay"]);
        const p = toNumber(r["powerDemandKw"]);
        m.diesel += d;
        m.energy += p * 24;
      }
      return {
        scope,
        by,
        data: Array.from(map.entries()).map(([key, v]) => ({
          key,
          name: v.name,
          dieselLiters: Math.round(v.diesel),
          energyKwh: Math.round(v.energy),
        })),
      };
    }

    const siteMap = new Map<
      string,
      { name: string; diesel: number; energy: number }
    >();
    for (const r of rows) {
      const siteName = String(
        r["siteName"] ?? r["Site"] ?? r["site"] ?? "",
      ).trim();
      const key = slug(siteName);
      if (!siteMap.has(key))
        siteMap.set(key, { name: siteName || "Unknown", diesel: 0, energy: 0 });
      const m = siteMap.get(key)!;
      const d = toNumber(r["dieselLitersPerDay"]);
      const p = toNumber(r["powerDemandKw"]);
      m.diesel += d;
      m.energy += p * 24;
    }
    return {
      scope,
      by,
      data: Array.from(siteMap.entries()).map(([key, v]) => ({
        key,
        name: v.name,
        dieselLiters: Math.round(v.diesel),
        energyKwh: Math.round(v.energy),
      })),
    };
  } catch {
    return mockBreakdown(scope, by);
  }
}

export async function fetchBenchmark(
  scope: HierarchyFilter,
): Promise<BenchmarkResponse> {
  if (isStatic || !SHEET_URL) return mockBenchmark(scope);
  try {
    const rowsAll = await getRows();
    const rows = rowsInScope(rowsAll, scope);
    const map = new Map<
      string,
      { name: string; diesel: number; power: number; co2: number }
    >();
    for (const r of rows) {
      const siteName = String(
        r["siteName"] ?? r["Site"] ?? r["site"] ?? "",
      ).trim();
      if (!siteName) continue;
      const key = slug(siteName);
      if (!map.has(key))
        map.set(key, { name: siteName, diesel: 0, power: 0, co2: 0 });
      const m = map.get(key)!;
      m.diesel += toNumber(r["dieselLitersPerDay"]);
      m.power += toNumber(r["powerDemandKw"]);
      m.co2 += toNumber(r["co2Tons"]);
    }
    return {
      scope,
      points: Array.from(map.entries()).map(([siteId, v]) => ({
        siteId,
        siteName: v.name,
        dieselLiters: Math.round(v.diesel),
        powerKw: Math.round(v.power),
        co2Tons: Math.round(v.co2 * 100) / 100,
      })),
    };
  } catch {
    return mockBenchmark(scope);
  }
}

export async function fetchAlerts(
  scope: HierarchyFilter,
): Promise<AlertsResponse> {
  if (isStatic || !SHEET_URL) return mockAlerts(scope);
  try {
    const rows = rowsInScope(await getRows(), scope);
    const items = rows
      .map((r, idx) => {
        const siteName = String(
          r["siteName"] ?? r["Site"] ?? r["site"] ?? "",
        ).trim();
        const siteId = slug(siteName);
        const fuel = toNumber(r["fuelTankLevelPct"]);
        if (fuel <= 20) {
          return {
            id: `${siteId}-fuel-low-${idx}`,
            severity: fuel <= 10 ? ("high" as const) : ("medium" as const),
            kind: "fuel_low" as const,
            message: `${siteName} fuel tank at ${Math.round(fuel)}%`,
            siteId,
            createdAt: new Date().toISOString(),
          };
        }
        return null;
      })
      .filter(Boolean) as AlertsResponse["items"];
    return { scope, items };
  } catch {
    return mockAlerts(scope);
  }
}

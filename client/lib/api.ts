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
function getSheetUrl(): string | null {
  const envUrl =
    (typeof import.meta !== "undefined" &&
      (import.meta as any).env?.VITE_SHEET_URL) ||
    null;
  let urlParam: string | null = null;
  if (typeof window !== "undefined") {
    const u = new URL(window.location.href.replace(/#\//, "/"));
    urlParam = u.searchParams.get("sheet") || null;
    if (!urlParam && window.location.hash.includes("sheet=")) {
      const hash = window.location.hash.split("?")[1] || "";
      const sp = new URLSearchParams(hash);
      urlParam = sp.get("sheet");
    }
  }
  return (
    urlParam ||
    envUrl ||
    "https://docs.google.com/spreadsheets/d/1Y_GvVbzKWb_p1r-xYCjcb4l1EvLwsz47J-7dyyUqh-g/edit?usp=sharing"
  );
}
const SHEET_URL = getSheetUrl();

let sheetPromise: Promise<any[]> | null = null;

export function clearSheetCache() {
  sheetPromise = null;
}

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

function getRegionName(r: any): string {
  return String(
    r["regionName"] ??
      r["Region"] ??
      r["region"] ??
      r["Region Name"] ??
      r["region_name"] ??
      "",
  ).trim();
}

function getCityName(r: any): string {
  // Column F (index 5) fallback when labels differ
  return String(
    r["cityName"] ??
      r["City"] ??
      r["city"] ??
      r["City Name"] ??
      r["city_name"] ??
      r["col5"] ??
      "",
  ).trim();
}

function getSiteName(r: any): string {
  return String(
    r["siteName"] ??
      r["Site"] ??
      r["site"] ??
      r["Site Name"] ??
      r["site_name"] ??
      "",
  ).trim();
}

function getDistrictName(r: any): string {
  // Column G (index 6) fallback when labels differ
  return String(
    r["districtName"] ??
      r["district"] ??
      r["District"] ??
      r["District Name"] ??
      r["district_name"] ??
      r["col6"] ??
      "",
  ).trim();
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

type SheetEndpoint = { kind: "gviz" | "csv"; url: string } | null;
function getSheetEndpoint(u: string): SheetEndpoint {
  // Standard edit/view link: /d/<id>
  let m = u.match(
    /https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
  );
  if (m && !/\/e\//.test(u)) {
    const id = m[1];
    return {
      kind: "gviz",
      url: `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json`,
    };
  }
  // Published link: /d/e/<pubId>/pubhtml or pub?output=...
  m = u.match(
    /https:\/\/docs\.google\.com\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/,
  );
  if (m) {
    const pid = m[1];
    // Preserve gid if present
    let gid: string | null = null;
    try {
      gid = new URL(u).searchParams.get("gid");
    } catch {}
    // Default to CSV for broad CORS compatibility
    return {
      kind: "csv",
      url: `https://docs.google.com/spreadsheets/d/e/${pid}/pub?output=csv${gid ? `&gid=${gid}` : ""}`,
    };
  }
  // Direct CSV output links
  if (/output=csv/.test(u)) return { kind: "csv", url: u };
  return null;
}

function parseCSV(text: string): any[] {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((l) => l.length);
  if (!lines.length) return [];
  function splitCSV(line: string): string[] {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map((s) => s.trim());
  }
  const header = splitCSV(lines[0]).map((h, i) => h || `col${i}`);
  const rows: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCSV(lines[i]);
    if (cells.every((c) => c === "")) continue;
    const obj: any = {};
    for (let j = 0; j < header.length; j++) obj[header[j]] = cells[j] ?? "";
    rows.push(obj);
  }
  return rows;
}

async function getRows(): Promise<any[]> {
  if (!SHEET_URL) return [];
  if (!sheetPromise) {
    const ep = getSheetEndpoint(SHEET_URL);
    if (ep?.kind === "gviz") {
      sheetPromise = fetch(ep.url)
        .then((r) => {
          if (!r.ok) throw new Error(`sheet fetch failed: ${r.status}`);
          return r.text();
        })
        .then((text) => parseGVizJSON(text))
        .catch(() => [] as any[]);
    } else if (ep?.kind === "csv") {
      sheetPromise = fetch(ep.url)
        .then((r) => {
          if (!r.ok) throw new Error(`sheet fetch failed: ${r.status}`);
          return r.text();
        })
        .then((text) => parseCSV(text))
        .catch(() => [] as any[]);
    } else {
      // Fallback: try as JSON first, then as text->GViz
      sheetPromise = fetch(SHEET_URL)
        .then(async (r) => {
          if (!r.ok) throw new Error(`sheet fetch failed: ${r.status}`);
          const ct = r.headers.get("content-type") || "";
          if (ct.includes("application/json")) return r.json();
          const txt = await r.text();
          const rowsFromGViz = parseGVizJSON(txt);
          if (rowsFromGViz.length) return rowsFromGViz;
          return parseCSV(txt);
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
    {
      id: string;
      name: string;
      cityId: string;
      lat: number;
      lng: number;
      district?: string;
    }
  >();

  for (const r of rows) {
    const regionName = getRegionName(r);
    const cityName = getCityName(r);
    const siteName = getSiteName(r);

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
      const district = getDistrictName(r) || undefined;
      siteMap.set(siteId, {
        id: siteId,
        name: siteName,
        cityId,
        lat,
        lng,
        district,
      });
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
    const regionId = slug(getRegionName(r));
    const cityId = slug(getCityName(r));
    const siteId = slug(getSiteName(r));
    const districtName = getDistrictName(r);

    if (scope.district && districtName && districtName !== scope.district)
      return false;

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

export async function fetchAccumulations(
  scope: HierarchyFilter,
  from?: string,
  to?: string,
): Promise<{ powerKwh: number; fuelLiters: number; co2Tons: number }> {
  if (!SHEET_URL) return { powerKwh: 0, fuelLiters: 0, co2Tons: 0 };
  try {
    const rowsAll = await getRows();
    let rows = rowsInScope(rowsAll, scope);
    const dateKey = getDateKey(rows) || "";
    if (dateKey && (from || to)) {
      const fromTs = from ? new Date(from).getTime() : -Infinity;
      const toTs = to ? new Date(to).getTime() : Infinity;
      rows = rows.filter((r) => {
        const t = new Date(r[dateKey]).getTime();
        return t >= fromTs && t <= toTs;
      });
    }

    function normalizeKey(k: string): string {
      return String(k || "")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]/g, "");
    }
    function pickNumber(row: any, candidates: string[]): number {
      const map = new Map<string, any>();
      for (const [k, v] of Object.entries(row || {})) {
        const nk = normalizeKey(k);
        if (!map.has(nk)) map.set(nk, v);
      }
      for (const c of candidates) {
        const nk = normalizeKey(c);
        if (map.has(nk)) return toNumber(map.get(nk));
      }
      return 0;
    }

    const powerKwh = rows.reduce(
      (s, r) =>
        s +
        pickNumber(r, [
          "AccumPowerConsumption",
          "accumPowerConsumption",
          "Accum Power Consumption",
          "Accum_Power_Consumption",
          "PowerKwhAccumulation",
          "Power Kwh Accumulation",
          "power_kwh_accumulation",
        ]),
      0,
    );

    const fuelLiters = rows.reduce(
      (s, r) =>
        s +
        pickNumber(r, [
          "AccumFuelConsumption",
          "accumFuelConsumption",
          "Accum Fuel Consumption",
          "Accum_Fuel_Consumption",
          "FuelLitersAccumulation",
          "fuel_liters_accumulation",
        ]),
      0,
    );

    const co2Tons = rows.reduce(
      (s, r) =>
        s +
        pickNumber(r, [
          "AccumCO2Emissions",
          "accumCO2Emissions",
          "accumCo2Tons",
          "Accum CO2 Emissions",
          "CO2Accumulation",
          "co2_accumulation",
        ]),
      0,
    );

    return { powerKwh, fuelLiters, co2Tons };
  } catch {
    return { powerKwh: 0, fuelLiters: 0, co2Tons: 0 };
  }
}

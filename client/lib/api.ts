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
import {
  mockAlerts,
  mockBenchmark,
  mockBreakdown,
  mockHierarchy,
  mockKPIs,
  mockTimeSeries,
} from "./mocks";

// Utilities
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
function normalizeKey(k: string): string {
  return String(k || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]/g, "");
}
function getValueByCandidates(
  row: any,
  candidates: string[],
  regexes: RegExp[] = [],
): any {
  const map = new Map<string, { key: string; value: any }>();
  for (const [k, v] of Object.entries(row || {})) {
    const nk = normalizeKey(k);
    if (!map.has(nk)) map.set(nk, { key: String(k), value: v });
  }
  for (const c of candidates) {
    const nk = normalizeKey(c);
    if (map.has(nk)) return map.get(nk)!.value;
  }
  if (regexes.length) {
    for (const [k, v] of Object.entries(row || {})) {
      const keyStr = String(k);
      if (regexes.some((re) => re.test(keyStr))) return v as any;
    }
  }
  return undefined;
}
function pickNumberFromRow(
  row: any,
  candidates: string[],
  regexes: RegExp[] = [],
): number {
  const v = getValueByCandidates(row, candidates, regexes);
  return toNumber(v);
}
function pickStringFromRow(
  row: any,
  candidates: string[],
  regexes: RegExp[] = [],
): string {
  const v = getValueByCandidates(row, candidates, regexes);
  return v == null ? "" : String(v).trim();
}

// Sheet URL resolution
function getSheetUrl(): string | null {
  const serverEnvUrl =
    typeof process !== "undefined" && (process as any).env?.SHEET_URL
      ? String((process as any).env.SHEET_URL)
      : null;
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
    serverEnvUrl ||
    envUrl ||
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vS0GkXnQMdKYZITuuMsAzeWDtGUqEJ3lWwqNdA67NewOsDOgqsZHKHECEEkea4nrukx4-DqxKmf62nC/pub?gid=1149576218&single=true&output=csv"
  );
}
const SHEET_URL = getSheetUrl();
let sheetPromise: Promise<any[]> | null = null;
export function clearSheetCache() {
  sheetPromise = null;
}

// Parsing helpers
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

type SheetEndpoint = { kind: "gviz" | "csv"; url: string } | null;
function getSheetEndpoint(u: string): SheetEndpoint {
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
  m = u.match(
    /https:\/\/docs\.google\.com\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/,
  );
  if (m) {
    const pid = m[1];
    let gid: string | null = null;
    try {
      gid = new URL(u).searchParams.get("gid");
    } catch {}
    return {
      kind: "csv",
      url: `https://docs.google.com/spreadsheets/d/e/${pid}/pub?output=csv${gid ? `&gid=${gid}` : ""}`,
    };
  }
  if (/output=csv/.test(u)) return { kind: "csv", url: u };
  return null;
}

async function fetchTextWithFallback(url: string): Promise<{
  ok: boolean;
  text: string;
  status: number;
  contentType?: string;
}> {
  try {
    const r = await fetch(url);
    if (r.ok) {
      const text = await r.text();
      return {
        ok: true,
        text,
        status: r.status,
        contentType: r.headers.get("content-type") || undefined,
      };
    }
  } catch {}
  try {
    const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const r2 = await fetch(proxy);
    if (r2.ok) {
      const text = await r2.text();
      return {
        ok: true,
        text,
        status: r2.status,
        contentType: r2.headers.get("content-type") || undefined,
      };
    }
    return { ok: false, text: "", status: r2.status };
  } catch {
    return { ok: false, text: "", status: 0 };
  }
}

async function getRows(): Promise<any[]> {
  if (!SHEET_URL) return [];

  // If we're running in a browser, prefer the server proxy first to avoid CORS errors
  if (typeof window !== "undefined") {
    try {
      const resp = await fetch(
        `/api/sheet?sheet=${encodeURIComponent(SHEET_URL || "")}`,
      );
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data) && data.length) {
          sheetPromise = Promise.resolve(data as any[]);
          return data as any[];
        }
      } else {
        // log non-ok status for debugging
        console.warn("/api/sheet proxy returned", resp.status);
      }
    } catch (e: any) {
      // server proxy not available (static preview), continue with client-side fetch fallback
      console.warn("/api/sheet proxy unavailable:", e?.message || e);
    }
  }

  if (!sheetPromise) {
    const ep = getSheetEndpoint(SHEET_URL);
    // use an explicit async/await flow so any fetch exceptions are caught here
    sheetPromise = (async () => {
      try {
        if (ep?.kind === "gviz") {
          const res = await fetchTextWithFallback(ep.url);
          if (!res.ok) {
            console.warn("gviz fetch returned not ok", res.status);
            return [] as any[];
          }
          return parseGVizJSON(res.text);
        }
        if (ep?.kind === "csv") {
          const res = await fetchTextWithFallback(ep.url);
          if (!res.ok) {
            console.warn("csv fetch returned not ok", res.status);
            return [] as any[];
          }
          return parseCSV(res.text);
        }
        // generic
        const res = await fetchTextWithFallback(SHEET_URL);
        if (!res.ok) {
          console.warn("generic fetch returned not ok", res.status);
          return [] as any[];
        }
        const ct = res.contentType || "";
        const txt = res.text;
        if (ct.includes("application/json")) {
          try {
            const j = JSON.parse(txt);
            if (Array.isArray(j)) return j as any[];
          } catch (e) {
            /* ignore */
          }
        }
        const rowsFromGViz = parseGVizJSON(txt);
        if (rowsFromGViz.length) return rowsFromGViz;
        return parseCSV(txt);
      } catch (err) {
        console.warn("sheet fetch error", err);
        return [] as any[];
      }
    })();
  }

  try {
    const rows = await sheetPromise;
    return rows;
  } catch (err) {
    console.warn("sheetPromise rejected", err);
    return [];
  }
}

// Accessors
function getRegionName(r: any): string {
  return pickStringFromRow(
    r,
    [
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
    ],
    [/region/i, /province/i, /area/i],
  );
}
function getCityName(r: any): string {
  return pickStringFromRow(
    r,
    [
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
    ],
    [/city/i, /municipality/i, /governorate/i],
  );
}
function getSiteName(r: any): string {
  return pickStringFromRow(
    r,
    [
      "siteName",
      "Site",
      "site",
      "Site Name",
      "site_name",
      "Site ID",
      "siteId",
      "site_id",
      "col1",
    ],
    [/site/i],
  );
}
function getDistrictName(r: any): string {
  return pickStringFromRow(
    r,
    [
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
    ],
    [/district/i, /neigh/i, /subdistrict/i],
  );
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

// Build hierarchy from rows
// KPI helpers to resolve values from various headers and explicit column positions
function getDieselLitersPerDay(r: any): number {
  return pickNumberFromRow(
    r,
    [
      "dieselLitersPerDay",
      "Diesel Consumption",
      "Diesel",
      "diesellitersperday",
      "col21",
    ],
    [/diesel/i],
  );
}
function getPowerDemandKw(r: any): number {
  return pickNumberFromRow(
    r,
    ["powerDemandKw", "Power Demand", "Power", "powerdemandkw", "col22"],
    [/power.*(demand|kw)/i],
  );
}
function getCo2TonsPerDay(r: any): number {
  return pickNumberFromRow(
    r,
    [
      "co2Tons",
      "Daily CO₂ Emissions",
      "Daily CO2 Emissions",
      "CO2 Emissions",
      "co2tonsperday",
      "col23",
    ],
    [/co2|carbon/i],
  );
}
function getFuelTankLevelPct(r: any): number {
  return pickNumberFromRow(
    r,
    [
      "fuelTankLevelPct",
      "Fuel Tank Level %",
      "Fuel Level %",
      "fuel_level_pct",
      "fuel_tank_level_pct",
      "fuellevel%",
      "col24",
    ],
    [/fuel.*(level|%)/i, /tank.*(fuel|level)/i],
  );
}
function getGeneratorLoadFactorPct(r: any): number {
  return pickNumberFromRow(
    r,
    [
      "generatorLoadFactorPct",
      "Load Factor %",
      "Generator Load Factor %",
      "load_factor_pct",
      "gen_load_factor_pct",
      "generator_load_factor",
      "col25",
    ],
    [/load.*(factor|%)/i, /gen.*load/i],
  );
}

function getCowStatus(r: any): string {
  return pickStringFromRow(
    r,
    ["COWSTATUS", "CowStatus", "COW Status", "Status", "StatusCOW", "col9"],
    [/cow.*status/i, /^status$/i],
  );
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

  function latFromRow(r: any): number {
    const keys = Object.keys(r || {});
    let lat = toNumber(r["lat"] ?? r["latitude"] ?? r["Lat"]);
    let lng = toNumber(r["lng"] ?? r["longitude"] ?? r["Lon"] ?? r["long"]);
    if (!lat || !lng) {
      // prefer explicit L/M column positions if headers were blank
      const lNum = toNumber((r as any)["col11"] ?? (r as any)["L"]);
      const mNum = toNumber((r as any)["col12"] ?? (r as any)["M"]);
      if (lNum || mNum) {
        lat = lNum || lat;
        lng = mNum || lng;
      }
    }
    if (!lat || !lng) {
      // try to infer from numeric columns range
      const nums = keys.map((k) => ({ k, v: toNumber((r as any)[k]) }));
      const candLat = nums.find(
        (x) => Math.abs(x.v) > 0 && x.v >= -90 && x.v <= 90,
      );
      const candLng = nums.find(
        (x) =>
          Math.abs(x.v) > 0 &&
          x.v >= -180 &&
          x.v <= 180 &&
          Math.abs(x.v) > Math.abs(candLat?.v ?? 0),
      );
      if (candLat) lat = candLat.v;
      if (candLng) lng = candLng.v;
    }
    (r as any).__lat = lat;
    (r as any).__lng = lng;
    return lat;
  }

  for (const r of rows) {
    const regionName = getRegionName(r);
    const cityName = getCityName(r);
    const siteName = getSiteName(r);

    const regionId = slug(regionName || "unknown-region");
    const cityId = slug(cityName || `city-${regionId}`);
    const siteId = slug(siteName || `site-${cityId}`);

    if (regionName && !regionMap.has(regionId))
      regionMap.set(regionId, { id: regionId, name: regionName });
    if (cityName && !cityMap.has(cityId))
      cityMap.set(cityId, { id: cityId, name: cityName, regionId });
    if (siteName && !siteMap.has(siteId)) {
      const lat = (r as any).__lat ?? latFromRow(r) ?? 0;
      const lng = (r as any).__lng ?? 0;
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

// Public API
export async function fetchHierarchy(): Promise<HierarchyResponse> {
  if (!SHEET_URL) return mockHierarchy();
  try {
    const rows = await getRows();
    if (!rows.length) return mockHierarchy();
    return buildHierarchy(rows);
  } catch {
    return mockHierarchy();
  }
}

export async function fetchKPIs(scope: HierarchyFilter): Promise<KPIsResponse> {
  if (!SHEET_URL) return mockKPIs(scope);
  try {
    const rowsAll = await getRows();
    const rows = rowsInScope(rowsAll, scope);

    const diesel = rows.reduce((s, r) => s + getDieselLitersPerDay(r), 0);
    const powerKw = rows.reduce((s, r) => s + getPowerDemandKw(r), 0);
    const co2 = rows.reduce((s, r) => s + getCo2TonsPerDay(r), 0);

    const fuelLevels = rows
      .map((r) => getFuelTankLevelPct(r))
      .filter((n) => n > 0 || n === 0);
    const avgFuel = fuelLevels.length
      ? fuelLevels.reduce((a, b) => a + b, 0) / fuelLevels.length
      : 0;

    const genLoads = rows
      .map((r) => getGeneratorLoadFactorPct(r))
      .filter((n) => n > 0 || n === 0);
    const avgLoad = genLoads.length
      ? genLoads.reduce((a, b) => a + b, 0) / genLoads.length
      : 0;

    const eff = diesel > 0 ? (powerKw * 24) / diesel : 0;

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
      const d = getDieselLitersPerDay(r);
      const c = getCo2TonsPerDay(r);
      const f = getFuelTankLevelPct(r);
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

    return {
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
          label: "CO�� Emissions",
          value: Math.round(co2 * 100) / 100,
          unit: "t/day",
        },
        fuelTankLevelPct: {
          label: "Fuel Tank",
          value: Math.round(avgFuel * 10) / 10,
          unit: "%",
        },
        co2ReductionYoYPct: { label: "CO₂ YoY", value: 0, unit: "%" },
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
  } catch {
    return mockKPIs(scope);
  }
}

export async function fetchTimeSeries(
  scope: HierarchyFilter,
  q: TimeSeriesQuery,
): Promise<TimeSeriesResponse> {
  if (!SHEET_URL) return mockTimeSeries(scope, q.granularity);
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
      b.diesel += getDieselLitersPerDay(r);
      b.co2 += getCo2TonsPerDay(r);
      b.powerKw += getPowerDemandKw(r);
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
  if (!SHEET_URL) return mockBreakdown(scope, by);
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
        const d = getDieselLitersPerDay(r);
        const p = getPowerDemandKw(r);
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
      const d = getDieselLitersPerDay(r);
      const p = getPowerDemandKw(r);
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

export interface CowStats {
  onAir: number;
  offAir: number;
  byRegion: { regionId: string; regionName: string; count: number }[];
  byStatus: { status: string; count: number }[];
}
export async function fetchCowStats(scope: HierarchyFilter): Promise<CowStats> {
  if (!SHEET_URL) return { onAir: 0, offAir: 0, byRegion: [], byStatus: [] };
  try {
    const rowsAll = await getRows();
    const rows = rowsInScope(rowsAll, scope);
    const dateKey = getDateKey(rows) || "";

    type SiteRec = {
      siteId: string;
      siteName: string;
      regionId: string;
      regionName: string;
      status: string; // normalized label
      onAir: number;
      ts: number;
    };
    const sites = new Map<string, SiteRec>();

    for (const r of rows) {
      const siteName = getSiteName(r);
      if (!siteName) continue;
      const siteId = slug(siteName);
      const regionName = getRegionName(r) || "Unknown";
      const regionId = slug(regionName) || "unknown";
      const status = getCowStatus(r);
      const diesel = getDieselLitersPerDay(r);
      let ts = Date.now();
      if (dateKey) {
        const d = new Date(r[dateKey]);
        if (!isNaN(d.getTime())) ts = d.getTime();
      }
      const s = status.trim().toUpperCase();
      const isOn = /\bON[-\s]?AIR\b/.test(s) || s === "ON";
      const onAirFlag = s ? (isOn ? 1 : 0) : diesel > 0 ? 1 : 0;
      const rec: SiteRec = {
        siteId,
        siteName,
        regionId,
        regionName,
        status: normalizeCowStatusLabel(status),
        onAir: onAirFlag,
        ts,
      };
      const prev = sites.get(siteId);
      if (!prev || rec.ts >= prev.ts) sites.set(siteId, rec);
    }

    const uniqueSites = Array.from(sites.values());

    // Status breakdown
    function normalizeCowStatusLabel(raw: string): string {
      const s = String(raw || "").trim().toUpperCase();
      if (/\bON[-\s]?AIR\b/.test(s) || s === "ON") return "ON-AIR";
      if (/\bOFF[-\s]?AIR\b/.test(s) || s === "OFF") return "OFF-AIR";
      if (/BURN/.test(s)) return "Burned";
      if (/DAMAG/.test(s)) return "Damage";
      if (/IN\s*PROG|IN\s*PRE/.test(s)) return "In Progress";
      if (/REPAE|REPEAT/.test(s)) return "Repaeter";
      if (/STOLEN/.test(s)) return "Stolen";
      return s || "Other";
    }

    const byStatusMap = new Map<string, number>();
    for (const rec of uniqueSites) {
      const label = rec.status || "Other";
      byStatusMap.set(label, (byStatusMap.get(label) || 0) + 1);
    }

    const byStatus = Array.from(byStatusMap.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);

    const onAir = byStatusMap.get("ON-AIR") || 0;
    const offAir = byStatusMap.get("OFF-AIR") || 0;

    const by = new Map<
      string,
      { regionId: string; regionName: string; count: number }
    >();
    for (const s of uniqueSites) {
      if (!by.has(s.regionId))
        by.set(s.regionId, {
          regionId: s.regionId,
          regionName: s.regionName,
          count: 0,
        });
      by.get(s.regionId)!.count += 1;
    }
    const byRegion = Array.from(by.values()).sort((a, b) => b.count - a.count);
    return { onAir, offAir, byRegion, byStatus };
  } catch {
    return { onAir: 0, offAir: 0, byRegion: [], byStatus: [] };
  }
}

export async function fetchBenchmark(
  scope: HierarchyFilter,
): Promise<BenchmarkResponse> {
  if (!SHEET_URL) return mockBenchmark(scope);
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
      m.diesel += getDieselLitersPerDay(r);
      m.power += getPowerDemandKw(r);
      m.co2 += getCo2TonsPerDay(r);
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
  if (!SHEET_URL) return mockAlerts(scope);
  try {
    const rows = rowsInScope(await getRows(), scope);
    const items = rows
      .map((r, idx) => {
        const siteName = String(
          r["siteName"] ?? r["Site"] ?? r["site"] ?? "",
        ).trim();
        const siteId = slug(siteName);
        const fuel = pickNumberFromRow(
          r,
          [
            "fuelTankLevelPct",
            "Fuel Tank Level %",
            "Fuel Level %",
            "fuel_level_pct",
            "fuel_tank_level_pct",
            "col24",
          ],
          [/fuel.*(level|%)/i, /tank.*(fuel|level)/i],
        );
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

export async function fetchLowFuelSites(
  thresholdPct: number,
  scope: HierarchyFilter = { level: "national" },
): Promise<
  Array<{ siteId: string; siteName: string; fuelTankLevelPct: number }>
> {
  try {
    const rowsAll = await getRows();
    const rows = rowsInScope(rowsAll, scope);
    const siteAgg = new Map<
      string,
      { siteId: string; siteName: string; fuel: number[] }
    >();
    for (const r of rows) {
      const siteName = String(
        r["siteName"] ?? r["Site"] ?? r["site"] ?? "",
      ).trim();
      if (!siteName) continue;
      const siteId = slug(siteName);
      const f = pickNumberFromRow(
        r,
        [
          "fuelTankLevelPct",
          "Fuel Tank Level %",
          "Fuel Level %",
          "fuel_level_pct",
          "fuel_tank_level_pct",
          "col24",
        ],
        [/fuel.*(level|%)/i, /tank.*(fuel|level)/i],
      );
      if (!siteAgg.has(siteId))
        siteAgg.set(siteId, { siteId, siteName, fuel: [] });
      if (f || f === 0) siteAgg.get(siteId)!.fuel.push(f);
    }
    return Array.from(siteAgg.values())
      .map((x) => ({
        siteId: x.siteId,
        siteName: x.siteName,
        fuelTankLevelPct: x.fuel.length
          ? Math.round(
              (x.fuel.reduce((a, b) => a + b, 0) / x.fuel.length) * 10,
            ) / 10
          : 0,
      }))
      .filter((x) => x.fuelTankLevelPct < thresholdPct)
      .sort((a, b) => a.fuelTankLevelPct - b.fuelTankLevelPct);
  } catch {
    return [];
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
          "col26",
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
          "col27",
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
          "col28",
        ]),
      0,
    );

    return { powerKwh, fuelLiters, co2Tons };
  } catch {
    return { powerKwh: 0, fuelLiters: 0, co2Tons: 0 };
  }
}

// Heatmap: lat/lng + fuel value
export async function fetchFuelGeoPoints(
  scope: HierarchyFilter = { level: "national" },
): Promise<Array<{ lat: number; lng: number; value: number }>> {
  try {
    const rowsAll = await getRows();
    const rows = rowsInScope(rowsAll, scope);
    const out: Array<{ lat: number; lng: number; value: number }> = [];

    const inKSA = (la: number, ln: number) =>
      la >= 16 && la <= 33 && ln >= 34 && ln <= 56;

    for (const r of rows) {
      // fuel %
      const fuel = pickNumberFromRow(
        r,
        [
          "fuelTankLevelPct",
          "Fuel Tank Level %",
          "Fuel Level %",
          "fuel_level_pct",
          "fuel_tank_level_pct",
          "fuellevel%",
          "col24",
        ],
        [/fuel.*(level|%)/i, /tank.*(fuel|level)/i],
      );

      // lat/lng with inference + L/M fallback + KSA bounds swap
      let lat = toNumber(r["lat"] ?? r["latitude"] ?? r["Lat"]);
      let lng = toNumber(r["lng"] ?? r["longitude"] ?? r["Lon"] ?? r["long"]);

      // prefer specific columns (L/M) if headers were blank and parser used col indices
      const lNum = toNumber((r as any)["col11"] ?? (r as any)["L"]);
      const mNum = toNumber((r as any)["col12"] ?? (r as any)["M"]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || (!lat && !lng)) {
        if (lNum || mNum) {
          // try both assignments to satisfy KSA bounds
          const a1 = { lat: lNum, lng: mNum };
          const a2 = { lat: mNum, lng: lNum };
          if (inKSA(a1.lat, a1.lng)) {
            lat = a1.lat;
            lng = a1.lng;
          } else if (inKSA(a2.lat, a2.lng)) {
            lat = a2.lat;
            lng = a2.lng;
          } else {
            lat = lNum;
            lng = mNum;
          }
        }
      }
      if ((!lat || !lng) && r) {
        const entries = Object.entries(r).filter(
          ([, v]) =>
            typeof v === "number" || (typeof v === "string" && v.trim() !== ""),
        );
        const nums = entries.map(([k, v]) => ({ k, v: toNumber(v) }));
        const latCandidates = nums.filter((x) => x.v >= -90 && x.v <= 90);
        const lngCandidates = nums.filter((x) => x.v >= -180 && x.v <= 180);
        if (!lat && latCandidates.length) lat = latCandidates[0].v;
        if (!lng && lngCandidates.length)
          lng =
            lngCandidates.find(
              (x) => Math.abs(x.v) >= 34 && Math.abs(x.v) <= 56,
            )?.v || lngCandidates[0].v;
      }

      // final KSA swap check
      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        !inKSA(lat, lng) &&
        inKSA(lng, lat)
      ) {
        const t = lat;
        lat = lng;
        lng = t;
      }

      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        (fuel || fuel === 0) &&
        inKSA(lat, lng)
      ) {
        out.push({ lat, lng, value: fuel });
      }
    }
    return out;
  } catch {
    return [];
  }
}

export async function fetchCowStatusGeoPoints(
  scope: HierarchyFilter = { level: "national" },
): Promise<{
  onAir: Array<{ lat: number; lng: number; value: number }>;
  offAir: Array<{ lat: number; lng: number; value: number }>;
}> {
  try {
    const rowsAll = await getRows();
    const rows = rowsInScope(rowsAll, scope);
    const onAir: Array<{ lat: number; lng: number; value: number }> = [];
    const offAir: Array<{ lat: number; lng: number; value: number }> = [];

    const inKSA = (la: number, ln: number) =>
      la >= 16 && la <= 33 && ln >= 34 && ln <= 56;

    for (const r of rows) {
      const status = getCowStatus(r).trim().toUpperCase();
      const isOn = /\bON[-\s]?AIR\b/.test(status) || status === "ON";
      const isOff = /\bOFF[-\s]?AIR\b/.test(status) || status === "OFF";

      let lat = toNumber(
        (r as any)["col11"] ??
          (r as any)["L"] ??
          r["lat"] ??
          r["latitude"] ??
          r["Lat"],
      );
      let lng = toNumber(
        (r as any)["col12"] ??
          (r as any)["M"] ??
          r["lng"] ??
          r["longitude"] ??
          r["Lon"] ??
          r["long"],
      );

      if ((!lat || !lng) && r) {
        const entries = Object.entries(r).filter(
          ([, v]) =>
            typeof v === "number" || (typeof v === "string" && v.trim() !== ""),
        );
        const nums = entries.map(([k, v]) => ({ k, v: toNumber(v) }));
        const latCandidates = nums.filter((x) => x.v >= -90 && x.v <= 90);
        const lngCandidates = nums.filter((x) => x.v >= -180 && x.v <= 180);
        if (!lat && latCandidates.length) lat = latCandidates[0].v;
        if (!lng && lngCandidates.length) lng = lngCandidates[0].v;
      }

      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        !inKSA(lat, lng) &&
        inKSA(lng, lat)
      ) {
        const t = lat;
        lat = lng;
        lng = t;
      }

      if (Number.isFinite(lat) && Number.isFinite(lng) && inKSA(lat, lng)) {
        const point = { lat, lng, value: 1 };
        if (isOn) onAir.push(point);
        else if (isOff) offAir.push(point);
      }
    }

    return { onAir, offAir };
  } catch {
    return { onAir: [], offAir: [] };
  }
}

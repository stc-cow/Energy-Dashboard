/**
 * Shared code between client and server for STC COW Energy Dashboard
 */

// Hierarchy filters
export interface HierarchyFilter {
  level: "national" | "region" | "city" | "site";
  regionId?: string | null;
  cityId?: string | null;
  siteId?: string | null;
  district?: string | null;
}

export interface Region {
  id: string;
  name: string;
}

export interface City {
  id: string;
  name: string;
  regionId: string;
}

export interface Site {
  id: string;
  name: string;
  cityId: string;
  lat: number;
  lng: number;
  district?: string;
}

export interface HierarchyResponse {
  regions: Region[];
  cities: City[];
  sites: Site[];
}

// KPI cards
export interface KPIValue {
  label: string;
  value: number;
  unit: string;
  delta?: number; // percent vs previous period, positive = up
}

export interface KPIsResponse {
  asOf: string; // ISO date
  scope: HierarchyFilter;
  kpis: {
    dieselLitersPerDay: KPIValue;
    powerDemandKw: KPIValue;
    co2TonsPerDay: KPIValue;
    fuelTankLevelPct: KPIValue;
    co2ReductionYoYPct: KPIValue;
    energyEfficiencyKwhPerLiter: KPIValue;
    generatorLoadFactorPct: KPIValue;
    runningVsStandbyHours: { runningHours: KPIValue; standbyHours: KPIValue };
  };
  topSites: Array<{
    siteId: string;
    siteName: string;
    dieselLitersPerDay: number;
    co2TonsPerDay: number;
  }>;
  lowFuelWarnings: Array<{
    siteId: string;
    siteName: string;
    fuelTankLevelPct: number;
  }>;
}

// Time series
export interface TimePoint {
  t: string; // ISO date
  dieselLiters: number;
  co2Tons: number;
  efficiencyKwhPerLiter: number;
}

export interface TimeSeriesQuery {
  granularity: "daily" | "monthly" | "yearly";
  from?: string; // ISO
  to?: string; // ISO
}

export interface TimeSeriesResponse {
  scope: HierarchyFilter;
  granularity: TimeSeriesQuery["granularity"];
  series: TimePoint[];
}

// Stacked region/site breakdown
export interface BreakdownPoint {
  key: string; // region or site id
  name: string;
  dieselLiters: number;
  energyKwh: number;
}

export interface BreakdownResponse {
  scope: HierarchyFilter;
  by: "region" | "site";
  data: BreakdownPoint[];
}

// Benchmark scatter
export interface BenchmarkPoint {
  siteId: string;
  siteName: string;
  dieselLiters: number;
  powerKw: number;
  co2Tons: number; // bubble size
}

export interface BenchmarkResponse {
  scope: HierarchyFilter;
  points: BenchmarkPoint[];
}

// Alerts
export interface AlertItem {
  id: string;
  severity: "low" | "medium" | "high";
  kind: "fuel_low" | "co2_spike" | "diesel_spike" | "efficiency_drop";
  message: string;
  siteId?: string;
  createdAt: string;
}

export interface AlertsResponse {
  scope: HierarchyFilter;
  items: AlertItem[];
}

// Example response type for /api/demo remains for compatibility
export interface DemoResponse {
  message: string;
}

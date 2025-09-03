import {
  AlertsResponse,
  BenchmarkResponse,
  BreakdownResponse,
  City,
  HierarchyFilter,
  HierarchyResponse,
  KPIsResponse,
  Region,
  Site,
  TimeSeriesResponse,
} from "@shared/api";

export const regions: Region[] = [
  { id: "riy", name: "Riyadh" },
  { id: "makkah", name: "Makkah" },
  { id: "madinah", name: "Madinah" },
  { id: "eastern", name: "Eastern Province" },
  { id: "asir", name: "Asir" },
];

export const cities: City[] = [
  { id: "riyadh", name: "Riyadh", regionId: "riy" },
  { id: "jeddah", name: "Jeddah", regionId: "makkah" },
  { id: "mecca", name: "Makkah City", regionId: "makkah" },
  { id: "madinah", name: "Madinah", regionId: "madinah" },
  { id: "dammam", name: "Dammam", regionId: "eastern" },
  { id: "abha", name: "Abha", regionId: "asir" },
];

export const sites: Site[] = [
  {
    id: "riy-001",
    name: "Riyadh COW-001",
    cityId: "riyadh",
    lat: 24.7136,
    lng: 46.6753,
    district: "Riyadh",
  },
  {
    id: "riy-002",
    name: "Riyadh COW-002",
    cityId: "riyadh",
    lat: 24.8,
    lng: 46.7,
    district: "Riyadh",
  },
  {
    id: "jed-001",
    name: "Jeddah COW-001",
    cityId: "jeddah",
    lat: 21.4858,
    lng: 39.1925,
    district: "Jeddah",
  },
  {
    id: "mek-001",
    name: "Makkah COW-001",
    cityId: "mecca",
    lat: 21.3891,
    lng: 39.8579,
    district: "Makkah",
  },
  {
    id: "mad-001",
    name: "Madinah COW-001",
    cityId: "madinah",
    lat: 24.5247,
    lng: 39.5692,
    district: "Madinah",
  },
  {
    id: "dam-001",
    name: "Dammam COW-001",
    cityId: "dammam",
    lat: 26.3927,
    lng: 49.9777,
    district: "Dammam",
  },
  {
    id: "abh-001",
    name: "Abha COW-001",
    cityId: "abha",
    lat: 18.2164,
    lng: 42.5053,
    district: "Abha",
  },
];

function seededRandom(seed: number) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function scopeSites(scope: HierarchyFilter): Site[] {
  if (scope.level === "national") return sites;
  if (scope.level === "region") {
    const regionCities = cities.filter((c) => c.regionId === scope.regionId);
    return sites.filter((s) => regionCities.some((c) => c.id === s.cityId));
  }
  if (scope.level === "city") {
    return sites.filter((s) => s.cityId === scope.cityId);
  }
  if (scope.level === "site" && scope.siteId) {
    return sites.filter((s) => s.id === scope.siteId);
  }
  return sites;
}

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0);
}

export function mockKPIs(scope: HierarchyFilter): KPIsResponse {
  const s = scopeSites(scope);
  const seed = s.length * 13;
  const diesel = sum(
    s.map((_, i) => 800 + Math.floor(seededRandom(seed + i) * 1200)),
  );
  const power = sum(
    s.map((_, i) => 300 + Math.floor(seededRandom(seed + i + 20) * 500)),
  );
  const co2 = Math.round(diesel * 2.68) / 1000; // tons/day
  const fuel = Math.round((50 + seededRandom(seed + 33) * 50) * 10) / 10; // %
  const eff = Math.round(((power * 24) / Math.max(1, diesel)) * 100) / 100; // kWh/L
  const load = Math.round((50 + seededRandom(seed + 66) * 50) * 10) / 10; // %
  const runH = Math.round(12 + seededRandom(seed + 77) * 12);
  const stdH = 24 - runH;

  const topSites = s
    .slice(0, Math.min(10, s.length))
    .map((site, i) => {
      const d = 500 + Math.floor(seededRandom(seed + i + 100) * 2000);
      const c = Math.round(d * 2.68) / 1000;
      return {
        siteId: site.id,
        siteName: site.name,
        dieselLitersPerDay: d,
        co2TonsPerDay: c,
      };
    })
    .sort((a, b) => b.dieselLitersPerDay - a.dieselLitersPerDay);

  const lowFuel = s
    .filter((_, i) => seededRandom(seed + i + 200) < 0.25)
    .map((site, i) => ({
      siteId: site.id,
      siteName: site.name,
      fuelTankLevelPct: Math.round(seededRandom(seed + i + 300) * 20 * 10) / 10,
    }));

  return {
    asOf: new Date().toISOString(),
    scope,
    kpis: {
      dieselLitersPerDay: {
        label: "Diesel",
        value: diesel,
        unit: "L/day",
        delta: (seededRandom(seed + 1) - 0.5) * 10,
      },
      powerDemandKw: {
        label: "Power Demand",
        value: power,
        unit: "kW",
        delta: (seededRandom(seed + 2) - 0.5) * 10,
      },
      co2TonsPerDay: {
        label: "CO₂ Emissions",
        value: Math.round(co2 * 100) / 100,
        unit: "t/day",
        delta: (seededRandom(seed + 3) - 0.5) * 10,
      },
      fuelTankLevelPct: {
        label: "Fuel Tank",
        value: fuel,
        unit: "%",
        delta: (seededRandom(seed + 4) - 0.5) * 10,
      },
      co2ReductionYoYPct: {
        label: "CO₂ YoY",
        value: Math.round(seededRandom(seed + 5) * 10 * 10) / 10,
        unit: "%",
        delta: (seededRandom(seed + 6) - 0.5) * 10,
      },
      energyEfficiencyKwhPerLiter: {
        label: "Efficiency",
        value: eff,
        unit: "kWh/L",
        delta: (seededRandom(seed + 7) - 0.5) * 10,
      },
      generatorLoadFactorPct: {
        label: "Load Factor",
        value: load,
        unit: "%",
        delta: (seededRandom(seed + 8) - 0.5) * 10,
      },
      runningVsStandbyHours: {
        runningHours: { label: "Running", value: runH, unit: "h/day" },
        standbyHours: { label: "Standby", value: stdH, unit: "h/day" },
      },
    },
    topSites,
    lowFuelWarnings: lowFuel,
  };
}

export function mockTimeSeries(
  scope: HierarchyFilter,
  granularity: "daily" | "monthly" | "yearly",
): TimeSeriesResponse {
  const now = new Date();
  const points = Array.from({
    length: granularity === "daily" ? 30 : granularity === "monthly" ? 12 : 5,
  }).map((_, idx) => {
    const t = new Date(now);
    if (granularity === "daily") t.setDate(now.getDate() - (29 - idx));
    if (granularity === "monthly") t.setMonth(now.getMonth() - (11 - idx));
    if (granularity === "yearly") t.setFullYear(now.getFullYear() - (4 - idx));
    const base = 1000;
    const diesel =
      base + Math.round(Math.sin(idx / 3) * 200 + Math.random() * 150);
    const co2 = Math.round(diesel * 2.68) / 1000;
    const eff = Math.round(((400 * 24) / Math.max(1, diesel)) * 100) / 100;
    return {
      t: t.toISOString(),
      dieselLiters: diesel,
      co2Tons: co2,
      efficiencyKwhPerLiter: eff,
    };
  });
  return { scope, granularity, series: points };
}

export function mockBenchmark(scope: HierarchyFilter): BenchmarkResponse {
  const s = sites;
  const points = s.map((site, i) => {
    const diesel = 800 + Math.floor(Math.random() * 1800);
    const power = 200 + Math.floor(Math.random() * 800);
    const co2 = Math.round(diesel * 2.68) / 1000;
    return {
      siteId: site.id,
      siteName: site.name,
      dieselLiters: diesel,
      powerKw: power,
      co2Tons: co2,
    };
  });
  return { scope, points };
}

export function mockBreakdown(
  scope: HierarchyFilter,
  by: "region" | "site",
): BreakdownResponse {
  if (by === "region") {
    const data = regions.map((r) => {
      const regionCities = cities.filter((c) => c.regionId === r.id);
      const regionSites = sites.filter((s) =>
        regionCities.some((c) => c.id === s.cityId),
      );
      const diesel = regionSites.reduce(
        (acc) => acc + 700 + Math.floor(Math.random() * 1600),
        0,
      );
      const energy = Math.round(diesel * 0.9);
      return {
        key: r.id,
        name: r.name,
        dieselLiters: diesel,
        energyKwh: energy,
      };
    });
    return { scope, by, data };
  }
  const s = sites.map((site) => ({
    key: site.id,
    name: site.name,
    dieselLiters: 700 + Math.floor(Math.random() * 1800),
    energyKwh: 500 + Math.floor(Math.random() * 2000),
  }));
  return { scope, by, data: s };
}

export function mockAlerts(scope: HierarchyFilter): AlertsResponse {
  const items = sites.slice(0, 3).map((site, i) => ({
    id: `${site.id}-fuel`,
    severity: i % 2 ? "medium" : "high",
    kind: i % 2 ? "co2_spike" : "fuel_low",
    message: `${site.name} ${i % 2 ? "CO₂ emissions spiked" : "fuel tank below 20%"}`,
    siteId: site.id,
    createdAt: new Date(Date.now() - (i + 1) * 3600 * 1000).toISOString(),
  }));
  return { scope, items };
}

export function mockHierarchy(): HierarchyResponse {
  return { regions, cities, sites };
}

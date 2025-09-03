import { DemoResponse } from "@shared/api";

import Layout from "@/components/layout/Layout";
import FilterBar from "@/components/energy/FilterBar";
import KpiCard from "@/components/energy/KpiCard";
import Gauge from "@/components/energy/Gauge";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  fetchAlerts,
  fetchBenchmark,
  fetchHierarchy,
  fetchKPIs,
  fetchTimeSeries,
  fetchAccumulations,
} from "@/lib/api";
import { HierarchyFilter } from "@shared/api";

export default function Index() {
  const [scope, setScope] = useState<HierarchyFilter>({ level: "national" });

  const { data: hierarchy } = useQuery({
    queryKey: ["hierarchy"],
    queryFn: fetchHierarchy,
  });
  const { data: kpis } = useQuery({
    queryKey: ["kpis", scope],
    queryFn: () => fetchKPIs(scope),
    enabled: !!hierarchy,
  });
  const { data: tsDaily } = useQuery({
    queryKey: ["ts", scope, "daily"],
    queryFn: () =>
      fetchTimeSeries(scope, {
        granularity: "daily",
        from: "2025-01-01",
      }),
    enabled: !!hierarchy,
  });

  const accumFuelLiters = useMemo(
    () =>
      (tsDaily?.series ?? []).reduce(
        (sum, p) => sum + (p.dieselLiters || 0),
        0,
      ),
    [tsDaily],
  );
  const { data: accum } = useQuery({
    queryKey: ["accum", scope],
    queryFn: () => fetchAccumulations(scope, "2025-01-01"),
    enabled: !!hierarchy,
  });
  const accumCo2Tons = useMemo(
    () => (tsDaily?.series ?? []).reduce((sum, p) => sum + (p.co2Tons || 0), 0),
    [tsDaily],
  );
  const { data: benchmark } = useQuery({
    queryKey: ["benchmark", scope],
    queryFn: () => fetchBenchmark(scope),
    enabled: !!hierarchy,
  });
  const { data: alerts } = useQuery({
    queryKey: ["alerts", scope],
    queryFn: () => fetchAlerts(scope),
    enabled: !!hierarchy,
  });

  const sites = useMemo(() => hierarchy?.sites ?? [], [hierarchy]);

  return (
    <Layout>
      <div className="mb-6 text-center">
        <h1 className="font-extrabold tracking-tight text-white text-4xl sm:text-5xl lg:text-6xl">
          COW Predictive Energy Dashboard
        </h1>
        <p className="mt-1 text-sm sm:text-base text-white/80 font-bold">
          As of 02/09/2025
        </p>
      </div>

      {hierarchy && (
        <FilterBar
          regions={hierarchy.regions}
          cities={hierarchy.cities}
          sites={hierarchy.sites}
          scope={scope}
          onChange={setScope}
        />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 items-center justify-center">
        <KpiCard
          title="Diesel Consumption"
          value={kpis?.kpis.dieselLitersPerDay.value ?? 0}
          unit={kpis?.kpis.dieselLitersPerDay.unit ?? ""}
        />
        <KpiCard
          title="Power Demand"
          value={kpis?.kpis.powerDemandKw.value ?? 0}
          unit={kpis?.kpis.powerDemandKw.unit ?? ""}
        />
        <KpiCard
          title="Daily CO₂ Emissions"
          value={kpis?.kpis.co2TonsPerDay.value ?? 0}
          unit="TON/day"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-2">
        <Gauge
          value={kpis?.kpis.fuelTankLevelPct.value ?? 0}
          label="Fuel Tank Level"
          metric="fuel"
        />
        <Gauge
          value={kpis?.kpis.generatorLoadFactorPct.value ?? 0}
          label="Average Generator Load"
          metric="power"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard
          title="Accum. Power Consumption"
          value={Math.round((accum?.powerKwh ?? 0) / 1000)}
          unit="MWh"
        />
        <KpiCard
          title="Accum. Fuel Consumption"
          value={Math.round(accumFuelLiters)}
          unit="L"
        />
        <KpiCard title="Accum. CO₂ Emissions" value={accumCo2Tons} unit="TON" />
      </div>
    </Layout>
  );
}

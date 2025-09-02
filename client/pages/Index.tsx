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
    queryFn: () => fetchTimeSeries(scope, { granularity: "daily" }),
    enabled: !!hierarchy,
  });

  const accumFuelLiters = useMemo(
    () => (tsDaily?.series ?? []).reduce((sum, p) => sum + (p.dieselLiters || 0), 0),
    [tsDaily]
  );
  const accumEnergyKwh = useMemo(
    () => (tsDaily?.series ?? []).reduce((sum, p) => sum + (p.dieselLiters || 0) * (p.efficiencyKwhPerLiter || 0), 0),
    [tsDaily]
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
        <h1 className="font-extrabold tracking-tight text-white text-4xl sm:text-5xl lg:text-6xl">COW Predictive ENERGY Dashboard</h1>
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
          title="CO₂ Total Emissions"
          value={kpis?.kpis.co2TonsPerDay.value ?? 0}
          unit={kpis?.kpis.co2TonsPerDay.unit ?? ""}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-2">
        <Gauge value={kpis?.kpis.fuelTankLevelPct.value ?? 0} label="Fuel Tank Level" metric="fuel" />
        <Gauge value={kpis?.kpis.generatorLoadFactorPct.value ?? 0} label="Average Generator Load" metric="power" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <KpiCard title="Accumulative Power Consumption" value={Math.round(accumEnergyKwh)} unit="kWh" />
        <KpiCard title="Accumulative Fuel Consumption" value={Math.round(accumFuelLiters)} unit="L" />
      </div>

    </Layout>
  );
}

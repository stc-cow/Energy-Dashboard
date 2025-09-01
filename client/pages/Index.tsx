import { DemoResponse } from "@shared/api";

import Layout from "@/components/layout/Layout";
import FilterBar from "@/components/energy/FilterBar";
import KpiCard from "@/components/energy/KpiCard";
import Gauge from "@/components/energy/Gauge";
import TimeSeriesChart from "@/components/energy/TimeSeriesChart";
import StackedBar from "@/components/energy/StackedBar";
import ScatterBenchmark from "@/components/energy/ScatterBenchmark";
import MapPanel from "@/components/energy/MapPanel";
import AlertList from "@/components/energy/AlertList";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  fetchAlerts,
  fetchBenchmark,
  fetchBreakdown,
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
  const { data: breakdownRegion } = useQuery({
    queryKey: ["br", scope, "region"],
    queryFn: () => fetchBreakdown(scope, "region"),
    enabled: !!hierarchy,
  });
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
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">STC COW Energy Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Nationwide visibility into diesel usage, CO₂ impact, and efficiency
            across all sites.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          As of {kpis ? new Date(kpis.asOf).toLocaleString() : "—"}
        </div>
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 items-center justify-center">
        <KpiCard
          title="Diesel Consumption"
          value={kpis?.kpis.dieselLitersPerDay.value ?? 0}
          unit={kpis?.kpis.dieselLitersPerDay.unit ?? ""}
          delta={kpis?.kpis.dieselLitersPerDay.delta}
        />
        <KpiCard
          title="Power Demand"
          value={kpis?.kpis.powerDemandKw.value ?? 0}
          unit={kpis?.kpis.powerDemandKw.unit ?? ""}
          delta={kpis?.kpis.powerDemandKw.delta}
        />
        <KpiCard
          title="CO₂ Emissions"
          value={kpis?.kpis.co2TonsPerDay.value ?? 0}
          unit={kpis?.kpis.co2TonsPerDay.unit ?? ""}
          delta={kpis?.kpis.co2TonsPerDay.delta}
        />
        <KpiCard
          title="Efficiency"
          value={kpis?.kpis.energyEfficiencyKwhPerLiter.value ?? 0}
          unit={kpis?.kpis.energyEfficiencyKwhPerLiter.unit ?? ""}
          delta={kpis?.kpis.energyEfficiencyKwhPerLiter.delta}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TimeSeriesChart data={tsDaily?.series ?? []} />
        </div>
        <div className="grid grid-cols-1 gap-4">
          <Gauge
            value={kpis?.kpis.fuelTankLevelPct.value ?? 0}
            label="Fuel Tank Level"
            metric="fuel"
          />
          <Gauge
            value={kpis?.kpis.generatorLoadFactorPct.value ?? 0}
            label="Generator Load"
            metric="power"
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <StackedBar
          data={breakdownRegion?.data ?? []}
          title="Regional Diesel vs Energy"
        />
        <ScatterBenchmark data={benchmark?.points ?? []} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MapPanel sites={sites} />
        </div>
        <div>
          <AlertList items={alerts?.items ?? []} />
        </div>
      </div>
    </Layout>
  );
}

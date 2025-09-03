import { DemoResponse } from "@shared/api";

import Layout from "@/components/layout/Layout";
import FilterBar from "@/components/energy/FilterBar";
import KpiCard from "@/components/energy/KpiCard";
import Gauge from "@/components/energy/Gauge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import {
  fetchAlerts,
  fetchBenchmark,
  fetchHierarchy,
  fetchKPIs,
  fetchTimeSeries,
  fetchAccumulations,
  clearSheetCache,
} from "@/lib/api";
import { HierarchyFilter } from "@shared/api";

export default function Index() {
  const [scope, setScope] = useState<HierarchyFilter>({ level: "national" });
  const queryClient = useQueryClient();
  const [asOfTick, setAsOfTick] = useState(0);
  const asOf = useMemo(() => {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const HH = String(d.getHours()).padStart(2, "0");
    const MM = String(d.getMinutes()).padStart(2, "0");
    const SS = String(d.getSeconds()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} ${HH}:${MM}:${SS}`;
  }, [asOfTick]);

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

  const { data: accum } = useQuery({
    queryKey: ["accum", scope],
    queryFn: () => fetchAccumulations(scope),
    enabled: !!hierarchy,
  });
  const accumFuelLiters = useMemo(() => accum?.fuelLiters ?? 0, [accum]);
  const accumCo2Tons = useMemo(() => accum?.co2Tons ?? 0, [accum]);
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
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              clearSheetCache();
              queryClient.invalidateQueries({ queryKey: ["hierarchy"] });
              queryClient.invalidateQueries({ queryKey: ["kpis"] });
              queryClient.invalidateQueries({ queryKey: ["ts"] });
              queryClient.invalidateQueries({ queryKey: ["accum"] });
              queryClient.invalidateQueries({ queryKey: ["benchmark"] });
              queryClient.invalidateQueries({ queryKey: ["alerts"] });
              setAsOfTick((t) => t + 1);
            }}
            aria-label="Refresh data"
          >
            <RotateCcw className="h-4 w-4" />
            Refresh
          </Button>
          <h1 className="font-extrabold tracking-tight text-white text-4xl sm:text-5xl lg:text-6xl">
            COW Predictive Energy Dashboard
          </h1>
        </div>
        <p className="mt-1 text-sm sm:text-base text-white/80 font-bold">
          As of {asOf}
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

import Layout from "@/components/layout/Layout";
import FilterBar from "@/components/energy/FilterBar";
import KpiCard from "@/components/energy/KpiCard";
import Gauge from "@/components/energy/Gauge";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchAlerts,
  fetchBenchmark,
  fetchHierarchy,
  fetchKPIs,
  fetchTimeSeries,
  fetchAccumulations,
  fetchCowStats,
  fetchPowerSourceCounts,
} from "@/lib/api";
import { HierarchyFilter } from "@shared/api";
import { Button } from "@/components/ui/button";
import FitToScreen from "@/components/layout/FitToScreen";

export default function Index() {
  const navigate = useNavigate();
  const [scope, setScope] = useState<HierarchyFilter>({ level: "national" });
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    // align first tick to the start of next minute, then tick every minute
    const now = new Date();
    const msToNextMinute =
      (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    const timeoutId = setTimeout(
      () => {
        setNow(new Date());
        const id = setInterval(() => setNow(new Date()), 60_000);
        (window as any).__asof_interval = id;
      },
      Math.max(0, msToNextMinute),
    );
    return () => {
      clearTimeout(timeoutId);
      if ((window as any).__asof_interval)
        clearInterval((window as any).__asof_interval);
    };
  }, []);
  const asOf = useMemo(() => {
    const d = now;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const HH = String(d.getHours()).padStart(2, "0");
    const MM = String(d.getMinutes()).padStart(2, "0");
    const SS = String(d.getSeconds()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} ${HH}:${MM}:${SS}`;
  }, [now]);

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

  const { data: cow } = useQuery({
    queryKey: ["cowstats", scope],
    queryFn: () => fetchCowStats(scope),
    enabled: !!hierarchy,
    refetchInterval: 600000, // 10 minutes
    refetchIntervalInBackground: true,
  });

  const sites = useMemo(() => hierarchy?.sites ?? [], [hierarchy]);

  const { data: powerSources } = useQuery({
    queryKey: ["powerSources", scope],
    queryFn: () => fetchPowerSourceCounts(scope),
    enabled: !!hierarchy,
  });

  return (
    <Layout>
      <FitToScreen bottomOffset={16}>
        <div className="mb-4">
          <p className="text-sm sm:text-base text-white/80 font-bold text-left">
            As of {asOf}
          </p>
        </div>

        {/* Status ticker */}
        <div
          className="ticker-wrap top-bar print:hidden"
          aria-label="COW status ticker"
        >
          <div className="ticker">
            {(() => {
              const map = new Map<string, number>();
              for (const s of cow?.byStatus ?? []) map.set(s.status, s.count);
              const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
              const entries = Array.from(map.entries()).sort(
                (a, b) => b[1] - a[1],
              );
              const text = [
                `Total COWs: ${total}`,
                ...entries.map(([k, v]) => `${k}: ${v}`),
              ].join("   |   ");
              return (
                <>
                  <span className="ticker__item">{text}</span>
                  <span className="ticker__item" aria-hidden>
                    {text}
                  </span>
                </>
              );
            })()}
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

        {/* COWs Status card */}
        <div className="mt-4 grid grid-cols-1">
          <div
            className="rounded-xl border border-white/20 bg-card shadow-none flex flex-col"
            style={{ padding: "32px 32px 20px", marginBottom: 20 }}
          >
            <div className="text-lg lg:text-xl tracking-wider text-white/90 font-bold mb-3">
              <p>
                <strong>Regional breakdown</strong>
              </p>
            </div>
            <div className="grid grid-cols-1 items-start">
              <div
                className="rounded-lg p-4"
                style={{ backgroundColor: "rgba(12, 12, 56, 0.4)" }}
              >
                <div className="text-sm text-white/80">
                  {(() => {
                    const items = cow?.byRegion ?? [];
                    const total =
                      items.reduce((s, x) => s + (x.count || 0), 0) || 1;
                    return (
                      <div className="flex items-stretch gap-3">
                        {items.map((r) => {
                          const count = r.count || 0;
                          const pct = Math.round((count / total) * 100);
                          return (
                            <div
                              key={r.regionId}
                              className="relative h-10 rounded-md overflow-hidden border border-white/10 bg-white/10"
                              style={{ flex: count || 0.0001 }}
                              aria-label={`${r.regionName || "Unknown"} ${count} (${pct}%)`}
                            >
                              <div
                                className="absolute inset-0"
                                style={{
                                  backgroundImage:
                                    "linear-gradient(to right, rgba(180,120,230,0.9), rgba(120,80,200,0.9))",
                                }}
                              />
                              <div className="absolute inset-0 flex items-center justify-center text-white font-semibold px-2 whitespace-nowrap gap-1">
                                <p>
                                  <strong>
                                    {(r.regionName || "Unknown").toUpperCase()}
                                  </strong>
                                </p>
                                <p>
                                  <strong>
                                    {count.toLocaleString?.() ?? count}
                                  </strong>
                                </p>
                                (
                                <p>
                                  <strong>{pct}</strong>
                                </p>
                                %)
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <KpiCard
            title="Diesel Consumption"
            value={kpis?.kpis.dieselLitersPerDay.value ?? 0}
            unit={kpis?.kpis.dieselLitersPerDay.unit ?? ""}
            footer={`Total of all Generators Connected sites: ${powerSources?.generatorConnected ?? 0}`}
          />
          <KpiCard
            title="Elec. Power Consumption"
            value={kpis?.kpis.powerDemandKw.value ?? 0}
            unit="kW"
            footer={`Total of all SEC Connected sites: ${powerSources?.secConnected ?? 0}`}
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
            height={258}
          />
          <Gauge
            value={kpis?.kpis.generatorLoadFactorPct.value ?? 0}
            label="Average Generator Load"
            metric="power"
            height={257}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <KpiCard
            title="Accum. Power Consumption"
            value={Math.round((accum?.powerKwh ?? 0) / 1000)}
            unit="MWh"
            footer="from 01/01/2025 uP TO NOW"
          />
          <KpiCard
            title="Accum. Fuel Consumption"
            value={Math.round(accumFuelLiters)}
            unit="L"
            footer="from 01/01/2025 uP TO NOW"
          />
          <KpiCard
            title="Accum. CO₂ Emissions"
            value={Number(accumCo2Tons.toFixed(2))}
            unit="TON"
            footer="from 01/01/2025 uP TO NOW"
          />
        </div>

        <div className="grid grid-cols-2 gap-6 mt-6">
          <div
            onClick={() => navigate("/heatmap")}
            className="cursor-pointer bg-purple-800 hover:bg-purple-700 rounded-2xl p-6 text-center shadow-lg transition"
          >
            <h3 className="text-white text-xl font-semibold">COW Distribution Map</h3>
            <p className="text-purple-200 text-sm mt-2">View site distribution and status heatmap</p>
          </div>

          <div
            onClick={() => navigate("/trends")}
            className="cursor-pointer bg-purple-800 hover:bg-purple-700 rounded-2xl p-6 text-center shadow-lg transition"
          >
            <h3 className="text-white text-xl font-semibold">Energy Trends</h3>
            <p className="text-purple-200 text-sm mt-2">Analyze accumulative fuel, power, CO₂, and generator load trends</p>
          </div>
        </div>
      </FitToScreen>
    </Layout>
  );
}

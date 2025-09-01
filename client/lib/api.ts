import { AlertsResponse, BenchmarkResponse, BreakdownResponse, HierarchyFilter, HierarchyResponse, KPIsResponse, TimeSeriesQuery, TimeSeriesResponse } from "@shared/api";

function toQuery(params: Record<string, any>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function fetchHierarchy(): Promise<HierarchyResponse> {
  const res = await fetch("/api/hierarchy");
  if (!res.ok) throw new Error("Failed to load hierarchy");
  return res.json();
}

export async function fetchKPIs(scope: HierarchyFilter): Promise<KPIsResponse> {
  const res = await fetch(`/api/kpis${toQuery(scope)}`);
  if (!res.ok) throw new Error("Failed to load KPIs");
  return res.json();
}

export async function fetchTimeSeries(scope: HierarchyFilter, q: TimeSeriesQuery): Promise<TimeSeriesResponse> {
  const res = await fetch(`/api/timeseries${toQuery({ ...scope, ...q })}`);
  if (!res.ok) throw new Error("Failed to load time series");
  return res.json();
}

export async function fetchBreakdown(scope: HierarchyFilter, by: "region" | "site"): Promise<BreakdownResponse> {
  const res = await fetch(`/api/breakdown/${by}${toQuery(scope)}`);
  if (!res.ok) throw new Error("Failed to load breakdown");
  return res.json();
}

export async function fetchBenchmark(scope: HierarchyFilter): Promise<BenchmarkResponse> {
  const res = await fetch(`/api/benchmark${toQuery(scope)}`);
  if (!res.ok) throw new Error("Failed to load benchmark");
  return res.json();
}

export async function fetchAlerts(scope: HierarchyFilter): Promise<AlertsResponse> {
  const res = await fetch(`/api/alerts${toQuery(scope)}`);
  if (!res.ok) throw new Error("Failed to load alerts");
  return res.json();
}

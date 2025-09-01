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

import { mockAlerts, mockBenchmark, mockBreakdown, mockHierarchy, mockKPIs, mockTimeSeries } from "./mocks";

const isStatic = typeof window !== "undefined" && (window.location.hostname.includes("github.io") || window.location.protocol === "file:");

export async function fetchHierarchy(): Promise<HierarchyResponse> {
  if (isStatic) return mockHierarchy();
  try {
    const res = await fetch("/api/hierarchy");
    if (!res.ok) throw new Error();
    return res.json();
  } catch {
    return mockHierarchy();
  }
}

export async function fetchKPIs(scope: HierarchyFilter): Promise<KPIsResponse> {
  if (isStatic) return mockKPIs(scope);
  try {
    const res = await fetch(`/api/kpis${toQuery(scope)}`);
    if (!res.ok) throw new Error();
    return res.json();
  } catch {
    return mockKPIs(scope);
  }
}

export async function fetchTimeSeries(scope: HierarchyFilter, q: TimeSeriesQuery): Promise<TimeSeriesResponse> {
  if (isStatic) return mockTimeSeries(scope, q.granularity);
  try {
    const res = await fetch(`/api/timeseries${toQuery({ ...scope, ...q })}`);
    if (!res.ok) throw new Error();
    return res.json();
  } catch {
    return mockTimeSeries(scope, q.granularity);
  }
}

export async function fetchBreakdown(scope: HierarchyFilter, by: "region" | "site"): Promise<BreakdownResponse> {
  if (isStatic) return mockBreakdown(scope, by);
  try {
    const res = await fetch(`/api/breakdown/${by}${toQuery(scope)}`);
    if (!res.ok) throw new Error();
    return res.json();
  } catch {
    return mockBreakdown(scope, by);
  }
}

export async function fetchBenchmark(scope: HierarchyFilter): Promise<BenchmarkResponse> {
  if (isStatic) return mockBenchmark(scope);
  try {
    const res = await fetch(`/api/benchmark${toQuery(scope)}`);
    if (!res.ok) throw new Error();
    return res.json();
  } catch {
    return mockBenchmark(scope);
  }
}

export async function fetchAlerts(scope: HierarchyFilter): Promise<AlertsResponse> {
  if (isStatic) return mockAlerts(scope);
  try {
    const res = await fetch(`/api/alerts${toQuery(scope)}`);
    if (!res.ok) throw new Error();
    return res.json();
  } catch {
    return mockAlerts(scope);
  }
}

import { RequestHandler } from "express";
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
  cities,
  regions,
  sites,
  mockAlerts,
  mockBenchmark,
  mockBreakdown,
  mockKPIs,
  mockTimeSeries,
} from "./data";

function parseScope(query: any): HierarchyFilter {
  const level = (query.level as string) || "national";
  const scope: HierarchyFilter = { level: level as any };
  if (query.regionId) scope.regionId = String(query.regionId);
  if (query.cityId) scope.cityId = String(query.cityId);
  if (query.siteId) scope.siteId = String(query.siteId);
  return scope;
}

export const getHierarchy: RequestHandler = (_req, res) => {
  const response: HierarchyResponse = { regions, cities, sites };
  res.json(response);
};

export const getKPIs: RequestHandler = (req, res) => {
  const scope = parseScope(req.query);
  const response: KPIsResponse = mockKPIs(scope);
  res.json(response);
};

export const getTimeSeries: RequestHandler = (req, res) => {
  const scope = parseScope(req.query);
  const granularity = (req.query.granularity as string) ?? "daily";
  const response: TimeSeriesResponse = mockTimeSeries(
    scope,
    granularity as any,
  );
  res.json(response);
};

export const getBreakdownByRegion: RequestHandler = (req, res) => {
  const scope = parseScope(req.query);
  const response: BreakdownResponse = mockBreakdown(scope, "region");
  res.json(response);
};

export const getBreakdownBySite: RequestHandler = (req, res) => {
  const scope = parseScope(req.query);
  const response: BreakdownResponse = mockBreakdown(scope, "site");
  res.json(response);
};

export const getBenchmark: RequestHandler = (req, res) => {
  const scope = parseScope(req.query);
  const response: BenchmarkResponse = mockBenchmark(scope);
  res.json(response);
};

export const getAlerts: RequestHandler = (req, res) => {
  const scope = parseScope(req.query);
  const response: AlertsResponse = mockAlerts(scope);
  res.json(response);
};

// Appended helpers for COW status heatmap
import { HierarchyFilter } from "@shared/api";
import { getCowStatus } from "./api";

export async function fetchCowStatusGeoPoints(
  scope: HierarchyFilter = { level: "national" },
): Promise<{
  onAir: Array<{ lat: number; lng: number; value: number }>;
  offAir: Array<{ lat: number; lng: number; value: number }>;
}> {
  // This file is a placeholder shim; real implementation is in api.ts merged by build
  return { onAir: [], offAir: [] };
}

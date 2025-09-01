import { City, HierarchyFilter, Region, Site } from "@shared/api";

interface Props {
  regions: Region[];
  cities: City[];
  sites: Site[];
  scope: HierarchyFilter;
  onChange: (s: HierarchyFilter) => void;
}

export default function FilterBar({ regions, cities, sites, scope, onChange }: Props) {
  const selectedCities = scope.regionId ? cities.filter(c => c.regionId === scope.regionId) : cities;
  const selectedSites = scope.cityId ? sites.filter(s => s.cityId === scope.cityId) : sites;

  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Level</label>
        <select
          className="w-full rounded-md border bg-background px-3 py-2"
          value={scope.level}
          onChange={(e) => {
            const level = e.target.value as HierarchyFilter["level"];
            const next: HierarchyFilter = { level };
            if (level === "region" && scope.regionId) next.regionId = scope.regionId;
            if (level === "city" && scope.cityId) next.cityId = scope.cityId;
            if (level === "site" && scope.siteId) next.siteId = scope.siteId;
            onChange(next);
          }}
        >
          <option value="national">National</option>
          <option value="region">Region</option>
          <option value="city">City</option>
          <option value="site">Site</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Region</label>
        <select
          className="w-full rounded-md border bg-background px-3 py-2"
          value={scope.regionId ?? ""}
          onChange={(e) => onChange({ level: scope.level === "national" ? "region" : scope.level, regionId: e.target.value || undefined })}
        >
          <option value="">All Regions</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-muted-foreground">City</label>
        <select
          className="w-full rounded-md border bg-background px-3 py-2"
          value={scope.cityId ?? ""}
          onChange={(e) => onChange({ level: scope.level === "national" ? "city" : scope.level, regionId: scope.regionId, cityId: e.target.value || undefined })}
        >
          <option value="">All Cities</option>
          {selectedCities.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Site</label>
        <select
          className="w-full rounded-md border bg-background px-3 py-2"
          value={scope.siteId ?? ""}
          onChange={(e) => onChange({ level: "site", regionId: scope.regionId, cityId: scope.cityId, siteId: e.target.value || undefined })}
        >
          <option value="">All Sites</option>
          {selectedSites.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

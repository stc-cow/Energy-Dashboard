import { useMemo, useState } from "react";
import { City, HierarchyFilter, Region, Site } from "@shared/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  regions: Region[];
  cities: City[];
  sites: Site[];
  scope: HierarchyFilter;
  onChange: (s: HierarchyFilter) => void;
}

function FilterBar({ regions, cities, sites, scope, onChange }: Props) {
  const [regionQuery, setRegionQuery] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  // District stored in scope to affect dataset queries
  const [siteQuery, setSiteQuery] = useState("");

  const filteredRegions = useMemo(() => {
    const q = regionQuery.toLowerCase();
    return regions.filter((r) => r.name.toLowerCase().includes(q));
  }, [regions, regionQuery]);

  const citiesByRegion = useMemo(() => {
    return cities.filter((c) => (scope.regionId ? c.regionId === scope.regionId : true));
  }, [cities, scope.regionId]);

  const cityIdToRegion = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of cities) m.set(c.id, c.regionId);
    return m;
  }, [cities]);

  const sitesInScope = useMemo(() => {
    if (scope.cityId) return sites.filter((s) => s.cityId === scope.cityId);
    if (scope.regionId)
      return sites.filter((s) => cityIdToRegion.get(s.cityId) === scope.regionId);
    return sites;
  }, [sites, scope.cityId, scope.regionId, cityIdToRegion]);

  const derivedDistricts = useMemo(() => {
    const set = new Set<string>();
    for (const s of sitesInScope) {
      const d = (s as any).district as string | undefined;
      if (d && d.trim().length > 0) set.add(d.trim());
    }
    return Array.from(set).sort();
  }, [sitesInScope]);

  const filteredCities = useMemo(() => {
    const q = cityQuery.toLowerCase();
    const base = citiesByRegion.filter((c) => c.name.toLowerCase().includes(q));
    if (!scope.district) return base;
    const regionSites = scope.regionId
      ? sites.filter((s) => cityIdToRegion.get(s.cityId) === scope.regionId)
      : sites;
    const allowed = new Set(
      regionSites.filter((s) => (s as any).district === scope.district).map((s) => s.cityId),
    );
    return base.filter((c) => allowed.has(c.id));
  }, [citiesByRegion, cityQuery, scope.district, sites, scope.regionId, cityIdToRegion]);

  const filteredSites = useMemo(() => {
    const q = siteQuery.toLowerCase();
    return sitesInScope.filter((s) => {
      const matchesText = s.name.toLowerCase().includes(q);
      const matchesDistrict = scope.district ? (s as any).district === scope.district : true;
      return matchesText && matchesDistrict;
    });
  }, [sitesInScope, siteQuery, scope.district]);

  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* Region */}
      <div className="order-1">
        <label className="mb-1 block text-xs text-muted-foreground">Region</label>
        <Select
          value={scope.regionId ?? ""}
          onValueChange={(val) => {
            setRegionQuery("");
            setCityQuery("");
            setDistrict("");
            setSiteQuery("");
            onChange({ level: "region", regionId: val === "__ALL__" ? undefined : val });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Regions" />
          </SelectTrigger>
          <SelectContent>
            <input
              placeholder="Search Region"
              className="mb-1 w-full rounded-md border bg-background px-2 py-1 text-sm"
              value={regionQuery}
              onChange={(e) => setRegionQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            />
            <SelectItem value="__ALL__">All Regions</SelectItem>
            {filteredRegions.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* District */}
      <div className="order-2">
        <label className="mb-1 block text-xs text-muted-foreground">District</label>
        <Select
          value={scope.district ?? ""}
          onValueChange={(val) => onChange({ ...scope, district: val === "__ALL__" ? undefined : val })}
          disabled={!scope.regionId}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Districts" />
          </SelectTrigger>
          <SelectContent>
            <input
              placeholder="Search District"
              className="mb-1 w-full rounded-md border bg-background px-2 py-1 text-sm"
              value={scope.district ?? ""}
              onChange={(e) => onChange({ ...scope, district: e.target.value || undefined })}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            />
            <SelectItem value="__ALL__">All Districts</SelectItem>
            {derivedDistricts
              .filter((d) => d.toLowerCase().includes((scope.district ?? "").toLowerCase()))
              .map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* City */}
      <div className="order-3">
        <label className="mb-1 block text-xs text-muted-foreground">City</label>
        <Select
          value={scope.cityId ?? ""}
          onValueChange={(val) => {
            setCityQuery("");
            setSiteQuery("");
            onChange({ level: "city", regionId: scope.regionId, cityId: val === "__ALL__" ? undefined : val });
          }}
          disabled={!scope.regionId}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Cities" />
          </SelectTrigger>
          <SelectContent>
            <input
              placeholder="Search City"
              className="mb-1 w-full rounded-md border bg-background px-2 py-1 text-sm"
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            />
            <SelectItem value="__ALL__">All Cities</SelectItem>
            {filteredCities.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Site */}
      <div className="order-4">
        <label className="mb-1 block text-xs text-muted-foreground">Site</label>
        <Select
          value={scope.siteId ?? ""}
          onValueChange={(val) =>
            onChange({ level: "site", regionId: scope.regionId, cityId: scope.cityId, siteId: val === "__ALL__" ? undefined : val })
          }
          disabled={!scope.regionId}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Sites" />
          </SelectTrigger>
          <SelectContent>
            <input
              placeholder="Search Site"
              className="mb-1 w-full rounded-md border bg-background px-2 py-1 text-sm"
              value={siteQuery}
              onChange={(e) => setSiteQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            />
            <SelectItem value="__ALL__">All Sites</SelectItem>
            {filteredSites.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export default FilterBar;

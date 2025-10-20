import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { City, HierarchyFilter, Region, Site } from "@shared/api";

export default function FilterBar({
  regions,
  cities,
  sites,
  scope,
  onChange,
}: {
  regions: Region[];
  cities: City[];
  sites: Site[];
  scope: HierarchyFilter;
  onChange: (s: HierarchyFilter) => void;
}) {
  const [regionQuery, setRegionQuery] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [districtQuery, setDistrictQuery] = useState("");
  const [siteQuery, setSiteQuery] = useState("");

  const districts = useMemo(() => {
    const set = new Set<string>();
    const byRegion = sites.filter((s) => {
      if (!scope.regionId) return true;
      const city = cities.find((c) => c.id === s.cityId);
      return city?.regionId === scope.regionId;
    });
    for (const s of byRegion) {
      if (s.district && s.district.trim()) set.add(s.district.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [sites, cities, scope.regionId]);

  const filteredRegions = useMemo(() => {
    const q = regionQuery.trim().toLowerCase();
    return regions
      .filter((r) => (!q ? true : r.name.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [regions, regionQuery]);

  const filteredCities = useMemo(() => {
    const q = cityQuery.trim().toLowerCase();
    return cities
      .filter(
        (c) =>
          (!scope.regionId ? true : c.regionId === scope.regionId) &&
          (!q ? true : c.name.toLowerCase().includes(q)) &&
          (!scope.district
            ? true
            : sites.some(
                (s) => s.cityId === c.id && s.district === scope.district,
              )),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [cities, cityQuery, scope.regionId, scope.district, sites]);

  const filteredSites = useMemo(() => {
    const q = siteQuery.trim().toLowerCase();
    return sites
      .filter(
        (s) =>
          (!scope.regionId
            ? true
            : cities.find((c) => c.id === s.cityId)?.regionId ===
              scope.regionId) &&
          (!scope.cityId ? true : s.cityId === scope.cityId) &&
          (!scope.district ? true : s.district === scope.district) &&
          (!q ? true : s.name.toLowerCase().includes(q)),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sites, cities, scope.regionId, scope.cityId, scope.district, siteQuery]);

  function setScope(partial: Partial<HierarchyFilter>) {
    const next: HierarchyFilter = { ...scope, ...partial } as HierarchyFilter;
    // Normalize level based on specificity
    if (next.siteId) next.level = "site";
    else if (next.cityId) next.level = "city";
    else if (next.regionId) next.level = "region";
    else next.level = "national";
    onChange(next);
  }

  return (
    <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {/* Region */}
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">
          Region
        </label>
        <Select
          value={scope.regionId ?? ""}
          onValueChange={(val) =>
            setScope({
              regionId: val === "__ALL__" ? undefined : val,
              // reset deeper filters when region changes
              cityId: undefined,
              district: undefined,
              siteId: undefined,
            })
          }
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
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">
          District
        </label>
        <Select
          value={scope.district ?? ""}
          onValueChange={(val) =>
            setScope({
              district: val === "__ALL__" ? undefined : val,
              // reset site when district changes to avoid stale selection
              siteId: undefined,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="All Districts" />
          </SelectTrigger>
          <SelectContent>
            <input
              placeholder="Search District"
              className="mb-1 w-full rounded-md border bg-background px-2 py-1 text-sm"
              value={districtQuery}
              onChange={(e) => setDistrictQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            />
            <SelectItem value="__ALL__">All Districts</SelectItem>
            {districts
              .filter((d) =>
                districtQuery
                  ? d.toLowerCase().includes(districtQuery.toLowerCase())
                  : true,
              )
              .map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* City */}
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">City</label>
        <Select
          value={scope.cityId ?? ""}
          onValueChange={(val) =>
            setScope({
              cityId: val === "__ALL__" ? undefined : val,
              // clear site when city changes
              siteId: undefined,
            })
          }
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
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Site</label>
        <Select
          value={scope.siteId ?? ""}
          onValueChange={(val) =>
            setScope({ siteId: val === "__ALL__" ? undefined : val })
          }
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

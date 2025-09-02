import { useMemo, useState } from "react";
import { City, HierarchyFilter, Region, Site } from "@shared/api";

interface Props {
  regions: Region[];
  cities: City[];
  sites: Site[];
  scope: HierarchyFilter;
  onChange: (s: HierarchyFilter) => void;
}

export default function FilterBar({
  regions,
  cities,
  sites,
  scope,
  onChange,
}: Props) {
  const [regionQuery, setRegionQuery] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [districtQuery, setDistrictQuery] = useState("");
  const [siteQuery, setSiteQuery] = useState("");

  const filteredRegions = useMemo(() => {
    const q = regionQuery.toLowerCase();
    return regions.filter((r) => r.name.toLowerCase().includes(q));
  }, [regions, regionQuery]);

  const selectedCities = useMemo(() => {
    const base = scope.regionId ? cities.filter((c) => c.regionId === scope.regionId) : cities;
    const q = cityQuery.toLowerCase();
    return base.filter((c) => c.name.toLowerCase().includes(q));
  }, [cities, scope.regionId, cityQuery]);

  const selectedSites = useMemo(() => {
    const base = scope.cityId ? sites.filter((s) => s.cityId === scope.cityId) : sites;
    const qSite = siteQuery.toLowerCase();
    const qDistrict = districtQuery.toLowerCase();
    // District query further narrows sites by name (placeholder until district data exists)
    return base.filter(
      (s) => s.name.toLowerCase().includes(qSite) && s.name.toLowerCase().includes(qDistrict)
    );
  }, [sites, scope.cityId, siteQuery, districtQuery]);

  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Region</label>
        <input
          className="mb-2 w-full rounded-md border bg-background px-3 py-2"
          placeholder="Search Region"
          value={regionQuery}
          onChange={(e) => setRegionQuery(e.target.value)}
        />
        <select
          className="w-full rounded-md border bg-background px-3 py-2"
          value={scope.regionId ?? ""}
          onChange={(e) =>
            onChange({
              level: "region",
              regionId: e.target.value || undefined,
            })
          }
        >
          <option value="">All Regions</option>
          {filteredRegions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-muted-foreground">City</label>
        <input
          className="mb-2 w-full rounded-md border bg-background px-3 py-2"
          placeholder="Search City"
          value={cityQuery}
          onChange={(e) => setCityQuery(e.target.value)}
        />
        <select
          className="w-full rounded-md border bg-background px-3 py-2"
          value={scope.cityId ?? ""}
          onChange={(e) =>
            onChange({
              level: "city",
              regionId: scope.regionId,
              cityId: e.target.value || undefined,
            })
          }
        >
          <option value="">All Cities</option>
          {selectedCities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-muted-foreground">District</label>
        <input
          className="w-full rounded-md border bg-background px-3 py-2"
          placeholder="Search District"
          value={districtQuery}
          onChange={(e) => setDistrictQuery(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Site</label>
        <input
          className="mb-2 w-full rounded-md border bg-background px-3 py-2"
          placeholder="Search Site"
          value={siteQuery}
          onChange={(e) => setSiteQuery(e.target.value)}
        />
        <select
          className="w-full rounded-md border bg-background px-3 py-2"
          value={scope.siteId ?? ""}
          onChange={(e) =>
            onChange({
              level: "site",
              regionId: scope.regionId,
              cityId: scope.cityId,
              siteId: e.target.value || undefined,
            })
          }
        >
          <option value="">All Sites</option>
          {selectedSites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

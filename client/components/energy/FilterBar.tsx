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

export default function FilterBar({
  regions,
  cities,
  sites,
  scope,
  onChange,
}: Props) {
  const [regionQuery, setRegionQuery] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [district, setDistrict] = useState("");
  const [siteQuery, setSiteQuery] = useState("");

  const filteredRegions = useMemo(() => {
    const q = regionQuery.toLowerCase();
    return regions.filter((r) => r.name.toLowerCase().includes(q));
  }, [regions, regionQuery]);

  const citiesByRegion = useMemo(() => {
    return cities.filter((c) =>
      scope.regionId ? c.regionId === scope.regionId : true,
    );
  }, [cities, scope.regionId]);

  const filteredCities = useMemo(() => {
    const q = cityQuery.toLowerCase();
    return citiesByRegion.filter((c) => c.name.toLowerCase().includes(q));
  }, [citiesByRegion, cityQuery]);

  const sitesByCity = useMemo(() => {
    return sites.filter((s) =>
      scope.cityId ? s.cityId === scope.cityId : true,
    );
  }, [sites, scope.cityId]);

  const derivedDistricts = useMemo(() => {
    const set = new Set<string>();
    for (const s of sitesByCity) {
      const token = (s.name.split(/[-,]/)[0] || s.name).trim();
      if (token.length > 1) set.add(token);
    }
    return Array.from(set).sort();
  }, [sitesByCity]);

  const filteredSites = useMemo(() => {
    const q = siteQuery.toLowerCase();
    return sitesByCity.filter((s) => {
      const matchesText = s.name.toLowerCase().includes(q);
      const matchesDistrict = district ? s.name.startsWith(district) : true;
      return matchesText && matchesDistrict;
    });
  }, [sitesByCity, siteQuery, district]);

  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* Region */}
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">
          Region
        </label>
        <Select
          value={scope.regionId ?? ""}
          onValueChange={(val) => {
            setRegionQuery("");
            setCityQuery("");
            setDistrict("");
            setSiteQuery("");
            onChange({
              level: "region",
              regionId: val === "__ALL__" ? undefined : val,
            });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Regions" />
          </SelectTrigger>
          <SelectContent>
            <input
              placeholder="Search Region"
              autoFocus
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

      {/* City */}
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">City</label>
        <Select
          value={scope.cityId ?? ""}
          onValueChange={(val) => {
            setCityQuery("");
            setDistrict("");
            setSiteQuery("");
            onChange({
              level: "city",
              regionId: scope.regionId,
              cityId: val === "__ALL__" ? undefined : val,
            });
          }}
          disabled={!scope.regionId}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Cities" />
          </SelectTrigger>
          <SelectContent>
            <input
              placeholder="Search City"
              autoFocus
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

      {/* District */}
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">
          District
        </label>
        <Select
          value={district}
          onValueChange={(val) => setDistrict(val === "__ALL__" ? "" : val)}
          disabled={!scope.cityId}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Districts" />
          </SelectTrigger>
          <SelectContent>
            <input
              placeholder="Search District"
              autoFocus
              className="mb-1 w-full rounded-md border bg-background px-2 py-1 text-sm"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            />
            <SelectItem value="__ALL__">All Districts</SelectItem>
            {derivedDistricts
              .filter((d) => d.toLowerCase().includes(district.toLowerCase()))
              .map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
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
            onChange({
              level: "site",
              regionId: scope.regionId,
              cityId: scope.cityId,
              siteId: val === "__ALL__" ? undefined : val,
            })
          }
          disabled={!scope.cityId}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Sites" />
          </SelectTrigger>
          <SelectContent>
            <input
              placeholder="Search Site"
              autoFocus
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

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
  const [districtQuery, setDistrictQuery] = useState("");
  const [siteQuery, setSiteQuery] = useState("");

  // Regions (independent)
  const filteredRegions = useMemo(() => {
    const q = regionQuery.toLowerCase();
    return regions.filter((r) => r.name.toLowerCase().includes(q));
  }, [regions, regionQuery]);

  // Cities (independent)
  const filteredCities = useMemo(() => {
    const q = cityQuery.toLowerCase();
    return cities.filter((c) => c.name.toLowerCase().includes(q));
  }, [cities, cityQuery]);

  // Districts (from all sites, independent)
  const derivedDistricts = useMemo(() => {
    const set = new Set<string>();
    for (const s of sites) {
      const d = (s as any).district as string | undefined;
      if (d && d.trim().length > 0) set.add(d.trim());
    }
    return Array.from(set).sort();
  }, [sites]);

  const filteredDistricts = useMemo(() => {
    const q = districtQuery.toLowerCase();
    return derivedDistricts.filter((d) => d.toLowerCase().includes(q));
  }, [derivedDistricts, districtQuery]);

  // Sites (independent)
  const filteredSites = useMemo(() => {
    const q = siteQuery.toLowerCase();
    return sites.filter((s) => s.name.toLowerCase().includes(q));
  }, [sites, siteQuery]);

  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* Region */}
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">
          Region
        </label>
        <Select
          value={scope.regionId ?? ""}
          onValueChange={(val) =>
            onChange({
              ...scope,
              regionId: val === "__ALL__" ? undefined : val,
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

      {/* City */}
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">City</label>
        <Select
          value={scope.cityId ?? ""}
          onValueChange={(val) =>
            onChange({
              ...scope,
              cityId: val === "__ALL__" ? undefined : val,
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

      {/* District */}
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">
          District
        </label>
        <Select
          value={scope.district ?? ""}
          onValueChange={(val) =>
            onChange({
              ...scope,
              district: val === "__ALL__" ? undefined : val,
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
            {filteredDistricts.map((d) => (
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
              ...scope,
              siteId: val === "__ALL__" ? undefined : val,
            })
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

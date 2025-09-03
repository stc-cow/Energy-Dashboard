<div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
  {/* Region */}
  <div>
    <label className="mb-1 block text-xs text-muted-foreground">Region</label>
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

  {/* District */}
  <div>
    <label className="mb-1 block text-xs text-muted-foreground">District</label>
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

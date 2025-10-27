// Replace the old generateCurrentDataFromRawSheets(...) with this function.

async function generateCurrentDataFromRawSheets(
  scope: HierarchyFilter,
  allCities: { id: string; name: string; regionId?: string }[],
  allSites: { id: string; name: string; cityId: string; district?: string }[],
): Promise<Array<{ [key: string]: any }>> {
  const rawData = await getRawSheetData();
  if (!rawData || rawData.length === 0) {
    return [];
  }

  const todayStr = "Today";

  // Helper: normalize status (try multiple column names)
  function getStatus(row: any): string {
    const candidates = ["COWStatus", "Status", "cowStatus", "status"];
    for (const c of candidates) {
      if (row[c] !== undefined && row[c] !== "") {
        return String(row[c]).trim();
      }
    }
    return "";
  }

  // Helper: parse GeneratorCapacity like "35KVA" or "25 KVA" -> 35 or 25
  function parseGeneratorCapacity(row: any): number | null {
    const candidates = ["GeneratorCapacity", "generatorCapacity", "genCapacity", "Capacity", "capacity"];
    for (const c of candidates) {
      if (row[c] !== undefined && row[c] !== "") {
        const raw = String(row[c]).trim();
        // keep only digits and decimal point (e.g. "35KVA" => "35")
        const m = raw.match(/(\d+(\.\d+)?)/);
        if (m) return Number(m[1]);
      }
    }
    return null;
  }

  // Helper: get fuel % as number (handles "57.00%", "57", "57.00")
  function getFuelPct(row: any): number | null {
    const keys = Object.keys(row || {});
    const candidates = [
      "fuelTankLevelPct",
      "Fuel Tank Level %",
      "Fuel Level %",
      "fuel_level_pct",
      "fuel_tank_level_pct",
      "fuelTankLevel",
      "fuelTankLevelPercent",
      "col24",
    ];
    for (const cand of candidates) {
      if (row[cand] !== undefined && row[cand] !== "") {
        const raw = String(row[cand]).replace(/,/g, "").trim();
        // parseFloat will parse "57.00%" => 57
        const n = parseFloat(raw);
        if (!isNaN(n)) return n;
      }
    }
    return null;
  }

  // Helper: get generator load % as number
  function getGenLoadPct(row: any): number | null {
    const candidates = [
      "generatorLoadFactorPct",
      "Load Factor %",
      "Generator Load Factor %",
      "load_factor_pct",
      "gen_load_factor_pct",
      "generatorLoad",
      "col25",
    ];
    for (const cand of candidates) {
      if (row[cand] !== undefined && row[cand] !== "") {
        const raw = String(row[cand]).replace(/,/g, "").trim();
        const n = parseFloat(raw);
        if (!isNaN(n)) return n;
      }
    }
    return null;
  }

  // Filter rows based on hierarchy scope AND status (include ON-AIR and In Progress)
  const filteredRows = rawData.filter((r) => {
    const regionName = getRegionName(r);
    const cityName = getCityName(r);
    const districtName = getDistrictName(r);

    // hierarchy matching
    const matchingCity = allCities.find((c) => c.name === cityName);
    const matchingRegion = matchingCity?.regionId;

    if (scope.district && districtName && districtName !== scope.district) {
      return false;
    }
    if (scope.regionId && matchingRegion !== scope.regionId) {
      return false;
    }
    if (scope.cityId && matchingCity?.id !== scope.cityId) {
      return false;
    }

    // status: only include ON-AIR or In Progress by default (ignore OFF-AIR)
    const status = getStatus(r).toLowerCase();
    if (!(status === "on-air".toLowerCase() || status === "on-air" || status === "in progress" || status === "inprogress")) {
      // also accept "ON-AIR", "On-Air", "In Progress", etc.
      // any other statuses (OFF-AIR, 0, empty) are excluded
      return false;
    }

    return true;
  });

  if (filteredRows.length === 0) {
    return [];
  }

  // Decide grouping
  const groupByDistrict = !!scope.district;
  const groupByRegion = !!scope.regionId && !scope.district;

  // Utility to compute simple & capacity-weighted average from arrays
  function computeAverages(values: number[], capacities: Array<number | null>) {
    const validPairs: Array<{ v: number; cap: number | null }> = values.map((v, i) => ({ v, cap: capacities[i] ?? null }));
    // simple average
    const simple = values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : 0;
    // capacity weighted average if we have at least one valid capacity > 0
    const caps = validPairs.map((p) => (p.cap && p.cap > 0 ? p.cap : 0));
    const capSum = caps.reduce((a, b) => a + b, 0);
    let weighted = simple;
    if (capSum > 0) {
      const weightedSum = validPairs.reduce((acc, p) => {
        const c = p.cap && p.cap > 0 ? p.cap : 0;
        return acc + p.v * c;
      }, 0);
      weighted = Math.round((weightedSum / capSum) * 10) / 10;
    }
    return { simple, weighted, usedWeighted: capSum > 0, capSum };
  }

  const currentData: Array<{ [key: string]: any }> = [];

  if (groupByDistrict) {
    // Aggregate all rows for the selected district
    const fuels: number[] = [];
    const loads: number[] = [];
    const fuelCaps: Array<number | null> = [];
    const loadCaps: Array<number | null> = [];

    filteredRows.forEach((row) => {
      const fuel = getFuelPct(row);
      const load = getGenLoadPct(row);
      const cap = parseGeneratorCapacity(row);
      if (fuel !== null) {
        fuels.push(fuel);
        fuelCaps.push(cap);
      }
      if (load !== null) {
        loads.push(load);
        loadCaps.push(cap);
      }
    });

    const fuelAvg = computeAverages(fuels, fuelCaps);
    const loadAvg = computeAverages(loads, loadCaps);

    const row: any = { name: todayStr };
    // prefer capacity-weighted if available, else simple
    row[scope.district] = fuelAvg.usedWeighted ? fuelAvg.weighted : fuelAvg.simple;
    row[`gen_${scope.district}`] = loadAvg.usedWeighted ? loadAvg.weighted : loadAvg.simple;

    currentData.push(row);
  } else if (groupByRegion) {
    // Group rows by district within the selected region
    const districtMap = new Map<
      string,
      { fuels: number[]; fuelCaps: Array<number | null>; loads: number[]; loadCaps: Array<number | null> }
    >();

    filteredRows.forEach((row) => {
      const districtName = getDistrictName(row) || "Unknown";
      if (!districtMap.has(districtName)) {
        districtMap.set(districtName, {
          fuels: [],
          fuelCaps: [],
          loads: [],
          loadCaps: [],
        });
      }
      const bucket = districtMap.get(districtName)!;
      const fuel = getFuelPct(row);
      const load = getGenLoadPct(row);
      const cap = parseGeneratorCapacity(row);
      if (fuel !== null) {
        bucket.fuels.push(fuel);
        bucket.fuelCaps.push(cap);
      }
      if (load !== null) {
        bucket.loads.push(load);
        bucket.loadCaps.push(cap);
      }
    });

    const row: any = { name: todayStr };
    districtMap.forEach(({ fuels, fuelCaps, loads, loadCaps }, district) => {
      const fAvg = computeAverages(fuels, fuelCaps);
      const lAvg = computeAverages(loads, loadCaps);
      row[district] = fAvg.usedWeighted ? fAvg.weighted : fAvg.simple;
      row[`gen_${district}`] = lAvg.usedWeighted ? lAvg.weighted : lAvg.simple;
    });

    if (Object.keys(row).length > 1) currentData.push(row);
  } else {
    // National / all regions: group by region
    const regionMap = new Map<string, { fuels: number[]; fuelCaps: Array<number | null>; loads: number[]; loadCaps: Array<number | null> }>();

    filteredRows.forEach((row) => {
      const region = getRegionName(row) || "Unknown";
      if (!regionMap.has(region)) {
        regionMap.set(region, { fuels: [], fuelCaps: [], loads: [], loadCaps: [] });
      }
      const bucket = regionMap.get(region)!;
      const fuel = getFuelPct(row);
      const load = getGenLoadPct(row);
      const cap = parseGeneratorCapacity(row);
      if (fuel !== null) {
        bucket.fuels.push(fuel);
        bucket.fuelCaps.push(cap);
      }
      if (load !== null) {
        bucket.loads.push(load);
        bucket.loadCaps.push(cap);
      }
    });

    const row: any = { name: todayStr };
    regionMap.forEach(({ fuels, fuelCaps, loads, loadCaps }, region) => {
      const fAvg = computeAverages(fuels, fuelCaps);
      const lAvg = computeAverages(loads, loadCaps);
      row[region] = fAvg.usedWeighted ? fAvg.weighted : fAvg.simple;
      row[`gen_${region}`] = lAvg.usedWeighted ? lAvg.weighted : lAvg.simple;
    });

    if (Object.keys(row).length > 1) currentData.push(row);
  }

  return currentData;
}

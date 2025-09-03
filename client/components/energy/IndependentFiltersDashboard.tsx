import React, { useEffect, useMemo, useState } from "react";

export type DataKeyMap = {
  region: string;
  city: string;
  district: string;
  site: string;
  diesel: string;
  power: string;
  co2: string;
  fuelPct: string;
  genLoadPct: string;
};

interface Props {
  apiUrl: string;
  dataKeyMap?: Partial<DataKeyMap>;
}

const defaultMap: DataKeyMap = {
  region: "regionName",
  city: "cityName",
  district: "district",
  site: "siteName",
  diesel: "dieselLitersPerDay",
  power: "powerDemandKw",
  co2: "co2Tons",
  fuelPct: "fuelTankLevelPct",
  genLoadPct: "generatorLoadFactorPct",
};

function googleGVizUrl(u: string): string | null {
  const m = u.match(
    /https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
  );
  if (!m) return null;
  const id = m[1];
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json`;
}

function parseGVizJSON(text: string): any[] {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return [];
  try {
    const json = JSON.parse(text.slice(start, end + 1));
    const table = json.table;
    const headers: string[] = (table.cols || []).map((c: any) =>
      String(c.label || ""),
    );
    const rows: any[] = [];
    for (const row of table.rows || []) {
      const obj: any = {};
      (row.c || []).forEach((cell: any, i: number) => {
        const key = headers[i] || `col${i}`;
        obj[key] = cell ? cell.v : null;
      });
      rows.push(obj);
    }
    return rows;
  } catch {
    return [];
  }
}

export default function IndependentFiltersDashboard({
  apiUrl,
  dataKeyMap,
}: Props) {
  const map: DataKeyMap = { ...defaultMap, ...(dataKeyMap as any) };

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedSite, setSelectedSite] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const gviz = googleGVizUrl(apiUrl);
        if (gviz) {
          const res = await fetch(gviz);
          if (!res.ok) throw new Error("failed");
          const text = await res.text();
          if (active) setRows(parseGVizJSON(text));
        } else {
          const res = await fetch(apiUrl);
          if (!res.ok) throw new Error("failed");
          const data = await res.json();
          if (active)
            setRows(Array.isArray(data) ? data : data.rows || data.data || []);
        }
      } catch (e) {
        console.error("Failed to load data", e);
        if (active) setRows([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [apiUrl]);

  const uniqueValues = useMemo(() => {
    return (field: keyof DataKeyMap) => {
      const key = map[field];
      const set = new Set(
        rows.map((r) => (r[key] == null ? "" : String(r[key]))),
      );
      return Array.from(set)
        .filter((v) => v !== "")
        .sort();
    };
  }, [rows, map]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const regOk = !selectedRegion || String(r[map.region]) === selectedRegion;
      const cityOk = !selectedCity || String(r[map.city]) === selectedCity;
      const distOk =
        !selectedDistrict || String(r[map.district]) === selectedDistrict;
      const siteOk = !selectedSite || String(r[map.site]) === selectedSite;
      return regOk && cityOk && distOk && siteOk;
    });
  }, [rows, selectedRegion, selectedCity, selectedDistrict, selectedSite, map]);

  const sum = useMemo(() => {
    return (key: string) =>
      filteredRows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
  }, [filteredRows]);

  const avg = useMemo(() => {
    return (key: string) =>
      filteredRows.length ? sum(key) / filteredRows.length : 0;
  }, [filteredRows, sum]);

  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h3>Independent Filters Dashboard</h3>
      {loading ? (
        <div>Loading data...</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
            >
              <option value="">All Regions</option>
              {uniqueValues("region").map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>

            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
            >
              <option value="">All Cities</option>
              {uniqueValues("city").map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>

            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
            >
              <option value="">All Districts</option>
              {uniqueValues("district").map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>

            <select
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
            >
              <option value="">All Sites</option>
              {uniqueValues("site").map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <strong>Rows matched:</strong> {filteredRows.length}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: 12,
            }}
          >
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: "#4b2",
                color: "#fff",
              }}
            >
              <div>Diesel Consumption (sum)</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>
                {sum(map.diesel).toLocaleString()}
              </div>
            </div>

            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: "#28a",
                color: "#fff",
              }}
            >
              <div>Power Demand (sum)</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>
                {sum(map.power).toLocaleString()}
              </div>
            </div>

            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: "#a22",
                color: "#fff",
              }}
            >
              <div>Daily CO₂ Emissions (sum)</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>
                {sum(map.co2).toLocaleString()}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

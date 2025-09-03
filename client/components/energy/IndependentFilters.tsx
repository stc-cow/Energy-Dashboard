import React, { useEffect, useMemo, useState } from "react";

function googleGVizUrl(u: string): string | null {
  const m = u.match(/https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
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
    const headers: string[] = (table.cols || []).map((c: any) => String(c.label || ""));
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

export default function IndependentFilters({ apiUrl }: { apiUrl: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [site, setSite] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const gviz = googleGVizUrl(apiUrl);
        if (gviz) {
          const res = await fetch(gviz);
          if (!res.ok) throw new Error("sheet fetch failed");
          const text = await res.text();
          if (active) setRows(parseGVizJSON(text));
        } else {
          const r = await fetch(apiUrl);
          if (!r.ok) throw new Error("fetch failed");
          const data = await r.json();
          if (active) setRows(Array.isArray(data) ? data : data.rows || data.data || []);
        }
      } catch {
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

  const unique = useMemo(() => {
    return (field: string) =>
      Array.from(
        new Set(
          rows.map((r) => ((r as any)[field] ?? (r as any)[field + "Name"]))
        )
      )
        .filter(Boolean)
        .map(String)
        .sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) =>
      (!region || (r as any).regionName === region) &&
      (!city || (r as any).cityName === city) &&
      (!district || (((r as any).district ?? (r as any).districtName) === district)) &&
      (!site || (r as any).siteName === site)
    );
  }, [rows, region, city, district, site]);

  return (
    <div>
      <h3>Independent Filters</h3>
      {loading ? (
        <div>Loading…</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 10, marginBottom: 15 }}>
            <select value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">All Regions</option>
              {unique("regionName").map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <select value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="">All Cities</option>
              {unique("cityName").map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <select value={district} onChange={(e) => setDistrict(e.target.value)}>
              <option value="">All Districts</option>
              {unique("district").map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <select value={site} onChange={(e) => setSite(e.target.value)}>
              <option value="">All Sites</option>
              {unique("siteName").map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div>Matched rows: {filteredRows.length}</div>
        </>
      )}
    </div>
  );
}

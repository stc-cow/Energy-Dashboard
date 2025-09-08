import { RequestHandler } from "express";

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

function parseCSV(text: string): any[] {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((l) => l.length);
  if (!lines.length) return [];
  function splitCSV(line: string): string[] {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map((s) => s.trim());
  }
  const header = splitCSV(lines[0]).map((h, i) => h || `col${i}`);
  const rows: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCSV(lines[i]);
    if (cells.every((c) => c === "")) continue;
    const obj: any = {};
    for (let j = 0; j < header.length; j++) obj[header[j]] = cells[j] ?? "";
    rows.push(obj);
  }
  return rows;
}

type SheetEndpoint = { kind: "gviz" | "csv"; url: string } | null;
function getSheetEndpoint(u: string): SheetEndpoint {
  let m = u.match(
    /https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
  );
  if (m && !/\/e\//.test(u)) {
    const id = m[1];
    return {
      kind: "gviz",
      url: `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json`,
    };
  }
  m = u.match(
    /https:\/\/docs\.google\.com\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/,
  );
  if (m) {
    const pid = m[1];
    let gid: string | null = null;
    try {
      gid = new URL(u).searchParams.get("gid");
    } catch {}
    return {
      kind: "csv",
      url: `https://docs.google.com/spreadsheets/d/e/${pid}/pub?output=csv${gid ? `&gid=${gid}` : ""}`,
    };
  }
  if (/output=csv/.test(u)) return { kind: "csv", url: u };
  return null;
}

export const proxySheet: RequestHandler = async (req, res) => {
  const sheetParam = (req.query.sheet as string) || process.env.SHEET_URL || "";
  if (!sheetParam) return res.status(400).json({ error: "no sheet" });
  try {
    const ep = getSheetEndpoint(sheetParam) || {
      kind: "gviz",
      url: sheetParam,
    };
    const r = await fetch(ep.url);
    if (!r.ok)
      return res.status(502).json({ error: "fetch failed", status: r.status });
    const ct = r.headers.get("content-type") || "";
    const text = await r.text();
    let rows: any[] = [];
    if (
      ep.kind === "gviz" ||
      ct.includes("json") ||
      text.trim().startsWith("{")
    ) {
      rows = parseGVizJSON(text);
      if (!rows.length) rows = parseCSV(text);
    } else {
      rows = parseCSV(text);
    }
    return res.json(rows);
  } catch (e: any) {
    console.error("proxySheet error", e);
    return res.status(500).json({ error: "error" });
  }
};

/**
 * Reading and writing spreadsheets in the browser.
 *
 * The file is read here, not uploaded: the person sees their columns at once,
 * and only the rows (as plain data) go to the server to be checked.
 */
/* The spreadsheet library is large, so it loads only when a file is read or
   written — not on every page. */
const loadXLSX = () => import("xlsx");
import type { Contact } from "./api";
import { countryName } from "./format";

export type Target =
  | "name" | "firstName" | "lastName" | "phone" | "countryCode" | "company"
  | "email" | "country" | "city" | "tags" | "notes" | "custom" | "ignore";

export const TARGETS: { value: Target; label: string; hint?: string }[] = [
  { value: "phone", label: "Phone / WhatsApp number" },
  { value: "name", label: "Full name" },
  { value: "firstName", label: "First name" },
  { value: "lastName", label: "Last name" },
  { value: "company", label: "Company" },
  { value: "country", label: "Country" },
  { value: "countryCode", label: "Country code (+971…)" },
  { value: "city", label: "City" },
  { value: "email", label: "Email" },
  { value: "tags", label: "Tags / group" },
  { value: "notes", label: "Notes" },
  { value: "custom", label: "Keep as extra detail", hint: "Usable in messages as {{column name}}" },
  { value: "ignore", label: "Don't import" },
];

/** firstDataRow: the Excel row number of rows[0], so problems can be reported by the row the person sees. */
export type Sheet = { name: string; headers: string[]; rows: Record<string, unknown>[]; firstDataRow: number };
export type Workbook = { fileName: string; sheets: Sheet[] };

export async function readWorkbook(file: File): Promise<Workbook> {
  const XLSX = await loadXLSX();
  const buf = await file.arrayBuffer();
  /* raw: numbers stay numbers, so 971501234567 is not turned into
     "9.71501E+11" on the way in. */
  const wb = XLSX.read(buf, { type: "array", cellDates: true, raw: false, dense: true });
  const sheets: Sheet[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null, blankrows: true });
    if (!matrix.some((r) => (r ?? []).some((c) => c != null && String(c).trim() !== ""))) continue;
    const startRow = XLSX.utils.decode_range(ws["!ref"] ?? "A1").s.r + 1;
    // The header row is the first row with at least two filled cells —
    // exported sheets often start with a title line.
    let headerIdx = matrix.findIndex((r) => (r ?? []).filter((c) => c != null && String(c).trim() !== "").length >= 2);
    if (headerIdx < 0) headerIdx = 0;
    const seen = new Map<string, number>();
    const headers = (matrix[headerIdx] ?? []).map((h, i) => {
      let label = h == null || String(h).trim() === "" ? `Column ${i + 1}` : String(h).trim();
      const n = seen.get(label) ?? 0;
      seen.set(label, n + 1);
      if (n) label = `${label} (${n + 1})`;
      return label;
    });
    const rows = matrix.slice(headerIdx + 1).map((r) => {
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        const v = (r ?? [])[i];
        obj[h] = v instanceof Date ? v.toISOString().slice(0, 10) : v;
      });
      return obj;
    });
    // Trailing blank rows are just the end of the sheet.
    while (rows.length && Object.values(rows[rows.length - 1]).every((v) => v == null || String(v).trim() === "")) rows.pop();
    sheets.push({ name, headers, rows, firstDataRow: startRow + headerIdx + 1 });
  }
  if (!sheets.length) throw new Error("This file has no rows. Check you picked the right file.");
  return { fileName: file.name, sheets };
}

const GUESSES: [RegExp, Target][] = [
  [/(whats\s*app|mobile|phone|cell|contact\s*(no|number)|tel|mob\b|number|wa\b)/i, "phone"],
  [/^(country\s*code|isd|dial\s*code|calling\s*code|code)$/i, "countryCode"],
  [/^(first\s*name|given\s*name|fname)$/i, "firstName"],
  [/^(last\s*name|surname|family\s*name|lname)$/i, "lastName"],
  [/(company|firm|business|organi[sz]ation|shop|store|brand|trading)/i, "company"],
  [/(e-?mail)/i, "email"],
  [/(country|nation)/i, "country"],
  [/(city|town|location|place)/i, "city"],
  [/(tag|group|category|segment|type|label|list)/i, "tags"],
  [/(note|remark|comment|description)/i, "notes"],
  [/(name|client|customer|contact\s*person|person|buyer|party)/i, "name"],
];

/** A first guess for each column. The person can change any of them. */
export function guessMapping(headers: string[], rows: Record<string, unknown>[]): Record<string, Target> {
  const map: Record<string, Target> = {};
  const used = new Set<Target>();
  for (const h of headers) {
    const hit = GUESSES.find(([re, t]) => re.test(h) && (!used.has(t) || t === "tags" || t === "notes"));
    map[h] = hit ? hit[1] : "custom";
    if (hit) used.add(hit[1]);
  }
  // No header said "phone": pick the column that looks most like phone numbers.
  if (!used.has("phone")) {
    let best: string | null = null;
    let bestScore = 0;
    for (const h of headers) {
      const sample = rows.slice(0, 50).map((r) => String(r[h] ?? "").replace(/\D/g, ""));
      const score = sample.filter((d) => d.length >= 8 && d.length <= 15).length;
      if (score > bestScore) [best, bestScore] = [h, score];
    }
    if (best) map[best] = "phone";
  }
  // Columns that are empty all the way down are noise.
  for (const h of headers) {
    if (map[h] === "custom" && rows.every((r) => r[h] == null || String(r[h]).trim() === "")) map[h] = "ignore";
  }
  return map;
}

export async function downloadSample() {
  const XLSX = await loadXLSX();
  const rows = [
    ["Name", "Company", "WhatsApp Number", "Country", "City", "Tags", "Budget"],
    ["Ahmed Al Mansoori", "Al Mansoori Jewellers", "+971 50 123 4567", "UAE", "Dubai", "VIP, Retailer", "$120k"],
    ["Linda Chen", "Golden Lotus Jewelry", "+852 9123 4567", "Hong Kong", "Hong Kong", "Hong Kong Show", "$80k"],
    ["Pieter Janssens", "Janssens & Zoon BV", "0470 12 34 56", "Belgium", "Antwerp", "Wholesaler", ""],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 22 }, { wch: 24 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 10 }];
  // The number column as Text, so Excel never shortens a number to 9.7E+11.
  for (let r = 1; r < rows.length; r += 1) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: 2 })];
    if (cell) cell.z = "@";
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Clients");
  XLSX.writeFile(wb, "client-import-sample.xlsx");
}

export async function exportContacts(items: Contact[], fileName = "clients.xlsx") {
  const XLSX = await loadXLSX();
  const extra = [...new Set(items.flatMap((c) => Object.keys(c.fields ?? {})))];
  const rows = items.map((c) => ({
    Name: c.name,
    Company: c.company,
    "WhatsApp Number": "+" + c.phone,
    Country: countryName(c.country),
    City: c.city,
    Email: c.email,
    Tags: (c.tags ?? []).join(", "),
    Status: c.optedOut ? "Opted out" : c.waStatus === "invalid" ? "Not on WhatsApp" : "Active",
    Source: c.source === "inbound" ? "Wrote to us" : c.source === "import" ? "Imported" : "Added by hand",
    Notes: c.notes,
    ...Object.fromEntries(extra.map((k) => [k, c.fields?.[k] ?? ""])),
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Clients");
  XLSX.writeFile(wb, fileName);
}

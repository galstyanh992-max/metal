/**
 * Excel/CSV export utility — generates .xlsx files in browser.
 *
 * Uses SheetJS (xlsx) library. Pure client-side, no server roundtrip.
 */

import * as XLSX from "xlsx";

type CellValue = string | number | boolean | null | undefined;

export type ExcelColumn<T> = {
  header: string;       // Column header text
  width?: number;       // Column width in characters
  get: (row: T, idx: number) => CellValue;  // Cell value extractor
};

/**
 * Export rows to .xlsx file.
 *
 * Usage:
 *   exportToExcel("clients.xlsx", "Հաճախորդներ", clients, [
 *     { header: "Անուն", get: c => c.name },
 *     { header: "Հեռախոս", get: c => c.phone },
 *   ]);
 */
export function exportToExcel<T>(
  filename: string,
  sheetName: string,
  rows: T[],
  columns: ExcelColumn<T>[],
): void {
  // Build 2D array (header row + data rows)
  const data: CellValue[][] = [
    columns.map((c) => c.header),
    ...rows.map((row, idx) => columns.map((c) => c.get(row, idx))),
  ];

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  ws["!cols"] = columns.map((c) => ({
    wch: c.width ?? Math.max(c.header.length + 2, 14),
  }));

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(sheetName));

  // Trigger download
  XLSX.writeFile(wb, filename, { compression: true });
}

function sanitizeSheetName(name: string): string {
  // Excel sheet names: max 31 chars, no special chars
  const cleaned = name.replace(/[\\/?*[\]:]/g, "_");
  return cleaned.length > 31 ? cleaned.slice(0, 31) : cleaned;
}

/** Format AMD with thousands separator */
export function fmtAMD(v: number | undefined | null): string {
  if (v == null) return "";
  return new Intl.NumberFormat("hy-AM").format(v);
}

/** Format ISO date → DD.MM.YYYY */
export function fmtDate(iso: string | Date | undefined | null): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

/** Format ISO date-time → DD.MM.YYYY HH:MM */
export function fmtDateTime(iso: string | Date | undefined | null): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return "";
  const date = fmtDate(d);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${date} ${hh}:${mm}`;
}

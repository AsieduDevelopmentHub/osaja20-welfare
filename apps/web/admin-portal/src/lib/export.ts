import { apiFetch } from "./api";

export function downloadCsv(filename: string, rows: string[][]) {
  const escape = (cell: string) => {
    const s = String(cell ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const csv = rows.map((row) => row.map(escape).join(",")).join("\r\n");
  downloadBlob(filename.endsWith(".csv") ? filename : `${filename}.csv`, `\uFEFF${csv}`, "text/csv;charset=utf-8;");
}

/** Excel-friendly tab-separated export */
export function downloadExcel(filename: string, rows: string[][]) {
  const tsv = rows.map((row) => row.join("\t")).join("\r\n");
  const base = filename.replace(/\.(csv|xls|xlsx)$/i, "");
  downloadBlob(`${base}.xls`, `\uFEFF${tsv}`, "application/vnd.ms-excel;charset=utf-8;");
}

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export async function fetchAllPages<T>(path: string, pageSize = 100): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const sep = path.includes("?") ? "&" : "?";
    const res = await apiFetch<Paginated<T>>(`${path}${sep}page=${page}&page_size=${pageSize}`);
    const data = res.data;
    if (!data) break;
    all.push(...(data.items ?? []));
    totalPages = data.total_pages ?? 1;
    page += 1;
  }
  return all;
}

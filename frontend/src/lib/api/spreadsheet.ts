import type { ColumnMapping, ImportResponse } from "@/lib/types/spreadsheet";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function downloadTemplate(): Promise<void> {
  const res = await fetch(`${BASE}/spreadsheet/template/download`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "FinanceFlow.xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function inspectSpreadsheet(file: File): Promise<ImportResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/spreadsheet/import`, { method: "POST", body: form });
  return handleResponse<ImportResponse>(res);
}

export async function saveMapping(mapping: ColumnMapping): Promise<void> {
  const res = await fetch(`${BASE}/spreadsheet/mapping`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mapping),
  });
  await handleResponse<unknown>(res);
}

export async function resetMapping(): Promise<void> {
  const res = await fetch(`${BASE}/spreadsheet/mapping`, { method: "DELETE" });
  await handleResponse<unknown>(res);
}

import type { Transaction, UploadResponse } from "@/lib/types/statement";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function uploadStatement(file: File, creditCard: boolean = false): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("credit_card", String(creditCard));
  const res = await fetch(`${BASE}/statement/upload`, { method: "POST", body: form });
  return handleResponse<UploadResponse>(res);
}

export async function confirmTransactions(
  transactions: Transaction[],
  spreadsheet: File,
): Promise<Blob> {
  const form = new FormData();
  form.append("transactions", JSON.stringify(transactions));
  form.append("spreadsheet", spreadsheet);
  const res = await fetch(`${BASE}/statement/confirm`, { method: "POST", body: form });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.blob();
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

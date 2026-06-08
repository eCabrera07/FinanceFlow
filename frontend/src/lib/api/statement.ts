import type { Transaction, UploadResponse, ConfirmResult } from "@/lib/types/statement";

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
  spreadsheet: File | null,
): Promise<ConfirmResult> {
  const form = new FormData();
  form.append("transactions", JSON.stringify(transactions));
  if (spreadsheet) form.append("spreadsheet", spreadsheet);
  const res = await fetch(`${BASE}/statement/confirm`, { method: "POST", body: form });
  if (!res.ok) {
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      throw new Error(json.detail || text || `HTTP ${res.status}`);
    } catch {
      throw new Error(text || `HTTP ${res.status}`);
    }
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("spreadsheetml")) {
    const blob = await res.blob();
    downloadBlob(blob, "FinanceFlow_updated.xlsx");
    return { kind: "downloaded" };
  }
  const json = await res.json();
  return { kind: "written", status: json.status };
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

"use client";
import { useState } from "react";
import { confirmTransactions, downloadBlob } from "@/lib/api/statement";
import { CATEGORIES } from "@/lib/types/statement";
import type { Transaction } from "@/lib/types/statement";

interface Row {
  tx: Transaction;
  included: boolean;
}

interface Props {
  transactions: Transaction[];
  onDone: () => void;
}

export default function ReviewTable({ transactions, onDone }: Props) {
  const [rows, setRows] = useState<Row[]>(() =>
    transactions.map((tx) => ({ tx, included: true }))
  );
  const [spreadsheet, setSpreadsheet] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const approvedCount = rows.filter((r) => r.included).length;
  const allIncluded = rows.every((r) => r.included);

  function toggleRow(i: number) {
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, included: !r.included } : r));
  }

  function toggleAll() {
    setRows((prev) => prev.map((r) => ({ ...r, included: !allIncluded })));
  }

  function updateCategory(i: number, category: string) {
    setRows((prev) =>
      prev.map((r, idx) => idx === i ? { ...r, tx: { ...r.tx, category } } : r)
    );
  }

  async function handleWrite() {
    if (!spreadsheet) {
      setError("Select your spreadsheet file before writing.");
      return;
    }
    const approved = rows.filter((r) => r.included).map((r) => r.tx);
    if (approved.length === 0) {
      setError("No transactions selected.");
      return;
    }
    setStatus("loading");
    setError("");
    try {
      const blob = await confirmTransactions(approved, spreadsheet);
      downloadBlob(blob, "FinanceFlow_updated.xlsx");
      setStatus("done");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to write transactions");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-lg bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
        <p className="font-medium">✓ Transactions written successfully.</p>
        <p className="mt-1 text-emerald-600">
          Your updated spreadsheet downloaded as <strong>FinanceFlow_updated.xlsx</strong>.
          Replace your original file with it.
        </p>
        <button
          type="button"
          onClick={onDone}
          className="mt-3 text-sm font-medium text-emerald-700 underline-offset-2 hover:underline"
        >
          Import another statement →
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          <span className="font-medium">{approvedCount}</span> of{" "}
          <span className="font-medium">{rows.length}</span> transactions selected
        </p>
        <button type="button" onClick={toggleAll} className="text-xs text-gray-400 hover:text-gray-600">
          {allIncluded ? "Deselect all" : "Select all"}
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-500">
              <th className="px-3 py-2 w-8"></th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, i) => (
              <tr key={i} className={row.included ? "" : "opacity-40"}>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={row.included}
                    onChange={() => toggleRow(i)}
                    className="h-4 w-4 rounded border-gray-300 accent-emerald-600"
                  />
                </td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{row.tx.date}</td>
                <td className="px-3 py-2 text-gray-800 max-w-[180px] truncate">{row.tx.description}</td>
                <td className={`px-3 py-2 text-right font-mono whitespace-nowrap ${
                  row.tx.amount < 0 ? "text-red-600" : "text-emerald-600"
                }`}>
                  {row.tx.amount < 0 ? "-" : "+"}${Math.abs(row.tx.amount).toFixed(2)}
                </td>
                <td className="px-3 py-2">
                  <select
                    value={row.tx.category}
                    onChange={(e) => updateCategory(i, e.target.value)}
                    className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-gray-500">{row.tx.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-lg border border-gray-200 p-4">
        <p className="mb-2 text-sm font-medium text-gray-800">Write to your spreadsheet</p>
        <p className="mb-3 text-xs text-gray-500">
          Select your .xlsx file — transactions are written to it and downloaded back.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:border-emerald-400 hover:bg-emerald-50">
            <input
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => setSpreadsheet(e.target.files?.[0] ?? null)}
            />
            {spreadsheet ? spreadsheet.name : "Select spreadsheet (.xlsx)"}
          </label>
          <button
            type="button"
            onClick={handleWrite}
            disabled={status === "loading" || !spreadsheet}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {status === "loading"
              ? "Writing…"
              : `Write ${approvedCount} transaction${approvedCount !== 1 ? "s" : ""} to spreadsheet`}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

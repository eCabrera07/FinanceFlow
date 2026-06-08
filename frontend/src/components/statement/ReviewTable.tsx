"use client";
import { useEffect, useRef, useState } from "react";
import { confirmTransactions, uploadStatement } from "@/lib/api/statement";
import { CATEGORIES } from "@/lib/types/statement";
import type { ConfirmResult, Transaction, UploadResponse } from "@/lib/types/statement";

interface Row {
  tx: Transaction;
  included: boolean;
}

interface Props {
  transactions: Transaction[];
  hasVolumeFile: boolean;
  onAddMore: (result: UploadResponse) => void;
  onDone: () => void;
}

export default function ReviewTable({ transactions, hasVolumeFile, onAddMore, onDone }: Props) {
  const [rows, setRows] = useState<Row[]>(() =>
    transactions.map((tx) => ({ tx, included: true }))
  );
  const [spreadsheet, setSpreadsheet] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(null);

  // "Add another statement" state
  const addFileRef = useRef<HTMLInputElement>(null);
  const [addCreditCard, setAddCreditCard] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  // Append new transactions when parent adds more statements
  const rowCountRef = useRef(transactions.length);
  useEffect(() => {
    if (transactions.length > rowCountRef.current) {
      const newTxs = transactions.slice(rowCountRef.current);
      setRows((prev) => [...prev, ...newTxs.map((tx) => ({ tx, included: true }))]);
      rowCountRef.current = transactions.length;
    }
  }, [transactions]);

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

  async function handleAddFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAddLoading(true);
    setAddError("");
    try {
      const result = await uploadStatement(file, addCreditCard);
      if (result.transactions.length === 0) {
        setAddError("No transactions found in that file.");
        return;
      }
      onAddMore(result);
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : "Failed to parse statement");
    } finally {
      setAddLoading(false);
      if (addFileRef.current) addFileRef.current.value = "";
    }
  }

  async function handleWrite() {
    const approved = rows.filter((r) => r.included).map((r) => r.tx);
    if (approved.length === 0) {
      setError("No transactions selected.");
      return;
    }
    setStatus("loading");
    setError("");
    try {
      const result = await confirmTransactions(approved, spreadsheet);
      setConfirmResult(result);
      setStatus("done");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to write transactions");
      setStatus("error");
    }
  }

  if (status === "done") {
    let message: React.ReactNode;
    if (confirmResult?.kind === "downloaded") {
      message = (
        <>
          Your updated spreadsheet downloaded as <strong>FinanceFlow_updated.xlsx</strong>.
          Replace your original file with it. It's also saved in your data folder for future imports.
        </>
      );
    } else if (confirmResult?.kind === "written" && confirmResult.status === "created") {
      message = (
        <>
          A new <strong>FinanceFlow.xlsx</strong> was created in your data folder with your
          transactions. Future imports will write to it automatically — no file picker needed.
        </>
      );
    } else {
      message = (
        <>
          Your transactions were written to <strong>FinanceFlow.xlsx</strong> in your data folder.
        </>
      );
    }

    return (
      <div className="rounded-lg bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
        <p className="font-medium">✓ Transactions written successfully.</p>
        <p className="mt-1 text-emerald-600">{message}</p>
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
      {/* Add another statement */}
      <div className="mb-4 rounded-lg border border-dashed border-gray-300 p-3">
        <p className="mb-2 text-xs font-medium text-gray-600">Add another statement</p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-3">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-600">
              <input
                type="radio"
                name="addStatementType"
                checked={!addCreditCard}
                onChange={() => setAddCreditCard(false)}
                className="accent-emerald-600"
              />
              Bank
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-600">
              <input
                type="radio"
                name="addStatementType"
                checked={addCreditCard}
                onChange={() => setAddCreditCard(true)}
                className="accent-emerald-600"
              />
              Credit card
            </label>
          </div>
          <input
            ref={addFileRef}
            type="file"
            accept=".pdf,.csv"
            className="hidden"
            onChange={handleAddFile}
          />
          <button
            type="button"
            disabled={addLoading}
            onClick={() => addFileRef.current?.click()}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:border-emerald-400 hover:bg-emerald-50 disabled:opacity-50"
          >
            {addLoading ? "Parsing…" : "+ Add file"}
          </button>
          {addError && <p className="text-xs text-red-600">{addError}</p>}
        </div>
      </div>

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
        {hasVolumeFile ? (
          <>
            <p className="mb-3 text-sm font-medium text-gray-800">
              Write to <span className="font-mono text-emerald-700">FinanceFlow.xlsx</span>
            </p>
            <button
              type="button"
              onClick={handleWrite}
              disabled={status === "loading"}
              className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {status === "loading"
                ? "Writing…"
                : `Export ${approvedCount} transaction${approvedCount !== 1 ? "s" : ""} to FinanceFlow.xlsx`}
            </button>
          </>
        ) : (
          <>
            <p className="mb-2 text-sm font-medium text-gray-800">Write to your spreadsheet</p>
            <p className="mb-3 text-xs text-gray-500">
              Select your .xlsx file, or leave blank to create a new FinanceFlow spreadsheet automatically.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:border-emerald-400 hover:bg-emerald-50">
                <input
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(e) => setSpreadsheet(e.target.files?.[0] ?? null)}
                />
                {spreadsheet ? spreadsheet.name : "Select spreadsheet (.xlsx) — optional"}
              </label>
              <button
                type="button"
                onClick={handleWrite}
                disabled={status === "loading"}
                className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {status === "loading"
                  ? "Writing…"
                  : `Export ${approvedCount} transaction${approvedCount !== 1 ? "s" : ""} to spreadsheet`}
              </button>
            </div>
          </>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

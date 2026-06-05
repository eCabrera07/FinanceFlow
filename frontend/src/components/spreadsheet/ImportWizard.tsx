"use client";
import { useRef, useState } from "react";
import { inspectSpreadsheet, saveMapping } from "@/lib/api/spreadsheet";
import type { ColumnMapping, FieldName, ImportResponse } from "@/lib/types/spreadsheet";

const ALL_FIELDS: FieldName[] = ["date", "description", "amount", "category", "source", "type"];

const FIELD_LABELS: Record<FieldName, string> = {
  date: "Date",
  description: "Description / Merchant",
  amount: "Amount",
  category: "Category",
  source: "Source / Account",
  type: "Type (Income/Expense)",
};

interface Props {
  onClose: () => void;
  onComplete: () => void;
}

type Step = 1 | 2 | 3 | 4;

export default function ImportWizard({ onClose, onComplete }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<ImportResponse | null>(null);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [columns, setColumns] = useState<Record<FieldName, string | null>>({
    date: null, description: null, amount: null, category: null, source: null, type: null,
  });
  const [startRow, setStartRow] = useState("auto");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Step 1: upload ──────────────────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setLoading(true);
    setError("");
    try {
      const data = await inspectSpreadsheet(f);
      setImportData(data);
      const firstSheet = Object.keys(data)[0] ?? "";
      if (firstSheet) {
        setSelectedSheet(firstSheet);
        setColumns(data[firstSheet].suggested_mapping);
      }
      setStep(2);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to read spreadsheet");
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: sheet select ────────────────────────────────────────────────────
  function handleSheetSelect(sheet: string) {
    setSelectedSheet(sheet);
    if (importData?.[sheet]) {
      setColumns(importData[sheet].suggested_mapping);
    }
    setStep(3);
  }

  // ── Step 3: column mapping ──────────────────────────────────────────────────
  function handleColumnChange(field: FieldName, value: string) {
    setColumns(prev => ({ ...prev, [field]: value === "" ? null : value }));
  }

  // ── Step 4: finish ──────────────────────────────────────────────────────────
  async function handleFinish() {
    if (!file || !selectedSheet) return;
    setLoading(true);
    setError("");
    try {
      const mapping: ColumnMapping = {
        file_path: file.name,
        sheet_name: selectedSheet,
        start_row: startRow,
        columns,
      };
      await saveMapping(mapping);
      onComplete();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save mapping");
    } finally {
      setLoading(false);
    }
  }

  const sheetHeaders = importData?.[selectedSheet]?.headers ?? {};
  const columnOptions = [
    { value: "", label: "(skip)" },
    ...Object.entries(sheetHeaders).map(([letter, label]) => ({
      value: letter,
      label: `${letter} — "${label}"`,
    })),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Use My Own Spreadsheet</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {/* Step indicator */}
        <div className="mb-6 flex gap-2">
          {([1, 2, 3, 4] as Step[]).map(s => (
            <div
              key={s}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                step === s ? "bg-emerald-600 text-white" :
                step > s  ? "bg-emerald-100 text-emerald-700" :
                             "bg-gray-100 text-gray-400"
              }`}
            >
              {s}
            </div>
          ))}
          <span className="ml-2 text-sm text-gray-500">
            {step === 1 && "Upload your spreadsheet"}
            {step === 2 && "Pick the sheet to write to"}
            {step === 3 && "Match columns to our fields"}
            {step === 4 && "Choose start row"}
          </span>
        </div>

        {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        {/* ── Step 1 ────────────────────────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <p className="mb-4 text-sm text-gray-600">
              Select your existing <code>.xlsx</code> file. We'll read its structure and suggest how to map your columns.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={loading}
              className="w-full rounded-lg border-2 border-dashed border-gray-300 px-4 py-8 text-sm text-gray-500 hover:border-emerald-400 hover:text-emerald-600 disabled:opacity-50"
            >
              {loading ? "Reading file…" : "Click to select your .xlsx file"}
            </button>
          </div>
        )}

        {/* ── Step 2 ────────────────────────────────────────────────────────── */}
        {step === 2 && importData && (
          <div>
            <p className="mb-4 text-sm text-gray-600">
              Which sheet should new transactions be written to?
            </p>
            <ul className="space-y-2">
              {Object.keys(importData).map(sheet => (
                <li key={sheet}>
                  <button
                    onClick={() => handleSheetSelect(sheet)}
                    className="w-full rounded-lg border border-gray-200 px-4 py-3 text-left text-sm hover:border-emerald-400 hover:bg-emerald-50"
                  >
                    {sheet}
                    <span className="ml-2 text-xs text-gray-400">
                      ({Object.keys(importData[sheet].headers).length} columns)
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <button onClick={() => setStep(1)} className="mt-4 text-xs text-gray-400 hover:text-gray-600">← Back</button>
          </div>
        )}

        {/* ── Step 3 ────────────────────────────────────────────────────────── */}
        {step === 3 && (
          <div>
            <p className="mb-4 text-sm text-gray-600">
              Match your column headers to our fields. Auto-guesses are pre-filled — adjust as needed.
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400">
                  <th className="pb-2">Our field</th>
                  <th className="pb-2">Your column</th>
                </tr>
              </thead>
              <tbody className="space-y-1">
                {ALL_FIELDS.map(field => (
                  <tr key={field}>
                    <td className="py-1 pr-4 font-medium text-gray-700">{FIELD_LABELS[field]}</td>
                    <td className="py-1">
                      <select
                        value={columns[field] ?? ""}
                        onChange={e => handleColumnChange(field, e.target.value)}
                        className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
                      >
                        {columnOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 flex justify-between">
              <button onClick={() => setStep(2)} className="text-xs text-gray-400 hover:text-gray-600">← Back</button>
              <button
                onClick={() => setStep(4)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4 ────────────────────────────────────────────────────────── */}
        {step === 4 && (
          <div>
            <p className="mb-4 text-sm text-gray-600">
              Where should we start writing rows? Leave as <strong>auto</strong> to append below existing data.
            </p>
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-700">Start from row:</label>
              <input
                type="text"
                value={startRow}
                onChange={e => setStartRow(e.target.value)}
                className="w-24 rounded border border-gray-200 px-3 py-1.5 text-sm"
              />
            </div>
            <p className="mt-1 text-xs text-gray-400">Type "auto" to append, or a row number (e.g. "2").</p>
            <div className="mt-6 flex justify-between">
              <button onClick={() => setStep(3)} className="text-xs text-gray-400 hover:text-gray-600">← Back</button>
              <button
                onClick={handleFinish}
                disabled={loading}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? "Saving…" : "Save & Finish"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

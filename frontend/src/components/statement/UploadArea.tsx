"use client";
import { useRef, useState } from "react";
import { uploadStatement } from "@/lib/api/statement";
import type { UploadResponse } from "@/lib/types/statement";

interface Props {
  onUploaded: (result: UploadResponse) => void;
}

export default function UploadArea({ onUploaded }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File) {
    setLoading(true);
    setError("");
    try {
      const result = await uploadStatement(file);
      if (result.transactions.length === 0) {
        setError("No transactions found. Make sure it's a bank statement PDF or CSV.");
        return;
      }
      onUploaded(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to parse statement");
    } finally {
      setLoading(false);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.csv"
        className="hidden"
        onChange={handleInputChange}
      />
      <button
        type="button"
        disabled={loading}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`w-full rounded-lg border-2 border-dashed px-4 py-8 text-sm disabled:opacity-50 ${
          dragOver
            ? "border-emerald-400 bg-emerald-50 text-emerald-600"
            : "border-gray-300 text-gray-500 hover:border-emerald-400 hover:text-emerald-600"
        }`}
      >
        {loading ? "Extracting transactions…" : "Click or drag a bank statement here (.pdf or .csv)"}
      </button>
      {error && (
        <p className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

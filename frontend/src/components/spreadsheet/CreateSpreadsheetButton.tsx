"use client";
import { useState } from "react";
import { downloadTemplate } from "@/lib/api/spreadsheet";

export default function CreateSpreadsheetButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function handleClick() {
    setStatus("loading");
    setError("");
    try {
      await downloadTemplate();
      setStatus("done");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Download failed");
      setStatus("error");
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={status === "loading"}
        className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {status === "loading" ? "Preparing…" : "Create New Spreadsheet"}
      </button>
      {status === "done" && (
        <p className="mt-1 text-sm text-emerald-600">
          FinanceFlow.xlsx downloaded — open it in Excel or LibreOffice.
        </p>
      )}
      {status === "error" && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

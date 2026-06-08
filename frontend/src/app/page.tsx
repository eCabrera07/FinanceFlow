"use client";
import { useState, useEffect } from "react";
import UploadArea from "@/components/statement/UploadArea";
import ReviewTable from "@/components/statement/ReviewTable";
import { getSpreadsheetStatus } from "@/lib/api/spreadsheet";
import type { Transaction, UploadResponse } from "@/lib/types/statement";

type StatementState = "idle" | "reviewing";

export default function HomePage() {
  const [statementState, setStatementState] = useState<StatementState>("idle");
  const [accumulatedTransactions, setAccumulatedTransactions] = useState<Transaction[]>([]);
  const [hasVolumeFile, setHasVolumeFile] = useState(false);

  useEffect(() => {
    getSpreadsheetStatus()
      .then((s) => setHasVolumeFile(s.has_volume_file))
      .catch(() => {});
  }, []);

  function refreshVolumeStatus() {
    getSpreadsheetStatus()
      .then((s) => setHasVolumeFile(s.has_volume_file))
      .catch(() => {});
  }

  function handleUploaded(result: UploadResponse) {
    setAccumulatedTransactions((prev) => [...prev, ...result.transactions]);
    setStatementState("reviewing");
  }

  function handleReviewDone() {
    setStatementState("idle");
    setAccumulatedTransactions([]);
    refreshVolumeStatus();
  }

  return (
    <main className={`mx-auto px-4 py-16 ${statementState === "reviewing" ? "max-w-5xl" : "max-w-2xl"}`}>
      <h1 className="mb-2 text-3xl font-bold text-gray-900">FinanceFlow</h1>
      <p className="mb-10 text-gray-500">
        Import bank statements, categorize transactions, track your spending.
      </p>

      {/* Statement import */}
      <section className="rounded-xl border border-gray-200 p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-800">Import a statement</h2>
        <p className="mb-5 text-sm text-gray-500">
          Upload a bank statement PDF or CSV. Review and edit categories before writing to your spreadsheet.
        </p>

        {statementState === "idle" && (
          <UploadArea onUploaded={handleUploaded} />
        )}

        {statementState === "reviewing" && (
          <ReviewTable
            transactions={accumulatedTransactions}
            hasVolumeFile={hasVolumeFile}
            onAddMore={handleUploaded}
            onDone={handleReviewDone}
          />
        )}
      </section>

    </main>
  );
}

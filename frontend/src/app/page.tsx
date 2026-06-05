"use client";
import { useState } from "react";
import CreateSpreadsheetButton from "@/components/spreadsheet/CreateSpreadsheetButton";
import ImportWizard from "@/components/spreadsheet/ImportWizard";

export default function HomePage() {
  const [showWizard, setShowWizard] = useState(false);
  const [mappingSet, setMappingSet] = useState(false);

  function handleWizardComplete() {
    setMappingSet(true);
    setShowWizard(false);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="mb-2 text-3xl font-bold text-gray-900">FinanceFlow</h1>
      <p className="mb-10 text-gray-500">
        Import bank statements, categorize transactions, track your spending.
      </p>

      {/* Spreadsheet setup section */}
      <section className="rounded-xl border border-gray-200 p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-800">Set up your spreadsheet</h2>
        <p className="mb-5 text-sm text-gray-500">
          Start with the default FinanceFlow template (includes charts + dashboard), or connect your own spreadsheet.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <CreateSpreadsheetButton />
          <span className="text-xs text-gray-400">or</span>
          <button
            type="button"
            onClick={() => setShowWizard(true)}
            className="text-sm font-medium text-emerald-700 underline-offset-2 hover:underline"
          >
            Use my own spreadsheet →
          </button>
        </div>

        {mappingSet && (
          <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
            ✓ Spreadsheet mapping saved. Future imports will write to your file automatically.
          </p>
        )}
      </section>

      {/* Placeholder for the upload section — implemented in a separate plan */}
      <section className="mt-6 rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
        Statement upload area — coming soon
      </section>

      {showWizard && (
        <ImportWizard onClose={() => setShowWizard(false)} onComplete={handleWizardComplete} />
      )}
    </main>
  );
}

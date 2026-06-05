"use client";
import { useState } from "react";
import { resetMapping } from "@/lib/api/spreadsheet";

export default function SettingsPage() {
  const [status, setStatus] = useState<"idle" | "confirming" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function handleConfirmedReset() {
    setStatus("loading");
    setError("");
    try {
      await resetMapping();
      setStatus("done");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Reset failed");
      setStatus("error");
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="mb-8 text-2xl font-bold text-gray-900">Settings</h1>

      <section className="rounded-xl border border-gray-200 p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-800">Spreadsheet Mapping</h2>
        <p className="mb-4 text-sm text-gray-500">
          If you've changed your spreadsheet layout, reset the mapping and re-run the setup wizard.
        </p>

        {status !== "confirming" ? (
          <button
            type="button"
            onClick={() => setStatus("confirming")}
            disabled={status === "loading"}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {status === "loading" ? "Resetting…" : "Reset Spreadsheet Mapping"}
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700">Are you sure?</span>
            <button
              type="button"
              onClick={handleConfirmedReset}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
            >
              Confirm Reset
            </button>
            <button
              type="button"
              onClick={() => setStatus("idle")}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        )}

        {status === "done" && <p className="mt-2 text-sm text-emerald-600">Mapping cleared.</p>}
        {status === "error" && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </section>
    </main>
  );
}

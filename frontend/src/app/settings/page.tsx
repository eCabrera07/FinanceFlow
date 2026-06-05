"use client";
import { useState } from "react";
import { resetMapping } from "@/lib/api/spreadsheet";

export default function SettingsPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function handleReset() {
    if (!confirm("Reset your spreadsheet mapping? The wizard will re-run on the next import.")) return;
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
        <button
          type="button"
          onClick={handleReset}
          disabled={status === "loading"}
          className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          {status === "loading" ? "Resetting…" : "Reset Spreadsheet Mapping"}
        </button>
        {status === "done" && <p className="mt-2 text-sm text-emerald-600">Mapping cleared.</p>}
        {status === "error" && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </section>
    </main>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type GenerateSnapshotButtonProps = {
  projectId: string;
};

export function GenerateSnapshotButton({ projectId }: GenerateSnapshotButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
   const [success, setSuccess] = useState<string | null>(null);
   const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    setSuccess(null);
    setError(null);

    try {
      const res = await fetch("/api/snapshot/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId })
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? "Failed to generate snapshot.");
        return;
      }

      setSuccess("Snapshot generated successfully.");
      router.refresh();
    } catch (e) {
      setError("Failed to generate snapshot.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded-lg bg-slate-100 px-6 py-3 text-sm font-medium text-slate-900 shadow-sm hover:bg-white disabled:opacity-60"
      >
        {loading ? "Generating…" : "Generate Initial Snapshot"}
      </button>
      {success && (
        <p className="text-xs text-emerald-400">
          {success}
        </p>
      )}
      {error && (
        <p className="text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

function isValidEthereumAddress(address: string): boolean {
  const trimmed = address.trim();
  return /^0x[a-fA-F0-9]{40}$/.test(trimmed);
}

type CreateWalletFormProps = {
  projectId: string;
};

export function CreateWalletForm({ projectId }: CreateWalletFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const rawAddress = (form.elements.namedItem("address") as HTMLInputElement)?.value ?? "";
    const address = rawAddress.trim();

    if (!isValidEthereumAddress(address)) {
      setError("Please enter a valid Ethereum address (0x...).");
      return;
    }

    const normalizedAddress = address.toLowerCase();

    setLoading(true);
    try {
      const res = await fetch("/api/wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: normalizedAddress, projectId })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to add wallet.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="address"
          className="mb-1 block text-xs font-medium text-slate-400"
        >
          Ethereum address
        </label>
        <input
          id="address"
          name="address"
          type="text"
          required
          placeholder="0x..."
          className="w-full max-w-md rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white disabled:opacity-60"
        >
          {loading ? "Adding..." : "Add wallet"}
        </button>
        <Link
          href="/dashboard"
          className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}


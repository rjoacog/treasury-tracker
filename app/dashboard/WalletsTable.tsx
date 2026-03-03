"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type WalletForTable = {
  id: string;
  address: string;
  networkName: string;
  createdAt: string;
};

type WalletsTableProps = {
  wallets: WalletForTable[];
};

function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

export function WalletsTable({ wallets }: WalletsTableProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (deletingId) return;
    const confirmed = window.confirm(
      "Are you sure you want to delete this wallet? All related daily snapshots will also be removed."
    );
    if (!confirmed) return;

    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch("/api/wallets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletId: id })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Failed to delete wallet.");
        return;
      }

      router.refresh();
    } catch (e) {
      setError("Failed to delete wallet.");
    } finally {
      setDeletingId(null);
    }
  }

  if (!wallets.length) {
    return (
      <p className="text-xs text-slate-500">
        No wallets added yet. Use &ldquo;Add Wallet&rdquo; to get started.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/40">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-950/60">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                Address
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                Network
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                Created
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900/80">
            {wallets.map((wallet) => (
              <tr key={wallet.id}>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-300">
                  {truncateAddress(wallet.address)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-300">
                  {wallet.networkName}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-300">
                  {formatDate(wallet.createdAt)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-xs">
                  <button
                    type="button"
                    onClick={() => handleDelete(wallet.id)}
                    disabled={deletingId === wallet.id}
                    className="rounded-md border border-red-800 px-2 py-1 text-xs font-medium text-red-200 hover:bg-red-950 disabled:opacity-60"
                  >
                    {deletingId === wallet.id ? "Deleting..." : "Delete"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


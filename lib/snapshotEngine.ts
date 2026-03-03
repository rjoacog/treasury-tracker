import { createServiceSupabaseClient } from "./supabase";
import { getChainAdapter } from "./chains";
import { getLatestBlockNumber, type EthereumTransaction } from "./chains/ethereum";

type WalletRow = {
  id: string;
  address: string;
};

type SnapshotInsert = {
  wallet_id: string;
  date: string;
  balance: number;
  gas_spent: number;
  tx_count: number;
  block_number?: number;
};

export type GenerateDailySnapshotResult = {
  snapshotDate: string;
  totalWallets: number;
  skippedExisting: number;
  inserted: number;
};

export type BackfillSnapshotsResult = {
  fromDate: string;
  toDate: string;
  days: number;
  totalWallets: number;
  skippedExisting: number;
  inserted: number;
};

function getSnapshotDate(): string {
  // Use current date in UTC, formatted as YYYY-MM-DD
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLast24HoursRange(): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
  return { from, to };
}

function weiToEth(valueWei: string): number {
  if (!valueWei) return 0;
  const asNumber = Number(valueWei);
  if (!Number.isFinite(asNumber)) {
    return 0;
  }
  return asNumber / 1e18;
}

/**
 * Generate a daily snapshot for all wallets in a project.
 *
 * - Fetches all wallets for the given project.
 * - For each wallet, fetches current balance and last 24h transactions
 *   using the Ethereum adapter.
 * - Computes gas spent and tx count.
 * - Inserts one row per wallet into daily_snapshots if not already present
 *   for the current date.
 */
export async function generateDailySnapshot(
  projectId: string
): Promise<GenerateDailySnapshotResult> {
  const supabase = createServiceSupabaseClient();
  const adapter = getChainAdapter("ethereum-mainnet");

  const snapshotDate = getSnapshotDate();
  const { from, to } = getLast24HoursRange();

  const latestBlockNumber = await getLatestBlockNumber();

  // 1) Fetch all wallets for the project
  const { data: wallets, error: walletsError } = await supabase
    .from("wallets")
    .select("id, address")
    .eq("project_id", projectId);

  if (walletsError) {
    throw walletsError;
  }

  const projectWallets: WalletRow[] = wallets ?? [];

  if (projectWallets.length === 0) {
    return {
      snapshotDate,
      totalWallets: 0,
      skippedExisting: 0,
      inserted: 0
    };
  }

  // 2) Find which wallets already have a snapshot for this date
  const walletIds = projectWallets.map((w) => w.id);

  const { data: existingSnapshots, error: existingError } = await supabase
    .from("daily_snapshots")
    .select("wallet_id")
    .eq("date", snapshotDate)
    .in("wallet_id", walletIds);

  if (existingError) {
    throw existingError;
  }

  const existingWalletIds = new Set(
    (existingSnapshots ?? []).map((row) => row.wallet_id as string)
  );

  const walletsToProcess = projectWallets.filter(
    (wallet) => !existingWalletIds.has(wallet.id)
  );

  if (walletsToProcess.length === 0) {
    return {
      snapshotDate,
      totalWallets: projectWallets.length,
      skippedExisting: projectWallets.length,
      inserted: 0
    };
  }

  // 3) For each wallet without snapshot, compute new snapshot data
  const snapshotPromises = walletsToProcess.map(async (wallet): Promise<SnapshotInsert | null> => {
    try {
      const [balanceWei, transactions] = await Promise.all([
        adapter.getBalance(wallet.address),
        adapter.getTransactions(wallet.address, from, to)
      ]);

      const gasSpentWei = adapter.calculateGasSpent(transactions);

      const balanceEth = weiToEth(balanceWei);
      const gasSpentEth = weiToEth(gasSpentWei);
      const txCount = transactions.length;

      return {
        wallet_id: wallet.id,
        date: snapshotDate,
        balance: balanceEth,
        gas_spent: gasSpentEth,
        tx_count: txCount,
        block_number: latestBlockNumber
      };
    } catch (error) {
      // Snapshot generation should be best-effort per wallet.
      // If one wallet fails, skip it and continue with others.
      console.error("Failed to generate snapshot for wallet", {
        walletId: wallet.id,
        address: wallet.address,
        error
      });
      return null;
    }
  });

  const snapshotResults = await Promise.all(snapshotPromises);
  const snapshotsToInsert = snapshotResults.filter(
    (s): s is SnapshotInsert => s !== null
  );

  if (snapshotsToInsert.length === 0) {
    return {
      snapshotDate,
      totalWallets: projectWallets.length,
      skippedExisting: projectWallets.length,
      inserted: 0
    };
  }

  // 4) Insert all new snapshots (omit block_number so DBs without that column still work)
  const rowsToInsert = snapshotsToInsert.map(
    ({ wallet_id, date, balance, gas_spent, tx_count }) => ({
      wallet_id,
      date,
      balance,
      gas_spent,
      tx_count
    })
  );
  const { error: insertError } = await supabase
    .from("daily_snapshots")
    .insert(rowsToInsert);

  if (insertError) {
    throw insertError;
  }

  return {
    snapshotDate,
    totalWallets: projectWallets.length,
    skippedExisting: existingWalletIds.size,
    inserted: snapshotsToInsert.length
  };
}

function buildDateRange(days: number): { fromDate: string; toDate: string; dates: string[] } {
  const today = new Date();
  const utcToday = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );

  const dates: string[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(utcToday);
    d.setUTCDate(d.getUTCDate() - i);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${day}`);
  }

  return {
    fromDate: dates[0],
    toDate: dates[dates.length - 1],
    dates
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Backfill snapshots for the last N days for a project.
 *
 * - Iterates over the last N days (default 7).
 * - For each wallet, fetches a single transaction list over the full window.
 * - Uses approximate block numbers per day to get a historical balance.
 * - Skips snapshots that already exist for (wallet_id, date).
 */
export async function backfillSnapshots(
  projectId: string,
  days = 7
): Promise<BackfillSnapshotsResult> {
  const effectiveDays = Math.min(Math.max(days, 0), 2);

  if (effectiveDays <= 0) {
    return {
      fromDate: "",
      toDate: "",
      days: effectiveDays,
      totalWallets: 0,
      skippedExisting: 0,
      inserted: 0
    };
  }

  if (days > 2) {
    console.warn(
      `backfillSnapshots called with days=${days}, capping to ${effectiveDays} days to protect RPC usage.`
    );
  }

  const supabase = createServiceSupabaseClient();
  const adapter = getChainAdapter("ethereum-mainnet");

  const { fromDate, toDate, dates } = buildDateRange(effectiveDays);

  // 1) Fetch wallets for the project
  const { data: wallets, error: walletsError } = await supabase
    .from("wallets")
    .select("id, address")
    .eq("project_id", projectId);

  if (walletsError) {
    throw walletsError;
  }

  const projectWallets: WalletRow[] = wallets ?? [];

  if (projectWallets.length === 0) {
    return {
      fromDate,
      toDate,
      days,
      totalWallets: 0,
      skippedExisting: 0,
      inserted: 0
    };
  }

  const walletIds = projectWallets.map((w) => w.id);

  // 2) Find existing snapshots in the range to avoid duplicates
  const { data: existingSnapshots, error: existingError } = await supabase
    .from("daily_snapshots")
    .select("wallet_id, date")
    .gte("date", fromDate)
    .lte("date", toDate)
    .in("wallet_id", walletIds);

  if (existingError) {
    throw existingError;
  }

  const existingKeys = new Set(
    (existingSnapshots ?? []).map(
      (row) => `${row.wallet_id as string}-${row.date as string}`
    )
  );

  // 3) Precompute approximate block number per date
  const latestBlockNumber = await getLatestBlockNumber();
  const blocksPerDayApprox = 7200; // ~12s block time

  const blockNumberByDate = new Map<string, number>();
  const totalDays = dates.length;

  dates.forEach((date, index) => {
    const daysAgo = totalDays - 1 - index;
    const blockNumber = Math.max(
      0,
      latestBlockNumber - blocksPerDayApprox * daysAgo
    );
    blockNumberByDate.set(date, blockNumber);
  });

  // 4) For each wallet, compute snapshots per day
  const snapshotsToInsert: SnapshotInsert[] = [];

  const rangeStart = new Date(`${fromDate}T00:00:00.000Z`);
  const rangeEnd = new Date(`${toDate}T23:59:59.999Z`);

  for (const wallet of projectWallets) {
    try {
      // Small delay between wallets to avoid hitting RPC rate limits too aggressively.
      await sleep(150);
      const transactions = await adapter.getTransactions(
        wallet.address,
        rangeStart,
        rangeEnd
      );

      const txsByDate = new Map<string, EthereumTransaction[]>();
      for (const tx of transactions) {
        const key = tx.timestamp.toISOString().slice(0, 10);
        if (!dates.includes(key)) continue;
        const list = txsByDate.get(key) ?? [];
        list.push(tx);
        txsByDate.set(key, list);
      }

      for (const date of dates) {
        const key = `${wallet.id}-${date}`;
        if (existingKeys.has(key)) {
          continue;
        }

        const blockNumber = blockNumberByDate.get(date);
        if (blockNumber === undefined) {
          continue;
        }

        const balanceWei = await adapter.getBalanceAtBlock(
          wallet.address,
          blockNumber
        );
        const balanceEth = weiToEth(balanceWei);

        const dayTxs = txsByDate.get(date) ?? [];
        const gasSpentWei = adapter.calculateGasSpent(dayTxs);
        const gasSpentEth = weiToEth(gasSpentWei);
        const txCount = dayTxs.length;

        snapshotsToInsert.push({
          wallet_id: wallet.id,
          date,
          balance: balanceEth,
          gas_spent: gasSpentEth,
          tx_count: txCount,
          block_number: blockNumber
        });
      }
    } catch (error) {
      console.error("Failed to backfill snapshots for wallet", {
        walletId: wallet.id,
        address: wallet.address,
        error
      });
    }
  }

  if (snapshotsToInsert.length === 0) {
    return {
      fromDate,
      toDate,
      days,
      totalWallets: projectWallets.length,
      skippedExisting: existingKeys.size,
      inserted: 0
    };
  }

  const rowsToInsert = snapshotsToInsert.map(
    ({ wallet_id, date, balance, gas_spent, tx_count }) => ({
      wallet_id,
      date,
      balance,
      gas_spent,
      tx_count
    })
  );
  const { error: insertError } = await supabase
    .from("daily_snapshots")
    .insert(rowsToInsert);

  if (insertError) {
    throw insertError;
  }

  return {
    fromDate,
    toDate,
    days,
    totalWallets: projectWallets.length,
    skippedExisting: existingKeys.size,
    inserted: snapshotsToInsert.length
  };
}



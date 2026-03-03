import { BalanceChart } from "./BalanceChart";
import { GenerateSnapshotButton } from "./GenerateSnapshotButton";
import { WalletsTable } from "./WalletsTable";
import { createServerSupabaseClient } from "../../lib/supabaseServer";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

type SnapshotRow = {
  date: string;
  balance: number | string | null;
  gas_spent: number | string | null;
  tx_count: number | string | null;
};

type LatestSnapshotRow = {
  id: number;
  date: string;
  balance: number | string | null;
  gas_spent: number | string | null;
  tx_count: number | null;
  wallets: {
    address: string;
    project_id: string;
  }[] | null;
};

type ProjectWalletRow = {
  id: string;
  address: string;
  created_at: string;
  networks:
    | { name: string }
    | null
    | {
        name: string;
      }[];
};

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2
  }).format(value);
}

function formatSigned(value: number): string {
  const formatted = formatNumber(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

function truncateAddress(address: string | null | undefined): string {
  if (!address) return "-";
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const userId = user.id;

  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, name, created_at, user_id")
    .order("created_at", { ascending: true });

  if (projectsError) {
    console.error("Error loading projects", { projectsError });
  }

  const allProjects = projects ?? [];
  const userProjects = allProjects.filter((project) => project.user_id === userId);

  if (!userProjects.length) {
    return (
      <section className="space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
            Project dashboard
          </h1>
          <p className="text-sm text-slate-400">
            You do not have any projects yet.
          </p>
        </header>
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-5 text-sm text-slate-300">
          <p className="mb-3">Create your first project to start tracking on-chain balances.</p>
          <a
            href="/dashboard/projects/new"
            className="inline-flex items-center rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-900 shadow-sm hover:bg-white"
          >
            Create project
          </a>
        </div>
      </section>
    );
  }

  const cookieStore = await cookies();
  const cookieProject = cookieStore.get("tt_project_id");
  const cookieProjectId = cookieProject?.value ?? null;

  let selectedProjectId: string | null =
    cookieProjectId && userProjects.some((p) => p.id === cookieProjectId)
      ? cookieProjectId
      : null;

  if (!selectedProjectId) {
    if (userProjects.length === 1) {
      selectedProjectId = userProjects[0].id;
    } else {
      selectedProjectId = userProjects[0].id;
    }
  }

  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - 6);
  const fromDateStr = from.toISOString().slice(0, 10);

  const [
    { data: projectWallets },
    { data: aggregated, error: aggregatedError },
    { data: latest, error: latestError }
  ] = await Promise.all([
    supabase
      .from("wallets")
      .select("id, address, created_at, networks(name)")
      .eq("project_id", selectedProjectId),
    supabase
      .from("daily_snapshots")
      .select("date, balance, gas_spent, tx_count, wallets!inner(project_id)")
      .gte("date", fromDateStr)
      .eq("wallets.project_id", selectedProjectId)
      .order("date", { ascending: true }),
    supabase
      .from("daily_snapshots")
      .select("id, date, balance, gas_spent, tx_count, wallets!inner(address, project_id)")
      .eq("wallets.project_id", selectedProjectId)
      .order("date", { ascending: false })
      .limit(20)
  ]);

  if (aggregatedError || latestError) {
    console.error("Error loading dashboard data", { aggregatedError, latestError });
  }

  const walletsList = (projectWallets ?? []) as unknown as ProjectWalletRow[];
  const hasWallets = walletsList.length > 0;
  const safeSnapshots: SnapshotRow[] = aggregated ?? [];
  const safeLatest: LatestSnapshotRow[] = latest ?? [];
  const hasSnapshots = safeSnapshots.length > 0 || safeLatest.length > 0;

  if (hasWallets && !hasSnapshots) {
    return (
      <section className="space-y-8">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
            Project dashboard
          </h1>
          <p className="text-sm text-slate-400">
            No snapshot data yet. Generate an initial snapshot to see metrics.
          </p>
        </header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {userProjects.length > 1 && (
            <form
              action="/dashboard/select-project"
              method="post"
              className="flex items-center gap-2 text-xs"
            >
              <label htmlFor="projectId" className="text-slate-400">
                Project
              </label>
              <select
                id="projectId"
                name="projectId"
                defaultValue={selectedProjectId ?? undefined}
                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
              >
                {userProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-md border border-slate-700 px-2 py-1 text-xs font-medium text-slate-100 hover:bg-slate-900"
              >
                Load
              </button>
            </form>
          )}
        </div>
        <div className="flex flex-col items-center justify-center rounded-lg border border-slate-800 bg-slate-950/40 p-10 text-center">
          <p className="mb-4 text-sm text-slate-300">
            Generate an initial snapshot to populate balance, gas, and transaction metrics.
          </p>
          <GenerateSnapshotButton projectId={selectedProjectId!} />
        </div>
      </section>
    );
  }

  if (!hasWallets) {
    return (
      <section className="space-y-8">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
            Project dashboard
          </h1>
          <p className="text-sm text-slate-400">
            Add at least one wallet to start tracking.
          </p>
        </header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {userProjects.length > 1 && (
            <form
              action="/dashboard/select-project"
              method="post"
              className="flex items-center gap-2 text-xs"
            >
              <label htmlFor="projectId" className="text-slate-400">
                Project
              </label>
              <select
                id="projectId"
                name="projectId"
                defaultValue={selectedProjectId ?? undefined}
                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
              >
                {userProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-md border border-slate-700 px-2 py-1 text-xs font-medium text-slate-100 hover:bg-slate-900"
              >
                Load
              </button>
            </form>
          )}
        </div>
        <div className="flex flex-col items-center justify-center rounded-lg border border-slate-800 bg-slate-950/40 p-10 text-center">
          <p className="mb-4 text-sm text-slate-300">
            Add at least one wallet to start tracking.
          </p>
          <a
            href="/dashboard/wallets/new"
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-white"
          >
            Add Wallet
          </a>
        </div>
      </section>
    );
  }

  const byDate = new Map<
    string,
    {
      balance: number;
      gas: number;
      tx: number;
    }
  >();

  for (const row of safeSnapshots) {
    const dateKey = row.date;
    const existing =
      byDate.get(dateKey) ??
      {
        balance: 0,
        gas: 0,
        tx: 0
      };

    existing.balance += toNumber(row.balance);
    existing.gas += toNumber(row.gas_spent);
    existing.tx += toNumber(row.tx_count);

    byDate.set(dateKey, existing);
  }

  const chartData = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { balance, gas, tx }]) => ({
      date,
      balance,
      gas,
      tx
    }));

  const currentTotalBalance = chartData.length ? chartData[chartData.length - 1].balance : 0;
  const firstBalance = chartData.length ? chartData[0].balance : 0;
  const sevenDayBalanceChange = currentTotalBalance - firstBalance;
  const sevenDayGasSpent = chartData.reduce((sum, d) => sum + d.gas, 0);
  const sevenDayTxCount = chartData.reduce((sum, d) => sum + d.tx, 0);

  return (
    <section className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Project dashboard
        </h1>
        <p className="text-sm text-slate-400">
          High-level view of your on-chain treasury over the last 7 days.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-400">
          {userProjects.length === 1
            ? "Showing metrics for your only project."
            : "Select which project to view."}
        </div>
        <div className="flex items-center gap-2 text-xs">
          {userProjects.length > 1 && (
            <form
              action="/dashboard/select-project"
              method="post"
              className="flex items-center gap-2"
            >
              <label htmlFor="projectId" className="text-slate-400">
                Project
              </label>
              <select
                id="projectId"
                name="projectId"
                defaultValue={selectedProjectId ?? undefined}
                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
              >
                {userProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-md border border-slate-700 px-2 py-1 text-xs font-medium text-slate-100 hover:bg-slate-900"
              >
                Load
              </button>
            </form>
          )}
          <a
            href="/dashboard/report"
            className="inline-flex items-center rounded-md border border-slate-700 px-2 py-1 text-xs font-medium text-slate-100 hover:bg-slate-900"
          >
            Download weekly CSV
          </a>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Current total balance"
          value={formatNumber(currentTotalBalance)}
        />
        <MetricCard
          label="7-day balance change"
          value={formatSigned(sevenDayBalanceChange)}
        />
        <MetricCard label="7-day gas spent" value={formatNumber(sevenDayGasSpent)} />
        <MetricCard
          label="7-day transaction count"
          value={formatNumber(sevenDayTxCount)}
        />
      </div>

      <BalanceChart
        data={chartData.map((point) => ({
          date: point.date,
          balance: point.balance
        }))}
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-200">
            Latest activity (daily snapshots)
          </h2>
          <span className="text-xs text-slate-500">
            Showing the last 20 snapshot entries
          </span>
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/40">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-950/60">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  Date
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  Wallet
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                  Balance
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                  Gas spent
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                  Tx count
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/80">
              {safeLatest.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-xs text-slate-500"
                  >
                    No snapshot data available yet.
                  </td>
                </tr>
              ) : (
                safeLatest.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-300">
                      {new Date(row.date).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric"
                      })}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-300">
                      {truncateAddress(row.wallets?.[0]?.address)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-xs text-slate-300">
                      {formatNumber(toNumber(row.balance))}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-xs text-slate-300">
                      {formatNumber(toNumber(row.gas_spent))}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-xs text-slate-300">
                      {formatNumber(toNumber(row.tx_count))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-200">Wallets</h2>
          <a
            href="/dashboard/wallets/new"
            className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-900 shadow-sm hover:bg-white"
          >
            Add Wallet
          </a>
        </div>
        <WalletsTable
          wallets={walletsList.map((wallet) => ({
            id: wallet.id,
            address: wallet.address,
            networkName: Array.isArray(wallet.networks)
              ? wallet.networks[0]?.name ?? "Unknown network"
              : wallet.networks?.name ?? "Unknown network",
            createdAt: wallet.created_at
          }))}
        />
      </div>
    </section>
  );
}

type MetricCardProps = {
  label: string;
  value: string;
};

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-slate-50">{value}</div>
    </div>
  );
}


import { cookies } from "next/headers";
import { createServerSupabaseClient } from "../../../lib/supabase";

type SnapshotRow = {
  date: string;
  balance: number | string | null;
  gas_spent: number | string | null;
  tx_count: number | string | null;
};

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function escapeCsv(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function slugifyProjectName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project"
  );
}

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const userId = process.env.DEFAULT_USER_ID;

    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("id, name, created_at, user_id")
      .order("created_at", { ascending: true });

    if (projectsError) {
      console.error("Error loading projects for report", { projectsError });
      return new Response("Failed to load projects.", { status: 500 });
    }

    const allProjects = projects ?? [];
    const userProjects = userId
      ? allProjects.filter((project) => project.user_id === userId)
      : allProjects;

    if (!userProjects.length) {
      return new Response("No projects available for this user.", { status: 400 });
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

    const selectedProject = userProjects.find((p) => p.id === selectedProjectId);

    if (!selectedProject) {
      return new Response("Selected project not found.", { status: 404 });
    }

    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - 6);
    const fromDateStr = from.toISOString().slice(0, 10);

    const { data: snapshots, error: snapshotsError } = await supabase
      .from("daily_snapshots")
      .select("date, balance, gas_spent, tx_count, wallets!inner(project_id)")
      .gte("date", fromDateStr)
      .eq("wallets.project_id", selectedProjectId)
      .order("date", { ascending: true });

    if (snapshotsError) {
      console.error("Error loading snapshots for report", { snapshotsError });
      return new Response("Failed to load snapshot data.", { status: 500 });
    }

    const safeSnapshots: SnapshotRow[] = snapshots ?? [];

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

    const dailyRows = Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { balance, gas, tx }]) => ({
        date,
        balance,
        gas,
        tx
      }));

    const totalBalance = dailyRows.reduce((sum, d) => sum + d.balance, 0);
    const totalGas = dailyRows.reduce((sum, d) => sum + d.gas, 0);
    const totalTx = dailyRows.reduce((sum, d) => sum + d.tx, 0);

    const lines: string[] = [];
    lines.push("date,total_balance,gas_spent,tx_count");

    for (const row of dailyRows) {
      lines.push(
        [
          escapeCsv(row.date),
          escapeCsv(row.balance.toFixed(6)),
          escapeCsv(row.gas.toFixed(6)),
          escapeCsv(row.tx)
        ].join(",")
      );
    }

    lines.push(
      [
        escapeCsv("TOTAL"),
        escapeCsv(totalBalance.toFixed(6)),
        escapeCsv(totalGas.toFixed(6)),
        escapeCsv(totalTx)
      ].join(",")
    );

    const csv = lines.join("\n");

    const projectSlug = slugifyProjectName(selectedProject.name);
    const todayStr = new Date().toISOString().slice(0, 10);
    const filename = `treasury-report-${projectSlug}-${todayStr}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    console.error("Error generating weekly CSV report", error);
    return new Response("Failed to generate report.", { status: 500 });
  }
}


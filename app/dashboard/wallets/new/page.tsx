import Link from "next/link";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "../../../../lib/supabase";
import { CreateWalletForm } from "./CreateWalletForm";

export default async function NewWalletPage() {
  const supabase = createServerSupabaseClient();
  const userId = process.env.DEFAULT_USER_ID;

  if (!userId) {
    return (
      <section className="space-y-4">
        <p className="text-sm text-slate-400">
          Wallet creation is not configured. Set DEFAULT_USER_ID in .env.local.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-900"
        >
          Back to dashboard
        </Link>
      </section>
    );
  }

  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, name, user_id")
    .order("created_at", { ascending: true });

  if (projectsError) {
    console.error("Error loading projects for wallet creation", { projectsError });
  }

  const allProjects = projects ?? [];
  const userProjects = allProjects.filter((project) => project.user_id === userId);

  if (!userProjects.length) {
    return (
      <section className="space-y-4">
        <p className="text-sm text-slate-400">
          You need a project before you can add a wallet.
        </p>
        <Link
          href="/dashboard/projects/new"
          className="inline-flex items-center rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-900 shadow-sm hover:bg-white"
        >
          Create project
        </Link>
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
    selectedProjectId = userProjects[0].id;
  }

  const selectedProject = userProjects.find((p) => p.id === selectedProjectId);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Add wallet
        </h1>
        <p className="text-sm text-slate-400">
          Wallets are attached to{" "}
          <span className="font-medium text-slate-200">
            {selectedProject?.name ?? "this project"}
          </span>
          .
        </p>
      </header>
      <CreateWalletForm projectId={selectedProjectId} />
    </section>
  );
}


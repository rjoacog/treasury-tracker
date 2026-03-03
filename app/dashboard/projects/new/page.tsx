import Link from "next/link";
import { CreateProjectForm } from "./CreateProjectForm";

export default async function NewProjectPage() {
  const userId = process.env.DEFAULT_USER_ID;
  if (!userId) {
    return (
      <section className="space-y-4">
        <p className="text-sm text-slate-400">
          Project creation is not configured. Set DEFAULT_USER_ID in .env.local.
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

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Create project
        </h1>
        <p className="text-sm text-slate-400">
          Add a new project to track on-chain balances.
        </p>
      </header>
      <CreateProjectForm />
    </section>
  );
}

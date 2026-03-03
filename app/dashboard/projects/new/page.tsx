import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "../../../../lib/supabaseServer";
import { CreateProjectForm } from "./CreateProjectForm";

export default async function NewProjectPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
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

import Link from "next/link";

export default function LoginPage() {
  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Login
        </h1>
        <p className="text-sm text-slate-400">
          You have been logged out. For now, authentication is simulated with a default user.
        </p>
      </header>
      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-5 text-sm text-slate-300 space-y-3">
        <p>
          This project does not yet have a full Supabase Auth flow. When you are ready to
          add it, this page is where the real login form will live.
        </p>
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-white"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </section>
  );
}


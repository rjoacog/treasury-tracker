import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Login
        </h1>
        <p className="text-sm text-slate-400">
          Sign in with your Supabase email and password.
        </p>
      </header>
      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-5 text-sm text-slate-300">
        <LoginForm />
      </div>
    </section>
  );
}



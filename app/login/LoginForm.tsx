"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "../../lib/supabaseBrowser";

const supabase = createBrowserSupabaseClient();

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email || !password) {
      setError("Please enter email and password.");
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (signInError) {
          setError(signInError.message || "Failed to sign in.");
          return;
        }

        router.push("/dashboard");
        router.refresh();
      } else {
        const {
          data,
          error: signUpError
        } = await supabase.auth.signUp({
          email,
          password
        });

        if (signUpError) {
          setError(signUpError.message || "Failed to sign up.");
          return;
        }

        if (data.session) {
          // Email confirmations disabled or auto-confirmed
          router.push("/dashboard");
          router.refresh();
        } else {
          // Email confirmations enabled
          setSuccess("Check your email to confirm your account, then come back to sign in.");
        }
      }
    } catch (err) {
      setError(mode === "signin" ? "Failed to sign in." : "Failed to sign up.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div>
        <label
          className="mb-1 block text-xs font-medium text-slate-400"
          htmlFor="password"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {mode === "signup" && (
        <div>
          <label
            className="mb-1 block text-xs font-medium text-slate-400"
            htmlFor="confirm-password"
          >
            Confirm password
          </label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required={mode === "signup"}
          />
        </div>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
      {success && <p className="text-xs text-emerald-400">{success}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white disabled:opacity-60"
      >
        {loading ? (mode === "signin" ? "Signing in..." : "Creating account...") : mode === "signin" ? "Sign in" : "Sign up"}
      </button>
      <p className="mt-2 text-xs text-slate-500">
        {mode === "signin"
          ? "Don't have an account yet? "
          : "Already have an account? "}
        <button
          type="button"
          className="underline underline-offset-2 text-slate-300"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setSuccess(null);
          }}
        >
          {mode === "signin" ? "Create one" : "Sign in instead"}
        </button>
      </p>
    </form>
  );
}


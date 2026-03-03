"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createBrowserSupabaseClient } from "../lib/supabaseBrowser";

const supabase = createBrowserSupabaseClient();

export function LogoutButton() {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  // Do not show logout button on the login page
  if (pathname.startsWith("/login")) {
    return null;
  }

  async function handleLogout() {
    if (loading) return;
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error during logout", error);
    } finally {
      setLoading(false);
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="inline-flex items-center rounded-md border border-slate-700 px-2 py-1 text-xs font-medium text-slate-100 hover:bg-slate-900 disabled:opacity-60"
    >
      {loading ? "Signing out…" : "Logout"}
    </button>
  );
}


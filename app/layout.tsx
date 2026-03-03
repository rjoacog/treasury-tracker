import "./globals.css";
import type { ReactNode } from "react";
import { LogoutButton } from "./LogoutButton";

export const metadata = {
  title: "Treasury Tracker",
  description: "Minimal SaaS para tesorería on-chain"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-950 text-slate-50 antialiased">
        <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-6">
          <header className="mb-6 flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="text-lg font-semibold tracking-tight">
              Treasury Tracker
            </div>
            <LogoutButton />
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}


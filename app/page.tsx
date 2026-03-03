export default function HomePage() {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Treasury Tracker
        </h1>
        <p className="mx-auto max-w-xl text-sm text-slate-300 sm:text-base">
          SaaS minimalista para monitorizar tesorerías on-chain. Autenticación
          con magic link, proyectos y wallets multi-network (empezando por
          Ethereum mainnet).
        </p>
      </div>
      <div className="flex gap-3">
        <a
          href="/login"
          className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-white"
        >
          Entrar con email
        </a>
        <a
          href="/dashboard"
          className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-900"
        >
          Ir al dashboard
        </a>
      </div>
    </section>
  );
}


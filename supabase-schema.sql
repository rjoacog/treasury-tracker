-- Esquema de base de datos para Treasury Tracker en Supabase

-- Tabla de proyectos (relacionada con auth.users)
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- Tabla de redes
create table if not exists public.networks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  chain_id integer not null,
  rpc_provider text,
  created_at timestamptz not null default now(),
  constraint networks_name_unique unique (name),
  constraint networks_chain_id_unique unique (chain_id)
);

-- Tabla de wallets
create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  address text not null,
  network_id uuid not null references public.networks (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint wallets_project_address_network_unique unique (project_id, address, network_id)
);

-- Tabla de snapshots diarios
create table if not exists public.daily_snapshots (
  id bigserial primary key,
  wallet_id uuid not null references public.wallets (id) on delete cascade,
  date date not null,
  balance numeric not null,
  gas_spent numeric not null default 0,
  tx_count integer not null default 0,
  block_number bigint,
  constraint daily_snapshots_wallet_date_unique unique (wallet_id, date)
);

-- If the table already existed before block_number was added, run once:
-- alter table public.daily_snapshots add column block_number bigint;

-- Insertar automáticamente Ethereum Mainnet en networks
insert into public.networks (name, chain_id, rpc_provider)
values (
  'Ethereum Mainnet',
  1,
  'https://mainnet.infura.io/v3/TU_API_KEY'
)
on conflict (chain_id) do nothing;


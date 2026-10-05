create table public.campaigns(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  status text not null default 'draft',   -- draft | paused | active
  score int,                               -- Ad Health Score 0-100
  cost_usd numeric(10,4) not null default 0,
  credits int not null default 0,
  data jsonb not null default '{}',        -- copy (bn/en), hook, targeting brief, video url, audit, Meta ids
  created_at timestamptz not null default now());
create index on public.campaigns(user_id,created_at desc);
alter table public.campaigns enable row level security;
create policy "users manage own campaigns" on public.campaigns for all using (user_id=auth.uid()) with check (user_id=auth.uid());

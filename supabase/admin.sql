-- Run once in Supabase SQL Editor (after schema.sql).
create table public.profiles(
  id uuid primary key references auth.users on delete cascade,
  email text, name text,
  role text not null default 'user' check (role in ('user','super_admin')),
  credits int not null default 0 check (credits>=0),
  blocked boolean not null default false,
  created_at timestamptz not null default now());
create table public.credit_log(
  id bigserial primary key,
  user_id uuid references auth.users on delete cascade,
  delta int not null, balance int not null, note text, by_email text,
  created_at timestamptz not null default now());
alter table public.profiles enable row level security;
alter table public.credit_log enable row level security;
create policy "read own profile" on public.profiles for select using (id=auth.uid());
create policy "read own log" on public.credit_log for select using (user_id=auth.uid());

create function public.new_profile() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into profiles(id,email) values(new.id,new.email) on conflict do nothing; return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.new_profile();
insert into public.profiles(id,email) select id,email from auth.users on conflict do nothing;

-- Atomic add/deduct (returns new balance, or -1 if it would go below 0). Only the server (service key) can call it.
create function public.adjust_credits(uid uuid,d int,why text,who text) returns int language plpgsql security definer set search_path=public as $$
declare b int;
begin
  update profiles set credits=credits+d where id=uid and credits+d>=0 returning credits into b;
  if b is null then return -1; end if;
  insert into credit_log(user_id,delta,balance,note,by_email) values(uid,d,b,why,who);
  return b;
end $$;
revoke all on function public.adjust_credits(uuid,int,text,text) from public,anon,authenticated;

-- Make yourself super admin (change the email), then open /admin.html:
-- update public.profiles set role='super_admin' where email='YOU@example.com';

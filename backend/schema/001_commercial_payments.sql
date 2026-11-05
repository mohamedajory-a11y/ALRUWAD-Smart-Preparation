-- ALRUWAD Smart Preparation: isolated commercial schema (NOT deployed).
-- Apply only to a dedicated project after review. Requires Supabase auth.users.
create extension if not exists pgcrypto;
create table if not exists public.ruwad_plans (
 id text primary key, name_ar text not null, price_lyd numeric(10,2) not null check(price_lyd>=0),
 generation_limit integer not null check(generation_limit>=0), duration_days integer not null check(duration_days>0),
 active boolean not null default true
);
create table if not exists public.ruwad_payment_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 plan_id text not null references public.ruwad_plans(id),
 amount_lyd numeric(10,2) not null check(amount_lyd>=0),
 reference text not null unique default ('RW-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
 status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled')),
 payer_note text not null default '' check(length(payer_note)<=1000),
 transfer_reference text check(length(transfer_reference)<=150),
 submitted_at timestamptz not null default now(),
 reviewed_at timestamptz, reviewed_by uuid references auth.users(id),
 admin_note text,
 unique(id,user_id)
);
create table if not exists public.ruwad_subscriptions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 plan_id text not null references public.ruwad_plans(id),
 payment_request_id uuid not null unique references public.ruwad_payment_requests(id),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 generation_limit integer not null check(generation_limit>=0),
 generations_used integer not null default 0 check(generations_used>=0 and generations_used<=generation_limit),
 check(ends_at>starts_at)
);
create table if not exists public.ruwad_payment_audit (
 id bigint generated always as identity primary key,
 request_id uuid not null references public.ruwad_payment_requests(id),
 actor_id uuid not null references auth.users(id),
 action text not null check(action in ('approve','reject')),
 created_at timestamptz not null default now(),
 note text
);
create index if not exists ruwad_payments_user_idx on public.ruwad_payment_requests(user_id,submitted_at desc);
create index if not exists ruwad_subscriptions_user_idx on public.ruwad_subscriptions(user_id,ends_at desc);
alter table public.ruwad_plans enable row level security;
alter table public.ruwad_payment_requests enable row level security;
alter table public.ruwad_subscriptions enable row level security;
alter table public.ruwad_payment_audit enable row level security;
-- Users can only read their own payment requests and subscriptions.
create policy ruwad_plans_read on public.ruwad_plans for select to authenticated using(active=true);
create policy ruwad_payments_own_read on public.ruwad_payment_requests for select to authenticated using((select auth.uid())=user_id);
create policy ruwad_subscriptions_own_read on public.ruwad_subscriptions for select to authenticated using((select auth.uid())=user_id);
-- No client INSERT/UPDATE/DELETE on payment, subscription or audit tables.
-- Only a trusted backend using a secret server-side key can create requests and approve them.
-- A single server-side transaction must:
-- 1. Lock request FOR UPDATE, require pending status.
-- 2. Confirm bank transfer independently and exact amount/recipient.
-- 3. Approve request; create subscription with server-derived price/limits/dates.
-- 4. Write audit row; commit atomically.
-- Never infer payment success from a user-submitted receipt.
-- In a dedicated project only, provision plans with an administrator-controlled script.

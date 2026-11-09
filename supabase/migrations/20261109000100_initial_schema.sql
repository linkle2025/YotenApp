-- =============================================================================
-- 陽てん塾 命式作成アプリ（新版）の初期スキーマ
-- 仕様: 新仕様書/03_構造.md 3.5（権限）・3.7（データの形）
--
-- 方針
-- - すべてのテーブルで RLS（行単位のアクセス制御）を有効にする
-- - 会員は自分のデータだけを読み書きできる。管理者でも他人の鑑定記録は読まない（件数だけ）
-- - 計算結果（readings.result）と判定の要点（insights）は、サーバー（service_role）だけが書き込む
--   （画面からの改ざんを防ぐ。会員が直接変えられるのは氏名・お気に入りなど一部の列だけ）
-- - 役割（role）と利用状態（status）は管理者だけが変えられる（専用の関数経由）
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 共通：updated_at の自動更新
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles：会員のプロフィール（auth.users と1対1）
-- 本人の生年月日などは readings の本人分（is_self）に持つ
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 50),
  role text not null default 'general' check (role in ('general', 'fortuneteller', 'admin')),
  display_mode text not null default 'business' check (display_mode in ('business', 'parent')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  self_reading_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is '会員のプロフィール。会員登録時に自動で作る';
comment on column public.profiles.self_reading_id is '本人の鑑定記録（readings.id）。プロフィール未入力なら null';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- readings：鑑定記録（命式作成の入力と計算結果）
-- -----------------------------------------------------------------------------
create table public.readings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  is_self boolean not null default false,
  name text check (char_length(name) <= 100),
  birth_date date not null check (birth_date between '1901-01-06' and '2040-12-31'),
  birth_time time,
  hour_unknown boolean not null default false,
  birth_place text not null check (birth_place ~ '^(0[1-9]|[1-3][0-9]|4[0-7])$'),
  gender text not null check (gender in ('male', 'female')),
  result jsonb not null,
  calc_version text not null,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint readings_time_matches_unknown check (hour_unknown = (birth_time is null))
);

comment on table public.readings is '鑑定記録。計算結果（result）はサーバーの計算ロジック（@yoten/meishiki）が書く';
comment on column public.readings.birth_place is '出生地の都道府県コード（JIS 01〜47）';
comment on column public.readings.result is '命式の計算結果（四柱・蔵干・通変星・五行・身旺身弱・格局・干合・大運）';
comment on column public.readings.calc_version is '計算ロジックの版。ロジックを直したときの再計算の目印';

create index readings_owner_created_idx on public.readings (owner_id, created_at desc);
create index readings_owner_favorite_idx on public.readings (owner_id) where is_favorite;
create unique index readings_one_self_per_owner_idx on public.readings (owner_id) where is_self;

create trigger readings_set_updated_at
  before update on public.readings
  for each row execute function public.set_updated_at();

alter table public.profiles
  add constraint profiles_self_reading_fk
  foreign key (self_reading_id) references public.readings (id) on delete set null;

-- -----------------------------------------------------------------------------
-- insights：判定の要点（AIが生成した解説）
-- -----------------------------------------------------------------------------
create table public.insights (
  id uuid primary key default gen_random_uuid(),
  reading_id uuid not null references public.readings (id) on delete cascade,
  input_hash text not null,
  prompt_version text not null,
  model_name text not null,
  context jsonb,
  content jsonb not null,
  input_tokens integer,
  output_tokens integer,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.insights is '判定の要点。入力（点数・解釈ルール・プロンプト版・モデル）のハッシュで、古い解説を見分ける';

create index insights_reading_hash_idx on public.insights (reading_id, input_hash);
create index insights_created_by_idx on public.insights (created_by, created_at);

-- -----------------------------------------------------------------------------
-- stems・stars：十干・通変星の解説（誰でも読める）
-- -----------------------------------------------------------------------------
create table public.stems (
  name text primary key check (char_length(name) = 1),
  slug text not null unique,
  reading text not null,
  element_type text not null default '',
  description text not null default '',
  personality text not null default '',
  strengths text not null default '',
  weaknesses text not null default '',
  sort_order integer not null,
  updated_at timestamptz not null default now()
);

create table public.stars (
  name text primary key,
  slug text not null unique,
  reading text not null,
  character text not null default '',
  talents text not null default '',
  weaknesses text not null default '',
  sort_order integer not null,
  updated_at timestamptz not null default now()
);

create trigger stems_set_updated_at before update on public.stems
  for each row execute function public.set_updated_at();
create trigger stars_set_updated_at before update on public.stars
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 管理者かどうか（RLS と管理用の関数で使う）
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and status = 'active'
  );
$$;

comment on function public.is_admin() is 'ログイン中の会員が、利用中の管理者か';

-- -----------------------------------------------------------------------------
-- 会員登録時にプロフィールを作る
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 50));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 権限（列単位）と RLS
-- Supabase は既定で anon・authenticated に全操作を許可しているため、いったん取り消してから必要な分だけ与える
-- -----------------------------------------------------------------------------
revoke all on public.profiles, public.readings, public.insights, public.stems, public.stars from anon, authenticated;

-- profiles：本人は読める。変えられるのは表示名と表示モードだけ
grant select on public.profiles to authenticated;
grant update (display_name, display_mode) on public.profiles to authenticated;

-- readings：本人は読める・消せる。変えられるのは氏名とお気に入りだけ。作成と計算結果はサーバーが行う
grant select, delete on public.readings to authenticated;
grant update (name, is_favorite) on public.readings to authenticated;

-- insights：鑑定記録の持ち主は読める。作成はサーバーが行う
grant select on public.insights to authenticated;

-- stems・stars：誰でも読める
grant select on public.stems, public.stars to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.readings enable row level security;
alter table public.insights enable row level security;
alter table public.stems enable row level security;
alter table public.stars enable row level security;

create policy "本人のプロフィールを読む（管理者は全員分）" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "本人のプロフィールを変える" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "本人の鑑定記録を読む" on public.readings
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "本人の鑑定記録を変える" on public.readings
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "本人の鑑定記録を消す" on public.readings
  for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy "本人の鑑定記録の判定の要点を読む" on public.insights
  for select to authenticated
  using (exists (
    select 1 from public.readings r
    where r.id = insights.reading_id and r.owner_id = (select auth.uid())
  ));

create policy "十干を読む" on public.stems for select to anon, authenticated using (true);
create policy "通変星を読む" on public.stars for select to anon, authenticated using (true);

-- -----------------------------------------------------------------------------
-- 管理用の関数（管理者だけが実行できる。中で is_admin() を確かめる）
-- -----------------------------------------------------------------------------

-- 会員の一覧（メール・最終ログイン・鑑定記録の件数つき）
create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  display_name text,
  role text,
  status text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  reading_count bigint,
  insight_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception '管理者権限が必要です' using errcode = '42501';
  end if;
  return query
    select p.id, u.email::text, p.display_name, p.role, p.status, p.created_at, u.last_sign_in_at,
           (select count(*) from public.readings r where r.owner_id = p.id),
           (select count(*) from public.insights i where i.created_by = p.id)
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at;
end;
$$;

-- 役割・利用状態の変更（自分自身の役割を下げたり、自分を停止したりはできない）
create or replace function public.admin_update_user(target uuid, new_role text default null, new_status text default null)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated public.profiles;
begin
  if not public.is_admin() then
    raise exception '管理者権限が必要です' using errcode = '42501';
  end if;
  if target = (select auth.uid()) and (coalesce(new_role, 'admin') <> 'admin' or coalesce(new_status, 'active') <> 'active') then
    raise exception '自分自身の役割や利用状態は変えられません' using errcode = '42501';
  end if;
  update public.profiles
     set role = coalesce(new_role, role),
         status = coalesce(new_status, status)
   where id = target
  returning * into updated;
  if updated.id is null then
    raise exception '会員が見つかりません' using errcode = 'P0002';
  end if;
  return updated;
end;
$$;

revoke all on function public.admin_list_users() from public, anon;
revoke all on function public.admin_update_user(uuid, text, text) from public, anon;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_update_user(uuid, text, text) to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

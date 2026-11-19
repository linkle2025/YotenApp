-- =============================================================================
-- 吉方位の実践履歴
-- 「今週の吉方位」の［実践］ボタンで残る記録と、後日のメモ
--
-- 方針（initial_schema と同じ）
-- - 記録の作成はサーバー（service_role）だけが行う。サーバーが、その時間・方角が本当に吉方位かを計算し直して確かめてから残す
-- - 会員は自分の履歴を読める・消せる。変えられるのはメモだけ
-- =============================================================================

create table public.kimon_practices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  place text not null check (place ~ '^(0[1-9]|[1-3][0-9]|4[0-7])$'),
  -- その場所の時計での始まり・終わり（タイムゾーンなし）
  slot_start timestamp not null,
  slot_end timestamp not null,
  hour_pillar text not null,
  kind text not null check (kind in ('生門', '風遁', '玉女守門')),
  position smallint not null check (position between 1 and 9),
  direction text not null,
  mark text check (mark in ('◎', '◯')),
  score integer,
  memo text not null default '' check (char_length(memo) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kimon_practices_once unique (owner_id, place, slot_start, kind, position)
);

comment on table public.kimon_practices is '吉方位を実践した履歴。作成はサーバーだけ。会員が変えられるのはメモだけ';
comment on column public.kimon_practices.slot_start is '実践した吉方位の時間の始まり（その場所の時計）';
comment on column public.kimon_practices.memo is '後日、何か起きたときの簡単なメモ（1000字まで）';

create index kimon_practices_owner_slot_idx on public.kimon_practices (owner_id, slot_start desc);

create trigger kimon_practices_set_updated_at
  before update on public.kimon_practices
  for each row execute function public.set_updated_at();

revoke all on public.kimon_practices from anon, authenticated;
grant select, delete on public.kimon_practices to authenticated;
grant update (memo) on public.kimon_practices to authenticated;

alter table public.kimon_practices enable row level security;

create policy "本人の実践履歴を読む" on public.kimon_practices
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "本人の実践履歴のメモを変える" on public.kimon_practices
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "本人の実践履歴を消す" on public.kimon_practices
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- アクセス制御（RLS・列の権限・管理用の関数）のテスト
-- 実行: supabase test db
-- 仕様: 新仕様書/03_構造.md 3.5・3.7
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

-- ---------------------------------------------------------------------------
-- 準備：会員A・会員B・管理者（auth.users に入れると profiles が自動で作られる）
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com', '{"display_name":"会員A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com', '{"display_name":"会員B"}'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.com', '{"display_name":"管理者"}');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000ad';

insert into public.readings (id, owner_id, name, birth_date, birth_time, hour_unknown, birth_place, gender, result, calc_version) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Aの記録', '1985-05-10', '11:30', false, '21', 'male', '{}', 'test'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'Bの記録', '1990-03-10', null, true, '27', 'female', '{}', 'test');
insert into public.insights (reading_id, input_hash, prompt_version, model_name, content, created_by) values
  ('10000000-0000-0000-0000-00000000000b', 'h', 'v2', 'm', '{}', '00000000-0000-0000-0000-00000000000b');

select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), '会員A',
  '会員登録でプロフィールが自動で作られる');

-- ---------------------------------------------------------------------------
-- 会員A としてログイン
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select is((select count(*)::int from public.readings), 1, '会員は自分の鑑定記録だけが見える');
select is((select name from public.readings), 'Aの記録', '見えるのは自分の記録');
select is((select count(*)::int from public.profiles), 1, '会員は自分のプロフィールだけが見える');
select is((select count(*)::int from public.insights), 0, '他人の鑑定記録の判定の要点は見えない');

select lives_ok($$ update public.readings set name = '改名', is_favorite = true where id = '10000000-0000-0000-0000-00000000000a' $$,
  '自分の記録の氏名とお気に入りは変えられる');
select is((select name from public.readings where id = '10000000-0000-0000-0000-00000000000a'), '改名', '氏名が変わっている');

select throws_ok($$ update public.readings set result = '{"fake":true}' $$, '42501', null,
  '計算結果は会員からは変えられない');
select throws_ok($$ insert into public.readings (owner_id, birth_date, birth_place, gender, result, calc_version, hour_unknown)
  values ('00000000-0000-0000-0000-00000000000a', '1990-01-01', '13', 'male', '{}', 'x', true) $$, '42501', null,
  '鑑定記録は会員からは作れない（サーバーが作る）');

-- 他人の記録は、変更・削除しても0件（見えないため）
update public.readings set name = '乗っ取り' where id = '10000000-0000-0000-0000-00000000000b';
delete from public.readings where id = '10000000-0000-0000-0000-00000000000b';

select lives_ok($$ update public.profiles set display_name = '新しい名前', display_mode = 'parent' $$,
  '表示名と表示モードは変えられる');
select throws_ok($$ update public.profiles set role = 'admin' $$, '42501', null, '自分の役割は変えられない');
select throws_ok($$ update public.profiles set status = 'active' $$, '42501', null, '自分の利用状態は変えられない');
select throws_ok($$ select * from public.admin_list_users() $$, '42501', '管理者権限が必要です',
  '会員は会員一覧を見られない');
select throws_ok($$ select public.admin_update_user('00000000-0000-0000-0000-00000000000a', 'admin') $$, '42501', '管理者権限が必要です',
  '会員は自分を管理者にできない');
select is(public.is_admin(), false, '会員は管理者ではない');

-- ---------------------------------------------------------------------------
-- 管理者としてログイン
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);

select is((select count(*)::int from public.profiles), 3, '管理者は全員のプロフィールを見られる');
select is((select count(*)::int from public.readings), 0, '管理者でも他人の鑑定記録は見えない');
select is((select reading_count::int from public.admin_list_users() where email = 'b@example.com'), 1,
  '会員一覧には鑑定記録の件数が出る');
select is((select role from public.admin_update_user('00000000-0000-0000-0000-00000000000a', 'fortuneteller')), 'fortuneteller',
  '管理者は会員の役割を変えられる');
select throws_ok($$ select public.admin_update_user('00000000-0000-0000-0000-0000000000ad', 'general') $$, '42501', null,
  '管理者は自分の役割を下げられない');
select throws_ok($$ select public.admin_update_user('00000000-0000-0000-0000-0000000000ad', null, 'suspended') $$, '42501', null,
  '管理者は自分を停止できない');

-- ---------------------------------------------------------------------------
-- 未ログイン（anon）
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is((select count(*)::int from public.stems), 10, '十干の解説は誰でも読める');
select is((select count(*)::int from public.stars), 10, '通変星の解説は誰でも読める');
select throws_ok($$ select count(*) from public.profiles $$, '42501', null, '未ログインではプロフィールを読めない');

-- ---------------------------------------------------------------------------
-- 後片付けの前に、他人の記録が無事か確かめる
-- ---------------------------------------------------------------------------
reset role;
select is((select name from public.readings where id = '10000000-0000-0000-0000-00000000000b'), 'Bの記録',
  '他人の記録は変更も削除もされていない');

select * from finish();
rollback;

-- ============================================================================
-- [코드위키 (CodeWiki) — Supabase 무료 DB 초기 세팅 SQL]
-- ----------------------------------------------------------------------------
-- 사용법:
-- 1. https://supabase.com 에서 무료 프로젝트 생성
-- 2. 좌측 메뉴 [SQL Editor] 클릭 -> 아래 코드를 붙여넣고 [Run] 클릭!
-- 3. [Project Settings] -> [API]에서 Project URL과 anon public 키를 복사해
--    js/auth.js 상단의 SUPABASE_URL, SUPABASE_ANON_KEY에 붙여넣으면 연동 끝!
-- ============================================================================

-- 1. 회원 프로필 및 승인 상태 테이블 생성
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text not null,
  role text not null default 'student' check (role in ('admin', 'student')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

-- 2. 보안 정책 (RLS: Row Level Security) 활성화
alter table public.profiles enable row level security;

-- 본인 프로필 조회 허용
create policy "본인 프로필 조회"
  on public.profiles for select
  using (auth.uid() = id);

-- 관리자(admin)는 모든 학생 프로필 조회 및 승인(update) 가능
create policy "관리자 전체 학생 조회"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "관리자 학생 승인 상태 변경"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- 회원가입 시 자동으로 profiles 테이블에 행 추가하는 트리거
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '이름 없음'),
    'student',
    'pending'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 💡 [최초 관리자 지정 명령]
-- 본인이 사이트에서 첫 회원가입을 한 뒤, 본인 이메일을 넣어 아래 한 줄만 실행하면 관리자(admin)로 승격됩니다!
-- update public.profiles set role = 'admin', status = 'approved' where email = '내이메일@example.com';

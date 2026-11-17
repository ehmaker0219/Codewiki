-- ============================================================================
-- [코드위키 (CodeWiki) — Supabase 무료 DB 초기 세팅 SQL]
-- ----------------------------------------------------------------------------
-- 나중에 Supabase 연동하실 때 [SQL Editor]에 붙여넣고 [Run] 한 번만 누르면
-- 1) 학생 승인 테이블(profiles)과 2) 수정·업데이트 건의 게시판(feedback_posts)이 모두 생성됩니다!
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

alter table public.profiles enable row level security;

create policy "본인 프로필 조회"
  on public.profiles for select
  using (auth.uid() = id);

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

-- ============================================================================
-- 2. 수정·업데이트 건의 게시판 (feedback_posts) 테이블
-- ============================================================================
create table if not exists public.feedback_posts (
  id bigint generated always as identity primary key,
  author_id uuid references public.profiles(id) on delete set null,
  author_name text not null,
  category text not null default '내용 추가' check (category in ('내용 추가', '수정 요청', '오타·오류', '질문·기타')),
  target_doc_id text,
  target_doc_title text,
  title text not null,
  content text not null,
  status text not null default 'open' check (status in ('open', 'done')),
  admin_note text,
  created_at timestamptz not null default now()
);

alter table public.feedback_posts enable row level security;

-- 승인된(approved) 학생 및 관리자(admin)는 모든 건의글 조회 및 작성 가능
create policy "승인된 멤버 건의글 조회"
  on public.feedback_posts for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and (p.status = 'approved' or p.role = 'admin')
    )
  );

create policy "승인된 멤버 건의글 작성"
  on public.feedback_posts for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and (p.status = 'approved' or p.role = 'admin')
    )
  );

-- 관리자(admin)는 건의글 상태 변경(반영 완료 처리) 및 삭제 가능
create policy "관리자 건의글 상태 변경"
  on public.feedback_posts for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "관리자 또는 작성자 건의글 삭제"
  on public.feedback_posts for delete
  using (
    author_id = auth.uid() or
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

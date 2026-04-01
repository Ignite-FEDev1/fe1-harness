-- projects: 등록된 프로젝트
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  repo_url text,
  project_path text not null,
  description text,
  created_at timestamptz default now()
);

-- sessions: 세션 정보
create table sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id),
  name text not null,
  status text not null default 'idle',
  docs_dir text,
  form_data jsonb not null default '{}',
  current_step integer,
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- session_logs: 실시간 로그 (SSE 재연결 + 세션 리플레이용)
create table session_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  content text not null,
  event_type text default 'log',
  created_at timestamptz default now()
);

-- session_artifacts: 산출물
create table session_artifacts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  filename text not null,
  content text,
  created_at timestamptz default now()
);

-- 인덱스
create index idx_sessions_project_id on sessions(project_id);
create index idx_sessions_status on sessions(status);
create index idx_session_logs_session_id on session_logs(session_id);
create index idx_session_logs_created_at on session_logs(created_at);
create index idx_session_artifacts_session_id on session_artifacts(session_id);

-- RLS 비활성화 (로컬 전용, 인증 불필요)
alter table projects enable row level security;
alter table sessions enable row level security;
alter table session_logs enable row level security;
alter table session_artifacts enable row level security;

-- 모든 접근 허용 (anon key 사용)
create policy "Allow all on projects" on projects for all using (true) with check (true);
create policy "Allow all on sessions" on sessions for all using (true) with check (true);
create policy "Allow all on session_logs" on session_logs for all using (true) with check (true);
create policy "Allow all on session_artifacts" on session_artifacts for all using (true) with check (true);

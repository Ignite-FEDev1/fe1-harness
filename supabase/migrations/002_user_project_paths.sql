-- 사용자별 프로젝트 로컬 경로 매핑
create table user_project_paths (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  project_id uuid references projects(id) on delete cascade,
  local_path text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, project_id)
);

create index idx_user_project_paths_user on user_project_paths(user_id);
create index idx_user_project_paths_project on user_project_paths(project_id);

alter table user_project_paths enable row level security;
create policy "Allow all on user_project_paths" on user_project_paths for all using (true) with check (true);

-- projects 테이블에서 project_path를 선택사항으로 변경 (기존 데이터 호환)
alter table projects alter column project_path drop not null;

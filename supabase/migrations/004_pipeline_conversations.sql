-- pipeline_conversations: 파이프라인 생성 대화 기록
create table pipeline_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  title text not null default '새 파이프라인',
  messages jsonb not null default '[]',
  done_steps jsonb not null default '[]',
  pipeline_name text,
  status text not null default 'in_progress',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_pipeline_conversations_user_id on pipeline_conversations(user_id);
create index idx_pipeline_conversations_status on pipeline_conversations(status);

alter table pipeline_conversations enable row level security;
create policy "Allow all on pipeline_conversations" on pipeline_conversations for all using (true) with check (true);

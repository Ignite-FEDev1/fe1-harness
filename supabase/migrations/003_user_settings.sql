-- 사용자별 설정 (ANTHROPIC_API_KEY 등 fe1-web에 없는 값)
create table user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  key text not null,
  value text not null default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, key)
);

create index idx_user_settings_user on user_settings(user_id);

alter table user_settings enable row level security;
create policy "Allow all on user_settings" on user_settings for all using (true) with check (true);

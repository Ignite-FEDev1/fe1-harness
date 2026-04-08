-- sessions 테이블에 user_id 추가 (사용자별 세션 분리)
alter table sessions add column user_id text;
create index idx_sessions_user_id on sessions(user_id);

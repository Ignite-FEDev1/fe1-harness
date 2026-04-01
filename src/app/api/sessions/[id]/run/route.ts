import { NextResponse } from 'next/server';

import { createServerClient } from '@/lib/supabase/server';
import { createFe1WebClient } from '@/lib/supabase/fe1-web';
import { executePipeline } from '@/lib/pipeline/executor';
import { writeSessionMd } from '@/lib/pipeline/session-md-generator';
import { hasActiveQuery } from '@/lib/pipeline/active-queries';

async function loadUserTokens(
  userId: string,
): Promise<Record<string, string>> {
  const db = createFe1WebClient();
  const { data } = await db
    .from('users')
    .select(
      'ignite_jira_email, ignite_jira_api_token, hmg_jira_email, hmg_jira_api_token, h_chat_api_key',
    )
    .eq('id', userId)
    .single();

  if (!data) return {};

  const tokens: Record<string, string> = {};

  if (data.ignite_jira_email) {
    tokens.IGNITE_JIRA_EMAIL = data.ignite_jira_email;
    tokens.IGNITE_CONFLUENCE_EMAIL = data.ignite_jira_email;
  }
  if (data.ignite_jira_api_token) {
    tokens.IGNITE_JIRA_TOKEN = data.ignite_jira_api_token;
    tokens.IGNITE_CONFLUENCE_TOKEN = data.ignite_jira_api_token;
  }
  if (data.hmg_jira_email) {
    tokens.HMG_JIRA_EMAIL = data.hmg_jira_email;
    tokens.HMG_CONFLUENCE_EMAIL = data.hmg_jira_email;
  }
  if (data.hmg_jira_api_token) {
    tokens.HMG_JIRA_TOKEN = data.hmg_jira_api_token;
    tokens.HMG_CONFLUENCE_TOKEN = data.hmg_jira_api_token;
  }
  if (data.h_chat_api_key) {
    tokens.H_CHAT_TOKEN = data.h_chat_api_key;
  }

  return tokens;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params;
  const supabase = createServerClient();

  // Parse request body for userId and apiMode
  let userId: string | null = null;
  let apiMode: string | null = null;
  let additionalNotes: string | undefined;
  try {
    const body = await request.json();
    userId = body.userId ?? null;
    apiMode = body.apiMode ?? null;
    additionalNotes = body.additionalNotes ?? undefined;
  } catch {
    // no body is fine
  }

  // Validate session
  const { data: session, error } = await supabase
    .from('sessions')
    .select('*, projects(id, project_path)')
    .eq('id', sessionId)
    .single();

  if (error || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  if (
    session.status === 'running' ||
    (session.status === 'paused' && hasActiveQuery(sessionId))
  ) {
    return NextResponse.json(
      { error: 'Session is already running' },
      { status: 409 },
    );
  }

  // Clear any stale stop flag before re-running
  const { clearStopFlag } = await import('@/lib/pipeline/active-queries');
  clearStopFlag(sessionId);

  // Determine harness root
  const harnessRoot = process.cwd();

  // Generate session.md from form data
  const formData = session.form_data ?? {};

  // Resolve project path: user_project_paths > projects.project_path > form_data
  let projectPath = session.projects?.project_path ?? formData.project_path;

  if (userId && session.projects?.id) {
    const { data: pathMapping } = await supabase
      .from('user_project_paths')
      .select('local_path')
      .eq('user_id', userId)
      .eq('project_id', session.projects.id)
      .single();

    if (pathMapping?.local_path) {
      projectPath = pathMapping.local_path;
    }
  }

  if (!projectPath) {
    return NextResponse.json(
      { error: '프로젝트 로컬 경로가 설정되지 않았습니다. 설정 페이지에서 경로를 지정해주세요.' },
      { status: 400 },
    );
  }

  // Merge additional notes if provided (appended after stop + re-run)
  const existingNotes = formData.notes as string | undefined;
  const mergedNotes = additionalNotes
    ? [existingNotes, additionalNotes].filter(Boolean).join('\n\n---\n\n추가 컨텍스트:\n')
    : existingNotes;

  const docsDir = writeSessionMd(harnessRoot, sessionId, {
    ...formData,
    project_path: projectPath,
    notes: mergedNotes,
  });

  // Update session with docs_dir
  await supabase
    .from('sessions')
    .update({ docs_dir: docsDir, updated_at: new Date().toISOString() })
    .eq('id', sessionId);

  // Load env vars — user tokens from fe1-web DB, fallback to .env
  const envVars: Record<string, string> = {};

  // 1. Load .env fallback values
  const envKeys = [
    'HMG_JIRA_TOKEN',
    'HMG_JIRA_EMAIL',
    'IGNITE_JIRA_TOKEN',
    'IGNITE_JIRA_EMAIL',
    'IGNITE_CONFLUENCE_EMAIL',
    'IGNITE_CONFLUENCE_TOKEN',
    'HMG_CONFLUENCE_EMAIL',
    'HMG_CONFLUENCE_TOKEN',
    'H_CHAT_TOKEN',
    'GITLAB_EMAIL',
    'GITLAB_TOKEN',
    'ANTHROPIC_API_KEY',
  ];
  for (const key of envKeys) {
    if (process.env[key]) {
      envVars[key] = process.env[key]!;
    }
  }

  // 2. Override with user-specific tokens from fe1-web
  if (userId) {
    const userTokens = await loadUserTokens(userId);
    Object.assign(envVars, userTokens);

    // 3. Load harness-specific settings (ANTHROPIC_API_KEY)
    const { data: settings } = await supabase
      .from('user_settings')
      .select('key, value')
      .eq('user_id', userId);

    for (const s of settings ?? []) {
      if (s.value) envVars[s.key] = s.value;
    }
  }

  // Extract project_slug and task_type from form data (for new orchestrator)
  const projectSlug = (formData.project_slug as string | undefined) ?? undefined;
  const taskType = (formData.task_type as string | undefined) ?? undefined;

  // Execute pipeline in background (don't await)
  executePipeline({
    sessionId,
    docsDir,
    harnessRoot,
    envVars,
    apiMode: (apiMode as 'h-chat' | 'anthropic' | null) ?? undefined,
    projectSlug,
    taskType,
  }).catch((err) => {
    console.error(`Pipeline execution failed for session ${sessionId}:`, err);
  });

  return NextResponse.json({
    status: 'started',
    sessionId,
    docsDir,
  });
}

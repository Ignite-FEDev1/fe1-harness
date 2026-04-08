import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { followUpSession } from '@/lib/pipeline/executor';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createServerClient();

  const body = await request.json();
  const { message, userId, apiMode, model } = body;

  if (!message?.trim()) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  // Get session with claude_session_id
  const { data: session, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  if (!session.claude_session_id) {
    return NextResponse.json(
      { error: 'No Claude session ID found. Cannot resume.' },
      { status: 400 },
    );
  }

  // Run follow-up in background (non-blocking)
  followUpSession({
    sessionId: id,
    claudeSessionId: session.claude_session_id,
    message: message.trim(),
    apiMode: apiMode ?? 'claude-max',
    model,
  }).catch((err) => {
    console.error('[follow-up] error:', err);
  });

  return NextResponse.json({ ok: true, status: 'running' });
}

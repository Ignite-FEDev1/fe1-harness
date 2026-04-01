import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { stopSession, hasActiveQuery } from '@/lib/pipeline/active-queries';
import { pipelineEventBus } from '@/lib/pipeline/event-bus';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params;
  const supabase = createServerClient();

  const { data: session, error } = await supabase
    .from('sessions')
    .select('status')
    .eq('id', sessionId)
    .single();

  if (error || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  if (session.status !== 'running' && session.status !== 'paused') {
    return NextResponse.json({ error: 'Session is not running' }, { status: 409 });
  }

  // Immediately update DB — don't wait for executor loop
  await supabase
    .from('sessions')
    .update({ status: 'stopped', updated_at: new Date().toISOString() })
    .eq('id', sessionId);

  // Emit events directly so SSE stream updates immediately
  pipelineEventBus.emit(sessionId, 'status', { status: 'stopped' });
  pipelineEventBus.emit(sessionId, 'done', {});

  // Also signal executor loop to exit cleanly when next message arrives
  if (hasActiveQuery(sessionId)) {
    stopSession(sessionId);
  }

  return NextResponse.json({ ok: true });
}

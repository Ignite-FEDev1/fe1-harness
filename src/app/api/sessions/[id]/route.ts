import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('sessions')
    .select('*, projects(name, project_path)')
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  // Fetch last active stage from session_logs for progress bar restoration
  const { data: lastProgress } = await supabase
    .from('session_logs')
    .select('content')
    .eq('session_id', id)
    .eq('event_type', 'progress')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  let activeStageId: string | null = null;
  if (lastProgress) {
    try {
      const parsed = JSON.parse(lastProgress.content);
      activeStageId = parsed.stageId ?? null;
    } catch {
      // ignore
    }
  }

  return NextResponse.json({ ...data, active_stage_id: activeStageId });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createServerClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from('sessions')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createServerClient();

  // Stop active pipeline execution before deleting
  const { stopSession, hasActiveQuery } = await import('@/lib/pipeline/active-queries');
  const { pipelineEventBus } = await import('@/lib/pipeline/event-bus');

  if (hasActiveQuery(id)) {
    stopSession(id);
  }
  pipelineEventBus.emit(id, 'status', { status: 'stopped' });
  pipelineEventBus.emit(id, 'done', {});

  const { error } = await supabase.from('sessions').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

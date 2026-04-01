import { NextResponse } from 'next/server';
import { getActiveQuery } from '@/lib/pipeline/active-queries';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params;
  const body = await request.json();
  const { message } = body;

  if (!message) {
    return NextResponse.json(
      { error: 'message is required' },
      { status: 400 },
    );
  }

  const activeQuery = getActiveQuery(sessionId);
  if (!activeQuery) {
    return NextResponse.json(
      { error: 'No active pipeline for this session' },
      { status: 404 },
    );
  }

  try {
    // Send user response via streamInput
    async function* userMessage() {
      yield { role: 'user' as const, content: message };
    }
    await activeQuery.streamInput(userMessage());

    // Update session status back to running
    const supabase = createServerClient();
    await supabase
      .from('sessions')
      .update({ status: 'running', updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

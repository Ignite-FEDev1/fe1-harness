import { createServerClient } from '@/lib/supabase/server';
import { pipelineEventBus } from '@/lib/pipeline/event-bus';
import type { LogEvent, ProgressEvent, UserGateEvent, StatusEvent } from '@/lib/pipeline/event-bus';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          /* stream closed */
        }
      };

      // 1. Send historical logs from DB for reconnection
      const supabase = createServerClient();
      const { data: logs } = await supabase
        .from('session_logs')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (logs) {
        for (const log of logs) {
          if (log.event_type === 'progress') {
            // Progress events are stored as JSON string — parse and re-emit directly
            try {
              const parsed = JSON.parse(log.content);
              send('progress', parsed);
            } catch {
              // ignore malformed progress entries
            }
          } else {
            send(log.event_type ?? 'log', {
              content: log.content,
              timestamp: log.created_at,
            });
          }
        }
      }

      // Send current session status
      const { data: session } = await supabase
        .from('sessions')
        .select('status, current_step, error_message, claude_session_id')
        .eq('id', sessionId)
        .single();

      if (session) {
        send('status', { status: session.status });
        if (session.current_step) {
          send('progress', { step: session.current_step });
        }
        if (session.claude_session_id) {
          send('claude_session_id', { claudeSessionId: session.claude_session_id });
        }
      }

      // 2. Subscribe to live events
      const onLog = (data: LogEvent) => send('log', data);
      const onProgress = (data: ProgressEvent) => send('progress', data);
      const onUserGate = (data: UserGateEvent) => send('usergate', data);
      const onStatus = (data: StatusEvent) => send('status', data);
      const onClaudeSessionId = (data: { claudeSessionId: string }) => send('claude_session_id', data);
      const onDone = () => {
        send('done', {});
        cleanup();
      };

      pipelineEventBus.on(sessionId, 'log', onLog);
      pipelineEventBus.on(sessionId, 'progress', onProgress);
      pipelineEventBus.on(sessionId, 'usergate', onUserGate);
      pipelineEventBus.on(sessionId, 'status', onStatus);
      pipelineEventBus.on(sessionId, 'claude_session_id', onClaudeSessionId);
      pipelineEventBus.on(sessionId, 'done', onDone);

      // Heartbeat every 25 seconds to prevent proxy/browser timeout
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25000);

      const cleanup = () => {
        clearInterval(heartbeat);
        pipelineEventBus.off(sessionId, 'log', onLog);
        pipelineEventBus.off(sessionId, 'progress', onProgress);
        pipelineEventBus.off(sessionId, 'usergate', onUserGate);
        pipelineEventBus.off(sessionId, 'status', onStatus);
        pipelineEventBus.off(sessionId, 'claude_session_id', onClaudeSessionId);
        pipelineEventBus.off(sessionId, 'done', onDone);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      request.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

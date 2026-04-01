import { query } from '@anthropic-ai/claude-agent-sdk';
import { createServerClient } from '@/lib/supabase/server';
import { createFe1WebClient } from '@/lib/supabase/fe1-web';

const H_CHAT_API_URL =
  'https://internal-apigw-kr.hmg-corp.io/hchat-in/api/v3/claude/messages';

async function loadUserEnv(userId: string): Promise<Record<string, string>> {
  const env: Record<string, string> = {};

  const fe1Web = createFe1WebClient();
  const { data: user } = await fe1Web
    .from('users')
    .select('h_chat_api_key')
    .eq('id', userId)
    .single();

  if (user?.h_chat_api_key) {
    env.H_CHAT_TOKEN = user.h_chat_api_key;
  }

  const supabase = createServerClient();
  const { data: settings } = await supabase
    .from('user_settings')
    .select('key, value')
    .eq('user_id', userId);

  for (const s of settings ?? []) {
    if (s.value) env[s.key] = s.value;
  }

  return env;
}

// --- H-Chat: Direct Messages API ---
async function handleHChat(
  message: string,
  token: string,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
) {
  const send = (event: string, data: unknown) => {
    try {
      controller.enqueue(
        encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
      );
    } catch {
      /* closed */
    }
  };

  send('status', { apiMode: 'h-chat', baseUrl: 'internal-apigw-kr.hmg-corp.io' });

  try {
    const res = await fetch(H_CHAT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content: message }],
        stream: true,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      send('error', {
        message: `H-Chat API ${res.status}: ${errText.slice(0, 300)}`,
      });
      send('done', {});
      try { controller.close(); } catch { /* */ }
      return;
    }

    // Stream SSE from H-Chat
    // H-Chat sends: "event:xxx\ndata:{json}\n\n" but chunks may split anywhere
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE blocks (separated by double newline)
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() ?? '';

      for (const block of blocks) {
        if (!block.trim()) continue;

        // Extract data line from the block
        const lines = block.split('\n');
        let dataStr = '';
        for (const line of lines) {
          if (line.startsWith('data:')) {
            dataStr += line.slice(5);
          }
        }

        dataStr = dataStr.trim();
        if (!dataStr || dataStr === '[DONE]') continue;

        try {
          const evt = JSON.parse(dataStr);

          if (evt.type === 'content_block_delta') {
            const text = evt.delta?.text ?? evt.delta?.partial_json;
            if (text) send('text', { content: text });
          } else if (evt.type === 'message_delta' && evt.usage) {
            send('result', {
              error: false,
              inputTokens: evt.usage.input_tokens,
              outputTokens: evt.usage.output_tokens,
            });
          }
        } catch {
          // skip unparseable
        }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    send('error', { message: msg });
  }

  send('done', {});
  try { controller.close(); } catch { /* */ }
}

// --- Anthropic API key: Claude Agent SDK ---
async function handleAnthropic(
  message: string,
  apiKey: string,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
) {
  const send = (event: string, data: unknown) => {
    try {
      controller.enqueue(
        encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
      );
    } catch {
      /* closed */
    }
  };

  send('status', { apiMode: 'anthropic', baseUrl: 'api.anthropic.com' });

  try {
    const sdkEnv: Record<string, string | undefined> = {
      ...process.env,
      ANTHROPIC_API_KEY: apiKey,
    };

    const q = query({
      prompt: message,
      options: {
        cwd: process.cwd(),
        env: sdkEnv,
        allowedTools: ['Read', 'Glob', 'Grep', 'Bash', 'WebFetch'],
        permissionMode: 'bypassPermissions',
        model: 'claude-sonnet-4-6',
      },
    });

    for await (const msg of q) {
      const sdkMsg = msg as unknown as {
        type: string;
        message?: {
          content?: { type: string; text?: string; name?: string; input?: unknown }[];
        };
        is_error?: boolean;
        total_cost_usd?: number;
      };

      if (sdkMsg.type === 'assistant') {
        for (const block of sdkMsg.message?.content ?? []) {
          if (block.type === 'text' && block.text) {
            send('text', { content: block.text });
          } else if (block.type === 'tool_use' && block.name) {
            send('tool', { name: block.name, input: block.input });
          }
        }
      } else if (sdkMsg.type === 'result') {
        send('result', { error: sdkMsg.is_error, cost: sdkMsg.total_cost_usd });
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    send('error', { message: msg });
  }

  send('done', {});
  try { controller.close(); } catch { /* */ }
}

// --- Claude Max: Local OAuth (~/.claude/) ---
async function handleClaudeMax(
  message: string,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
) {
  const send = (event: string, data: unknown) => {
    try {
      controller.enqueue(
        encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
      );
    } catch {
      /* closed */
    }
  };

  send('status', { apiMode: 'claude-max', baseUrl: 'api.anthropic.com (OAuth)' });

  try {
    // No ANTHROPIC_API_KEY override — SDK picks up ~/.claude/ session credentials
    const sdkEnv: Record<string, string | undefined> = { ...process.env };
    delete sdkEnv.ANTHROPIC_API_KEY;
    delete sdkEnv.ANTHROPIC_BASE_URL;

    const q = query({
      prompt: message,
      options: {
        cwd: process.cwd(),
        env: sdkEnv,
        allowedTools: ['Read', 'Glob', 'Grep', 'Bash', 'WebFetch'],
        permissionMode: 'bypassPermissions',
        model: 'claude-sonnet-4-6',
      },
    });

    for await (const msg of q) {
      const sdkMsg = msg as unknown as {
        type: string;
        message?: {
          content?: { type: string; text?: string; name?: string; input?: unknown }[];
        };
        is_error?: boolean;
        total_cost_usd?: number;
      };

      if (sdkMsg.type === 'assistant') {
        for (const block of sdkMsg.message?.content ?? []) {
          if (block.type === 'text' && block.text) {
            send('text', { content: block.text });
          } else if (block.type === 'tool_use' && block.name) {
            send('tool', { name: block.name, input: block.input });
          }
        }
      } else if (sdkMsg.type === 'result') {
        send('result', { error: sdkMsg.is_error, cost: sdkMsg.total_cost_usd });
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    send('error', { message: msg });
  }

  send('done', {});
  try { controller.close(); } catch { /* */ }
}

// --- Route Handler ---
export async function POST(request: Request) {
  const { message, userId, apiMode } = await request.json();

  if (!message) {
    return new Response(JSON.stringify({ error: 'message is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userEnv = userId ? await loadUserEnv(userId) : {};

  // Fallback to process.env
  if (!userEnv.H_CHAT_TOKEN && process.env.H_CHAT_TOKEN) {
    userEnv.H_CHAT_TOKEN = process.env.H_CHAT_TOKEN;
  }
  if (!userEnv.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY) {
    userEnv.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  }

  const hasHChat = !!userEnv.H_CHAT_TOKEN;
  const hasAnthropic = !!userEnv.ANTHROPIC_API_KEY;

  // Determine which mode to use: respect explicit apiMode, fallback to availability
  // claude-max always available (uses ~/.claude/ OAuth)
  type ResolvedMode = 'h-chat' | 'anthropic' | 'claude-max';
  let resolvedMode: ResolvedMode;
  if (apiMode === 'h-chat' && hasHChat) {
    resolvedMode = 'h-chat';
  } else if (apiMode === 'anthropic' && hasAnthropic) {
    resolvedMode = 'anthropic';
  } else if (apiMode === 'claude-max') {
    resolvedMode = 'claude-max';
  } else if (hasHChat) {
    resolvedMode = 'h-chat';
  } else if (hasAnthropic) {
    resolvedMode = 'anthropic';
  } else {
    resolvedMode = 'claude-max'; // fallback to local OAuth
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      if (resolvedMode === 'h-chat') {
        handleHChat(message, userEnv.H_CHAT_TOKEN, controller, encoder);
      } else if (resolvedMode === 'anthropic') {
        handleAnthropic(message, userEnv.ANTHROPIC_API_KEY, controller, encoder);
      } else {
        // claude-max: SDK uses ~/.claude/ OAuth, no API key injected
        handleClaudeMax(message, controller, encoder);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

import { NextResponse } from 'next/server';
import { createFe1WebClient } from '@/lib/supabase/fe1-web';
import { createServerClient } from '@/lib/supabase/server';

const FE1_TEAM_ID = 'b0000000-0000-0000-0000-000000000001';

// fe1-web DB에서 가져오는 토큰 (Confluence는 Jira와 동일 값)
const FE1_WEB_TOKENS: { key: string; column: string; label: string; sensitive: boolean }[] = [
  { key: 'IGNITE_JIRA_EMAIL', column: 'ignite_jira_email', label: 'Ignite Jira Email', sensitive: false },
  { key: 'IGNITE_JIRA_TOKEN', column: 'ignite_jira_api_token', label: 'Ignite Jira/Confluence Token', sensitive: true },
  { key: 'HMG_JIRA_EMAIL', column: 'hmg_jira_email', label: 'HMG Jira Email', sensitive: false },
  { key: 'HMG_JIRA_TOKEN', column: 'hmg_jira_api_token', label: 'HMG Jira/Confluence Token', sensitive: true },
  { key: 'H_CHAT_TOKEN', column: 'h_chat_api_key', label: 'H-Chat API Key (claude-h)', sensitive: true },
];

// harness 자체 DB에서 관리하는 토큰
const HARNESS_TOKENS: { key: string; label: string; sensitive: boolean }[] = [
  { key: 'GITLAB_EMAIL', label: 'GitLab Email', sensitive: false },
  { key: 'GITLAB_TOKEN', label: 'GitLab Private Token', sensitive: true },
];

export async function GET() {
  try {
    const fe1Web = createFe1WebClient();
    const harness = createServerClient();

    // 1. fe1-web에서 사용자 + 토큰 조회
    const { data: fe1Users, error } = await fe1Web
      .from('users')
      .select(
        'id, name, ignite_jira_email, ignite_jira_api_token, hmg_jira_email, hmg_jira_api_token, h_chat_api_key',
      )
      .eq('team_id', FE1_TEAM_ID)
      .order('name');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2. harness DB에서 모든 user_settings 조회
    const { data: allSettings } = await harness
      .from('user_settings')
      .select('user_id, key, value');

    const settingsMap = new Map<string, Map<string, string>>();
    for (const s of allSettings ?? []) {
      if (!settingsMap.has(s.user_id)) settingsMap.set(s.user_id, new Map());
      settingsMap.get(s.user_id)!.set(s.key, s.value);
    }

    // 3. Merge
    const users = (fe1Users ?? []).map((u) => {
      const tokens: Record<string, { value: string; masked: string; label: string; sensitive: boolean; source: string }> = {};

      // fe1-web tokens
      for (const tk of FE1_WEB_TOKENS) {
        const raw = (u as Record<string, string>)[tk.column] || '';
        tokens[tk.key] = {
          value: raw,
          masked: raw ? (tk.sensitive ? maskToken(raw) : raw) : '',
          label: tk.label,
          sensitive: tk.sensitive,
          source: 'fe1-web',
        };
      }

      // harness tokens
      const userSettings = settingsMap.get(u.id);
      for (const tk of HARNESS_TOKENS) {
        const raw = userSettings?.get(tk.key) ?? '';
        tokens[tk.key] = {
          value: raw,
          masked: raw ? maskToken(raw) : '',
          label: tk.label,
          sensitive: tk.sensitive,
          source: 'harness',
        };
      }

      return { id: u.id, name: u.name, tokens };
    });

    return NextResponse.json(users);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function maskToken(token: string): string {
  if (token.length <= 4) return '****';
  return '\u2022'.repeat(Math.min(token.length - 4, 12)) + token.slice(-4);
}

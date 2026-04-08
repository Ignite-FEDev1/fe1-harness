import { NextResponse } from 'next/server';
import { createFe1WebClient } from '@/lib/supabase/fe1-web';
import { createServerClient } from '@/lib/supabase/server';

// fe1-web DB 컬럼명과 프론트엔드 키 매핑
const FE1_WEB_KEY_TO_COLUMN: Record<string, string> = {
  IGNITE_JIRA_EMAIL: 'ignite_jira_email',
  IGNITE_JIRA_TOKEN: 'ignite_jira_api_token',
  HMG_JIRA_EMAIL: 'hmg_jira_email',
  HMG_JIRA_TOKEN: 'hmg_jira_api_token',
  H_CHAT_TOKEN: 'h_chat_api_key',
};

// harness DB에 저장되는 키
const HARNESS_KEYS = new Set(['GITLAB_EMAIL', 'GITLAB_TOKEN']);

export async function PUT(request: Request) {
  const body = await request.json();
  const { userId, key, value } = body;

  if (!userId || !key) {
    return NextResponse.json(
      { error: 'userId and key are required' },
      { status: 400 },
    );
  }

  // fe1-web source
  if (FE1_WEB_KEY_TO_COLUMN[key]) {
    const column = FE1_WEB_KEY_TO_COLUMN[key];
    const db = createFe1WebClient();
    const { error } = await db
      .from('users')
      .update({ [column]: value ?? '' })
      .eq('id', userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  // harness source
  if (HARNESS_KEYS.has(key)) {
    const supabase = createServerClient();
    const { error } = await supabase
      .from('user_settings')
      .upsert(
        {
          user_id: userId,
          key,
          value: value ?? '',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,key' },
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: `Unknown token key: ${key}` }, { status: 400 });
}

import { NextResponse } from 'next/server';

const TOKEN_KEYS = [
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
] as const;

export async function GET() {
  const tokens: Record<string, string> = {};

  for (const key of TOKEN_KEYS) {
    const val = process.env[key];
    if (val) {
      // Mask token values, show only last 4 chars
      tokens[key] =
        val.length > 4 ? '•'.repeat(val.length - 4) + val.slice(-4) : '••••';
    } else {
      tokens[key] = '';
    }
  }

  return NextResponse.json(tokens);
}

export async function PUT() {
  // Token update requires .env file modification
  // For security, this returns instructions rather than modifying .env directly
  return NextResponse.json({
    message:
      '토큰 변경은 .env 파일을 직접 수정해주세요. 변경 후 서버를 재시작하면 적용됩니다.',
    envPath: '.env',
    requiredKeys: TOKEN_KEYS,
  });
}

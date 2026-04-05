import { NextResponse } from 'next/server';
import { existsSync, readdirSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const SPECIALS_DIR = path.join(process.cwd(), '.claude', 'commands', 'specials');

export async function GET() {
  if (!existsSync(SPECIALS_DIR)) return NextResponse.json([]);
  const names = readdirSync(SPECIALS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace('.md', ''));
  return NextResponse.json(names);
}

export async function POST(request: Request) {
  const { name } = await request.json();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  mkdirSync(SPECIALS_DIR, { recursive: true });
  const filePath = path.join(SPECIALS_DIR, `${name}.md`);
  if (!existsSync(filePath)) {
    writeFileSync(filePath, `# ${name} 특수 규칙\n\n이 프로젝트의 특수한 규칙과 컨텍스트를 작성하세요.\n`, 'utf-8');
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}

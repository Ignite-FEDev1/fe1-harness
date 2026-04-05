import { NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

const FILE_PATH = path.join(process.cwd(), '.claude', 'commands', 'orchestrator.md');

export async function GET() {
  if (!existsSync(FILE_PATH)) {
    return NextResponse.json({ error: 'orchestrator.md not found' }, { status: 404 });
  }
  const content = readFileSync(FILE_PATH, 'utf-8');
  return NextResponse.json({ content });
}

export async function PUT(request: Request) {
  const { content } = await request.json();
  if (typeof content !== 'string') {
    return NextResponse.json({ error: 'content required' }, { status: 400 });
  }
  writeFileSync(FILE_PATH, content, 'utf-8');
  return NextResponse.json({ ok: true });
}

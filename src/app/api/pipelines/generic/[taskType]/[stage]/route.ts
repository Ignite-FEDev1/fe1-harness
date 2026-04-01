import { NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

const GENERIC_DIR = path.join(process.cwd(), '.claude', 'commands', 'generic');

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ taskType: string; stage: string }> },
) {
  const { taskType, stage } = await params;
  const filePath = path.join(GENERIC_DIR, taskType, `${stage}.md`);

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: 'Stage not found' }, { status: 404 });
  }

  const content = readFileSync(filePath, 'utf-8');
  return NextResponse.json({ taskType, stage, content });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ taskType: string; stage: string }> },
) {
  const { taskType, stage } = await params;
  const filePath = path.join(GENERIC_DIR, taskType, `${stage}.md`);

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: 'Stage not found' }, { status: 404 });
  }

  const { content } = await request.json();
  if (typeof content !== 'string') {
    return NextResponse.json({ error: 'content required' }, { status: 400 });
  }

  writeFileSync(filePath, content, 'utf-8');
  return NextResponse.json({ ok: true });
}

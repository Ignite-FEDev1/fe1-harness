import { NextResponse } from 'next/server';
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import path from 'path';

const SPECIALS_DIR = path.join(process.cwd(), '.claude', 'commands', 'specials');

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const filePath = path.join(SPECIALS_DIR, `${name}.md`);
  if (!existsSync(filePath)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ content: readFileSync(filePath, 'utf-8') });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const { content } = await request.json();
  mkdirSync(SPECIALS_DIR, { recursive: true });
  writeFileSync(path.join(SPECIALS_DIR, `${name}.md`), content ?? '', 'utf-8');
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const filePath = path.join(SPECIALS_DIR, `${name}.md`);
  if (existsSync(filePath)) unlinkSync(filePath);
  return NextResponse.json({ ok: true });
}

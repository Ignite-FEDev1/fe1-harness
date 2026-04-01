import { NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

const PROJECTS_DIR = path.join(process.cwd(), '.claude', 'commands', 'projects');

const STAGE_IDS = [
  'plan', 'plan-review', 'ticket', 'ticket-review',
  'develop', 'develop-review', 'pr', 'qa', 'qa-review',
];

function getDir(slug: string, taskType: string) {
  return path.join(PROJECTS_DIR, slug, taskType);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; taskType: string }> },
) {
  const { slug, taskType } = await params;
  const dir = getDir(slug, taskType);

  const configPath = path.join(dir, 'config.json');
  const specialPath = path.join(dir, 'special.md');

  const config = existsSync(configPath)
    ? JSON.parse(readFileSync(configPath, 'utf-8'))
    : { project: slug, taskType, label: taskType, description: '', stages: STAGE_IDS.map((id) => ({ id, enabled: true })) };

  const special = existsSync(specialPath) ? readFileSync(specialPath, 'utf-8') : '';

  return NextResponse.json({ config, special });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string; taskType: string }> },
) {
  const { slug, taskType } = await params;
  const dir = getDir(slug, taskType);
  mkdirSync(dir, { recursive: true });

  const body = await request.json();

  if (body.config !== undefined) {
    writeFileSync(path.join(dir, 'config.json'), JSON.stringify(body.config, null, 2), 'utf-8');
  }

  if (body.special !== undefined) {
    writeFileSync(path.join(dir, 'special.md'), body.special, 'utf-8');
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string; taskType: string }> },
) {
  const { slug, taskType } = await params;
  const dir = getDir(slug, taskType);

  if (existsSync(dir)) {
    const { rmSync } = await import('fs');
    rmSync(dir, { recursive: true, force: true });
  }

  return NextResponse.json({ ok: true });
}

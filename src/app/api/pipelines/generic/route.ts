import { NextResponse } from 'next/server';
import { existsSync, readdirSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';

const GENERIC_DIR = path.join(process.cwd(), '.claude', 'commands', 'generic');

const DEFAULT_STAGES = [
  'plan', 'plan-review', 'ticket', 'ticket-review',
  'develop', 'develop-review', 'pr', 'qa', 'qa-review',
];

export async function GET() {
  if (!existsSync(GENERIC_DIR)) {
    return NextResponse.json({ taskTypes: [] });
  }

  const taskTypes = readdirSync(GENERIC_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const stages = readdirSync(path.join(GENERIC_DIR, d.name))
        .filter((f) => f.endsWith('.md'))
        .map((f) => f.replace('.md', ''))
        .sort((a, b) => DEFAULT_STAGES.indexOf(a) - DEFAULT_STAGES.indexOf(b));
      return { taskType: d.name, stages };
    });

  return NextResponse.json({ taskTypes });
}

export async function POST(request: Request) {
  const { taskType } = await request.json();
  if (!taskType) {
    return NextResponse.json({ error: 'taskType required' }, { status: 400 });
  }

  const dir = path.join(GENERIC_DIR, taskType);
  if (existsSync(dir)) {
    return NextResponse.json({ error: 'Already exists' }, { status: 409 });
  }

  mkdirSync(dir, { recursive: true });
  // Create empty placeholder for each default stage
  for (const stage of DEFAULT_STAGES) {
    writeFileSync(
      path.join(dir, `${stage}.md`),
      `## ${stage}\n\n<!-- 이 범용 스테이지 프롬프트를 작성하세요 -->\n`,
      'utf-8',
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

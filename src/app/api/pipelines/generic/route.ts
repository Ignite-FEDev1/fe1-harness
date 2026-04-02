import { NextResponse } from 'next/server';
import { existsSync, readdirSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import path from 'path';

const GENERIC_DIR = path.join(process.cwd(), '.claude', 'commands', 'generic');

const DEFAULT_STAGES = [
  'plan', 'plan-review', 'ticket', 'ticket-review',
  'develop', 'develop-review', 'pr', 'qa', 'qa-review',
];

interface GenStageInput {
  id: string;
  label?: string;
  parallelGroup?: string;
}

export async function GET() {
  if (!existsSync(GENERIC_DIR)) {
    return NextResponse.json({ taskTypes: [] });
  }

  const taskTypes = readdirSync(GENERIC_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const dir = path.join(GENERIC_DIR, d.name);
      const pipelinePath = path.join(dir, 'pipeline.json');

      let stages: string[];
      if (existsSync(pipelinePath)) {
        try {
          const config = JSON.parse(readFileSync(pipelinePath, 'utf-8'));
          stages = (config.stages ?? []).map((s: GenStageInput) => s.id);
        } catch {
          stages = [];
        }
      } else {
        stages = readdirSync(dir)
          .filter((f) => f.endsWith('.md'))
          .map((f) => f.replace('.md', ''))
          .sort((a, b) => DEFAULT_STAGES.indexOf(a) - DEFAULT_STAGES.indexOf(b));
      }

      return { taskType: d.name, stages, stageCount: stages.length };
    });

  return NextResponse.json({ taskTypes });
}

export async function POST(request: Request) {
  const { taskType, stages } = await request.json();
  if (!taskType) {
    return NextResponse.json({ error: 'taskType required' }, { status: 400 });
  }

  const dir = path.join(GENERIC_DIR, taskType);
  if (existsSync(dir)) {
    return NextResponse.json({ error: 'Already exists' }, { status: 409 });
  }

  // Accept free-form stages; fall back to defaults if none provided
  const stageList: GenStageInput[] =
    Array.isArray(stages) && stages.length > 0
      ? stages
      : DEFAULT_STAGES.map((id) => ({ id }));

  mkdirSync(dir, { recursive: true });

  // Write pipeline.json — source of truth for stage order + parallel groups
  writeFileSync(
    path.join(dir, 'pipeline.json'),
    JSON.stringify({ stages: stageList }, null, 2),
    'utf-8',
  );

  // Create .md placeholder for each stage
  for (const stage of stageList) {
    writeFileSync(
      path.join(dir, `${stage.id}.md`),
      `## ${stage.id}\n\n<!-- ${stage.label ?? stage.id} 프롬프트를 작성하세요 -->\n`,
      'utf-8',
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

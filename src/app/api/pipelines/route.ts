import { NextResponse } from 'next/server';
import { readFileSync, existsSync, readdirSync } from 'fs';
import path from 'path';

const COMMANDS_DIR = path.join(process.cwd(), '.claude', 'commands');
const PROJECTS_DIR = path.join(COMMANDS_DIR, 'projects');
const GENERIC_DIR = path.join(COMMANDS_DIR, 'generic');

const STAGE_IDS = [
  'plan', 'plan-review', 'ticket', 'ticket-review',
  'develop', 'develop-review', 'pr', 'qa', 'qa-review',
];

export async function GET() {
  const result: Array<{ slug: string; taskType: string; label: string; enabledCount: number }> = [];

  // List generic task types
  const genericTaskTypes: Array<{ taskType: string; stageCount: number }> = [];
  if (existsSync(GENERIC_DIR)) {
    const dirs = readdirSync(GENERIC_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
    for (const d of dirs) {
      const dir = path.join(GENERIC_DIR, d.name);
      const pipelinePath = path.join(dir, 'pipeline.json');
      let stageCount: number;
      if (existsSync(pipelinePath)) {
        try {
          const config = JSON.parse(readFileSync(pipelinePath, 'utf-8'));
          stageCount = (config.stages ?? []).length;
        } catch {
          stageCount = 0;
        }
      } else {
        stageCount = readdirSync(dir).filter((f) => f.endsWith('.md')).length;
      }
      genericTaskTypes.push({ taskType: d.name, stageCount });
    }
  }

  if (!existsSync(PROJECTS_DIR)) {
    return NextResponse.json({ projects: result, genericTaskTypes });
  }

  const slugs = readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const slug of slugs) {
    const slugDir = path.join(PROJECTS_DIR, slug);
    const taskTypes = readdirSync(slugDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const taskType of taskTypes) {
      const configPath = path.join(slugDir, taskType, 'config.json');
      let label = taskType;
      let enabledCount = STAGE_IDS.length;

      if (existsSync(configPath)) {
        try {
          const config = JSON.parse(readFileSync(configPath, 'utf-8'));
          label = config.label ?? taskType;
          enabledCount = (config.stages ?? []).filter((s: { enabled: boolean }) => s.enabled).length;
        } catch {
          // ignore parse errors
        }
      }

      result.push({ slug, taskType, label, enabledCount });
    }
  }

  return NextResponse.json({ projects: result, genericTaskTypes });
}

export async function POST(request: Request) {
  const { slug, taskType } = await request.json();
  if (!slug || !taskType) {
    return NextResponse.json({ error: 'slug and taskType required' }, { status: 400 });
  }

  const { mkdirSync, writeFileSync } = await import('fs');
  const dir = path.join(PROJECTS_DIR, slug, taskType);
  mkdirSync(dir, { recursive: true });

  const configPath = path.join(dir, 'config.json');
  if (!existsSync(configPath)) {
    const defaultConfig = {
      project: slug,
      taskType,
      label: taskType,
      description: '',
      stages: STAGE_IDS.map((id) => ({ id, enabled: true })),
    };
    writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
  }

  const specialPath = path.join(dir, 'special.md');
  if (!existsSync(specialPath)) {
    writeFileSync(specialPath, `# ${slug} ${taskType} — 특수 파이프라인 규칙\n\n## PLANNER\n\n## DEVELOPER\n\n## TICKET\n\n## REVIEWER_AC\n\n## REVIEWER_ARCH\n\n## REVIEWER_CONVENTION\n\n## QA\n`, 'utf-8');
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

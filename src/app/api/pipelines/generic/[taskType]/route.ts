import { NextResponse } from 'next/server';
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, unlinkSync, renameSync } from 'fs';
import path from 'path';

const GENERIC_DIR = path.join(process.cwd(), '.claude', 'commands', 'generic');

interface GenStage {
  id: string;
  label?: string;
  parallel?: string;
  fanout?: number;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ taskType: string }> },
) {
  const { taskType } = await params;
  const dir = path.join(GENERIC_DIR, taskType);

  if (!existsSync(dir)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const pipelinePath = path.join(dir, 'pipeline.json');
  const inputSchemaPath = path.join(dir, 'input-schema.json');

  let inputSchema: unknown = null;
  if (existsSync(inputSchemaPath)) {
    try { inputSchema = JSON.parse(readFileSync(inputSchemaPath, 'utf-8')); } catch { /* ignore */ }
  }

  if (existsSync(pipelinePath)) {
    try {
      const config = JSON.parse(readFileSync(pipelinePath, 'utf-8'));
      const label: string = config.label ?? taskType;
      const description: string = config.description ?? '';
      return NextResponse.json({ ...config, label, description, inputSchema });
    } catch {
      return NextResponse.json({ stages: [], label: taskType, description: '', inputSchema });
    }
  }

  // Fallback: infer from .md files
  const stages: GenStage[] = readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ id: f.replace('.md', '') }));

  return NextResponse.json({ stages, label: taskType, description: '', inputSchema });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ taskType: string }> },
) {
  const { taskType } = await params;
  const dir = path.join(GENERIC_DIR, taskType);
  const { stages, label, description, inputSchema } = await request.json() as { stages: GenStage[]; label?: string; description?: string; inputSchema?: unknown };

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Read existing pipeline.json to preserve other fields
  const pipelinePath = path.join(dir, 'pipeline.json');
  let existing: Record<string, unknown> = {};
  if (existsSync(pipelinePath)) {
    try { existing = JSON.parse(readFileSync(pipelinePath, 'utf-8')); } catch { /* ignore */ }
  }

  const updated: Record<string, unknown> = { ...existing, stages };
  if (label !== undefined) updated.label = label;
  if (description !== undefined) updated.description = description;

  // Update pipeline.json
  writeFileSync(
    pipelinePath,
    JSON.stringify(updated, null, 2),
    'utf-8',
  );

  // Update input-schema.json if provided
  if (inputSchema !== undefined) {
    const inputSchemaPath = path.join(dir, 'input-schema.json');
    writeFileSync(inputSchemaPath, JSON.stringify(inputSchema, null, 2), 'utf-8');
  }

  const activeIds = new Set(stages.map((s) => s.id));

  // Delete .md files for stages no longer in the pipeline
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.md')) continue;
    const stageId = file.replace('.md', '');
    if (!activeIds.has(stageId)) {
      unlinkSync(path.join(dir, file));
    }
  }

  // Create .md placeholder for any new stage that doesn't have one yet
  for (const stage of stages) {
    const mdPath = path.join(dir, `${stage.id}.md`);
    if (!existsSync(mdPath)) {
      writeFileSync(
        mdPath,
        `## ${stage.id}\n\n<!-- ${stage.label ?? stage.id} 프롬프트를 작성하세요 -->\n`,
        'utf-8',
      );
    }
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ taskType: string }> },
) {
  const { taskType } = await params;
  const { newName: rawName } = await request.json() as { newName: string };

  // Strip path separators and null bytes — name must be a single directory component
  const newName = rawName?.replace(/[/\\.\0]/g, '').trim();

  if (!newName) {
    return NextResponse.json({ error: 'newName is required' }, { status: 400 });
  }

  const dir = path.join(GENERIC_DIR, taskType);
  const newDir = path.join(GENERIC_DIR, newName);

  if (!existsSync(dir)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (existsSync(newDir) && newName !== taskType) {
    return NextResponse.json({ error: '이미 존재하는 이름입니다' }, { status: 409 });
  }

  try {
    renameSync(dir, newDir);
  } catch (e) {
    return NextResponse.json({ error: `rename 실패: ${String(e)}` }, { status: 500 });
  }

  // Update genericPipeline references in project configs
  const PROJECTS_DIR = path.join(process.cwd(), '.claude', 'commands', 'projects');
  if (existsSync(PROJECTS_DIR)) {
    const slugDirs = readdirSync(PROJECTS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
    for (const slugEnt of slugDirs) {
      const slugDir = path.join(PROJECTS_DIR, slugEnt.name);
      const ttDirs = readdirSync(slugDir, { withFileTypes: true }).filter((d) => d.isDirectory());
      for (const ttEnt of ttDirs) {
        const configPath = path.join(slugDir, ttEnt.name, 'config.json');
        if (!existsSync(configPath)) continue;
        try {
          const config = JSON.parse(readFileSync(configPath, 'utf-8'));
          if (config.genericPipeline === taskType) {
            config.genericPipeline = newName;
            writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
          }
        } catch {
          // skip malformed configs
        }
      }
    }
  }

  return NextResponse.json({ ok: true, taskType: newName });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ taskType: string }> },
) {
  const { taskType } = await params;
  const dir = path.join(GENERIC_DIR, taskType);

  if (!existsSync(dir)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Remove the generic pipeline directory
  rmSync(dir, { recursive: true, force: true });

  // Clear genericPipeline reference from all project configs that point to this taskType
  const PROJECTS_DIR = path.join(process.cwd(), '.claude', 'commands', 'projects');
  if (existsSync(PROJECTS_DIR)) {
    const slugDirs = readdirSync(PROJECTS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
    for (const slugEnt of slugDirs) {
      const slugDir = path.join(PROJECTS_DIR, slugEnt.name);
      const ttDirs = readdirSync(slugDir, { withFileTypes: true }).filter((d) => d.isDirectory());
      for (const ttEnt of ttDirs) {
        const configPath = path.join(slugDir, ttEnt.name, 'config.json');
        if (!existsSync(configPath)) continue;
        try {
          const config = JSON.parse(readFileSync(configPath, 'utf-8'));
          if (config.genericPipeline === taskType) {
            delete config.genericPipeline;
            writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
          }
        } catch {
          // skip malformed configs
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}

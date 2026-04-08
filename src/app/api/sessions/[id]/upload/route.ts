import { NextResponse } from 'next/server';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';

/**
 * POST /api/sessions/:id/upload
 *
 * Accepts multipart/form-data with files.
 * Saves files to sessions/{id}/uploads/ directory.
 * Returns the saved file paths (relative to harness root).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params;
  const harnessRoot = process.cwd();
  const uploadsDir = path.join(harnessRoot, 'sessions', sessionId, 'uploads');

  mkdirSync(uploadsDir, { recursive: true });

  const formData = await request.formData();
  const files = formData.getAll('files');
  const fieldId = formData.get('fieldId') as string | null;

  if (files.length === 0) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 });
  }

  const savedPaths: string[] = [];

  for (const file of files) {
    if (!(file instanceof File)) continue;

    // Sanitize filename: remove path separators, null bytes
    const safeName = file.name.replace(/[/\\.\0]/g, '_').replace(/^_+/, '') || 'file';
    // Add timestamp prefix to avoid collisions
    const fileName = `${Date.now()}-${safeName}`;
    const filePath = path.join(uploadsDir, fileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    writeFileSync(filePath, buffer);

    // Return path relative to harness root
    savedPaths.push(path.join('sessions', sessionId, 'uploads', fileName));
  }

  return NextResponse.json({
    fieldId,
    paths: savedPaths,
    count: savedPaths.length,
  });
}

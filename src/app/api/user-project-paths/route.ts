import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// GET: 특정 사용자의 프로젝트 경로 매핑 조회
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json(
      { error: 'userId is required' },
      { status: 400 },
    );
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('user_project_paths')
    .select('*, projects(id, name)')
    .eq('user_id', userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST: 사용자별 프로젝트 경로 설정 (upsert)
export async function POST(request: Request) {
  const body = await request.json();
  const { user_id, project_id, local_path } = body;

  if (!user_id || !project_id || !local_path) {
    return NextResponse.json(
      { error: 'user_id, project_id, local_path are required' },
      { status: 400 },
    );
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('user_project_paths')
    .upsert(
      {
        user_id,
        project_id,
        local_path,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,project_id' },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

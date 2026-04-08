import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');

  let query = supabase
    .from('pipeline_conversations')
    .select('id, title, status, pipeline_name, updated_at, created_at')
    .order('updated_at', { ascending: false });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  const body = await request.json();

  const { user_id, title } = body;

  const { data, error } = await supabase
    .from('pipeline_conversations')
    .insert({
      user_id: user_id ?? null,
      title: title || '새 파이프라인',
      messages: [],
      done_steps: [],
      status: 'in_progress',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

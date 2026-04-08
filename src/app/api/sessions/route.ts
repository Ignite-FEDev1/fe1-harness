import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');

  let query = supabase
    .from('sessions')
    .select('*, projects(name)')
    .order('created_at', { ascending: false });

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

  const { name, project_id, form_data, user_id } = body;

  if (!name) {
    return NextResponse.json(
      { error: 'name is required' },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      name,
      project_id: project_id ?? null,
      form_data: form_data ?? {},
      user_id: user_id ?? null,
      status: 'idle',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

// Next.js instrumentation — runs once on server startup
// Cleans up sessions stuck in 'running' state from a previous server instance
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { createClient } = await import('@supabase/supabase-js');

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) return;

    const supabase = createClient(url, key);

    const { data: runningSessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('status', 'running');

    if (runningSessions && runningSessions.length > 0) {
      const ids = runningSessions.map((s: { id: string }) => s.id);
      await supabase
        .from('sessions')
        .update({
          status: 'stopped',
          error_message: '서버가 재시작되어 파이프라인이 중단되었습니다. RE-RUN으로 재시작하세요.',
          updated_at: new Date().toISOString(),
        })
        .in('id', ids);

      console.log(`[startup] ${ids.length}개 orphan 세션을 stopped으로 정리했습니다:`, ids);
    }
  }
}

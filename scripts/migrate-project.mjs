import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf-8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// 1. Find both projects
const { data: projects } = await sb.from('projects').select('id, name');
console.log('projects:', projects?.map((p) => `${p.name} (${p.id})`));

const assembleFe = projects?.find((p) => p.name === 'assemble-fe');
const groupware  = projects?.find((p) => p.name === '그룹웨어');

if (!assembleFe) { console.log('assemble-fe not found, nothing to do'); process.exit(0); }
if (!groupware)  { console.error('그룹웨어 not found'); process.exit(1); }

// 2. Move sessions from assemble-fe → 그룹웨어
const { data: sessions, error: sessErr } = await sb
  .from('sessions')
  .update({ project_id: groupware.id })
  .eq('project_id', assembleFe.id)
  .select('id');
if (sessErr) console.error('session migration error:', sessErr.message);
else console.log(`moved ${sessions?.length ?? 0} sessions → 그룹웨어`);

// 3. Move user_project_paths
const { data: paths, error: pathErr } = await sb
  .from('user_project_paths')
  .update({ project_id: groupware.id })
  .eq('project_id', assembleFe.id)
  .select('id');
if (pathErr) console.error('user_project_paths error:', pathErr.message);
else console.log(`moved ${paths?.length ?? 0} user_project_paths → 그룹웨어`);

// 4. Delete assemble-fe
const { error: delErr } = await sb.from('projects').delete().eq('id', assembleFe.id);
if (delErr) console.error('delete error:', delErr.message);
else console.log('deleted assemble-fe');

console.log('done');

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Parse .env manually
const env = Object.fromEntries(
  readFileSync('.env', 'utf-8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    }),
);

const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

const { data: existing } = await sb.from('projects').select('name');
console.log('existing projects:', existing?.map((p) => p.name));

const toInsert = [
  { name: '그룹웨어', description: 'Groupware (그룹웨어) 프론트엔드', repo_url: '' },
  { name: 'CPO', description: 'CPO 포털 프론트엔드', repo_url: '' },
];

for (const p of toInsert) {
  if (existing?.find((e) => e.name === p.name)) {
    console.log(`skip (already exists): ${p.name}`);
    continue;
  }
  const { data, error } = await sb.from('projects').insert(p).select().single();
  if (error) console.error(`failed to insert ${p.name}:`, error.message);
  else console.log(`inserted: ${data.name} (${data.id})`);
}

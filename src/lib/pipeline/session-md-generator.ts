import fs from 'fs';
import path from 'path';

export interface SessionFormData {
  project_path?: string;
  generic_pipeline?: string;
  special_rule?: string;
  project_slug?: string;
  task_type?: string;
  confluence_urls?: string[];
  api_doc_urls?: string[];
  figma_urls?: string[];
  figma_notes?: string;
  swagger_urls?: string[];
  markup?: {
    path?: string;
    notes?: string;
  };
  be_api_status?: 'dev' | 'stg' | 'none';
  login_url?: string;
  login_id?: string;
  login_pw?: string;
  ticket_prefix?: string;
  branch_name?: string;
  base_branch?: string;
  notes?: string;
  pipeline_inputs?: Record<string, string | string[] | boolean>;
}

function formatYamlList(items: string[] | undefined): string {
  if (!items || items.length === 0) return '';
  return items.map((url) => `  - ${url}`).join('\n');
}

function formatMultiline(text: string | undefined): string {
  if (!text) return '';
  return `|\n  ${text.replace(/\n/g, '\n  ')}`;
}

/**
 * Promote known top-level field names from pipeline_inputs to top-level fields.
 * This lets pipelines declare fields like `confluence_urls` in their input-schema.json
 * and have them appear at session.md top level (so orchestrator's {MARKUP_PATH}, {LOGIN_URL}
 * etc. variable injection works).
 *
 * Unknown fields stay in pipeline_inputs.
 */
function promoteKnownFields(data: SessionFormData): SessionFormData {
  if (!data.pipeline_inputs) return data;

  const inputs = { ...data.pipeline_inputs };
  const promoted: SessionFormData = { ...data };

  const takeString = (key: string): string | undefined => {
    const v = inputs[key];
    if (typeof v === 'string' && v.trim()) {
      delete inputs[key];
      return v;
    }
    return undefined;
  };
  const takeList = (key: string): string[] | undefined => {
    const v = inputs[key];
    if (Array.isArray(v) && v.length > 0) {
      delete inputs[key];
      return v;
    }
    return undefined;
  };

  promoted.confluence_urls ??= takeList('confluence_urls');
  promoted.api_doc_urls ??= takeList('api_doc_urls');
  promoted.figma_urls ??= takeList('figma_urls');
  promoted.figma_notes ??= takeString('figma_notes');
  promoted.swagger_urls ??= takeList('swagger_urls');
  const markupPath = takeString('markup_path');
  const markupNotes = takeString('markup_notes');
  if (markupPath || markupNotes) {
    promoted.markup = {
      ...(promoted.markup ?? {}),
      ...(markupPath ? { path: markupPath } : {}),
      ...(markupNotes ? { notes: markupNotes } : {}),
    };
  }
  const beStatus = takeString('be_api_status');
  if (beStatus === 'dev' || beStatus === 'stg' || beStatus === 'none') {
    promoted.be_api_status ??= beStatus;
  }
  promoted.login_url ??= takeString('login_url');
  promoted.login_id ??= takeString('login_id');
  promoted.login_pw ??= takeString('login_pw');
  promoted.ticket_prefix ??= takeString('ticket_prefix');
  promoted.branch_name ??= takeString('branch_name');
  promoted.base_branch ??= takeString('base_branch');
  if (!promoted.notes) promoted.notes = takeString('notes');

  promoted.pipeline_inputs = Object.keys(inputs).length > 0 ? inputs : undefined;
  return promoted;
}

export function generateSessionMd(input: SessionFormData): string {
  const data = promoteKnownFields(input);
  const lines: string[] = [];

  if (data.project_path) lines.push(`project_path: ${data.project_path}`);
  if (data.generic_pipeline) lines.push(`generic_pipeline: ${data.generic_pipeline}`);
  if (data.special_rule) lines.push(`special_rule: ${data.special_rule}`);
  if (data.project_slug) lines.push(`project_slug: ${data.project_slug}`);
  if (data.task_type) lines.push(`task_type: ${data.task_type}`);

  if (data.confluence_urls?.length) {
    lines.push('confluence_urls:');
    lines.push(formatYamlList(data.confluence_urls));
  }

  if (data.api_doc_urls?.length) {
    lines.push('api_doc_urls:');
    lines.push(formatYamlList(data.api_doc_urls));
  }

  if (data.figma_urls?.length) {
    lines.push('figma_urls:');
    lines.push(formatYamlList(data.figma_urls));
  }

  if (data.figma_notes) {
    lines.push(`figma_notes: ${formatMultiline(data.figma_notes)}`);
  }

  if (data.swagger_urls?.length) {
    lines.push('swagger_urls:');
    lines.push(formatYamlList(data.swagger_urls));
  }

  if (data.markup?.path || data.markup?.notes) {
    lines.push('markup:');
    if (data.markup.path) lines.push(`  path: ${data.markup.path}`);
    if (data.markup.notes)
      lines.push(`  notes: ${formatMultiline(data.markup.notes)}`);
  }

  if (data.be_api_status) {
    lines.push(`be_api_status: ${data.be_api_status}`);
  }

  if (data.login_url) lines.push(`login_url: ${data.login_url}`);
  if (data.login_id) lines.push(`login_id: ${data.login_id}`);
  if (data.login_pw) lines.push(`login_pw: ${data.login_pw}`);
  if (data.ticket_prefix) lines.push(`ticket_prefix: ${data.ticket_prefix}`);
  if (data.branch_name) lines.push(`branch_name: ${data.branch_name}`);
  if (data.base_branch) lines.push(`base_branch: ${data.base_branch}`);

  if (data.notes) {
    lines.push(`notes: ${formatMultiline(data.notes)}`);
  }

  if (data.pipeline_inputs && Object.keys(data.pipeline_inputs).length > 0) {
    lines.push('pipeline_inputs:');
    for (const [key, value] of Object.entries(data.pipeline_inputs)) {
      if (typeof value === 'boolean') {
        lines.push(`  ${key}: ${value}`);
      } else if (Array.isArray(value)) {
        if (value.length > 0) {
          lines.push(`  ${key}:`);
          lines.push(value.map((v) => `    - ${v}`).join('\n'));
        }
      } else if (value) {
        const indented = value.replace(/\n/g, '\n    ');
        lines.push(`  ${key}: |\n    ${indented}`);
      }
    }
  }

  return lines.join('\n') + '\n';
}

/** Sanitize a string for safe use as a directory name. */
function sanitizeDirName(name: string): string {
  return name
    .replace(/[/\\:*?"<>|\0]/g, '')  // remove unsafe chars
    .replace(/\s+/g, '-')            // spaces → hyphens
    .replace(/-+/g, '-')             // collapse hyphens
    .replace(/^-|-$/g, '')           // trim hyphens
    .slice(0, 30)                    // max length
    || 'unnamed';
}

export interface SessionMeta {
  session_id: string;
  session_name: string;
  created_at: string;
  api_mode?: string;
  model?: string;
  pipeline?: string;
  special_rule?: string;
}

export function writeSessionMd(
  harnessRoot: string,
  sessionId: string,
  data: SessionFormData,
  meta?: { sessionName?: string; apiMode?: string; model?: string },
): string {
  // Build readable folder name: {date}_{name}_{uuid8}
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const name = sanitizeDirName(meta?.sessionName || data.generic_pipeline || 'session');
  const shortId = sessionId.slice(0, 8);
  const folderName = `${date}_${name}_${shortId}`;

  const docsDir = path.join(harnessRoot, 'sessions', folderName);
  fs.mkdirSync(docsDir, { recursive: true });

  // Write session.md
  fs.writeFileSync(path.join(docsDir, 'session.md'), generateSessionMd(data), 'utf-8');

  // Write meta.json
  const sessionMeta: SessionMeta = {
    session_id: sessionId,
    session_name: meta?.sessionName || name,
    created_at: new Date().toISOString(),
    api_mode: meta?.apiMode,
    model: meta?.model,
    pipeline: data.generic_pipeline,
    special_rule: data.special_rule,
  };
  fs.writeFileSync(path.join(docsDir, 'meta.json'), JSON.stringify(sessionMeta, null, 2), 'utf-8');

  return docsDir;
}

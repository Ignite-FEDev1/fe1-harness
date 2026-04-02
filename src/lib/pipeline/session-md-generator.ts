import fs from 'fs';
import path from 'path';

export interface SessionFormData {
  project_path?: string;
  generic_pipeline?: string;
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
  epic?: string;
  assignee?: string;
  branch_name?: string;
  base_branch?: string;
  replan?: boolean;
  replan_reason?: string;
  notes?: string;
}

function formatYamlList(items: string[] | undefined): string {
  if (!items || items.length === 0) return '';
  return items.map((url) => `  - ${url}`).join('\n');
}

function formatMultiline(text: string | undefined): string {
  if (!text) return '';
  return `|\n  ${text.replace(/\n/g, '\n  ')}`;
}

export function generateSessionMd(data: SessionFormData): string {
  const lines: string[] = [];

  if (data.project_path) lines.push(`project_path: ${data.project_path}`);
  if (data.generic_pipeline) lines.push(`generic_pipeline: ${data.generic_pipeline}`);
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
  if (data.epic) lines.push(`epic: ${data.epic}`);
  if (data.assignee) lines.push(`assignee: ${data.assignee}`);
  if (data.branch_name) lines.push(`branch_name: ${data.branch_name}`);
  if (data.base_branch) lines.push(`base_branch: ${data.base_branch}`);

  if (data.replan) {
    lines.push(`replan: true`);
    if (data.replan_reason) {
      lines.push(`replan_reason: ${formatMultiline(data.replan_reason)}`);
    }
  }

  if (data.notes) {
    lines.push(`notes: ${formatMultiline(data.notes)}`);
  }

  return lines.join('\n') + '\n';
}

export function writeSessionMd(
  harnessRoot: string,
  sessionId: string,
  data: SessionFormData,
): string {
  const docsDir = path.join(harnessRoot, 'sessions', sessionId);
  fs.mkdirSync(docsDir, { recursive: true });
  const filePath = path.join(docsDir, 'session.md');
  fs.writeFileSync(filePath, generateSessionMd(data), 'utf-8');
  return docsDir;
}

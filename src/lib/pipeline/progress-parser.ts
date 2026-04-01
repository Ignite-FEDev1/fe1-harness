export interface PipelineProgress {
  step: number;
  label: string;
  detail: string;
}

export const STAGE_LABELS: Record<string, string> = {
  'plan': '기획 분석',
  'plan-review': '계획 검수',
  'ticket': '티켓 생성',
  'ticket-review': '티켓 검수',
  'develop': '개발',
  'develop-review': '코드 리뷰',
  'pr': 'PR 작성',
  'qa': 'QA',
  'qa-review': 'QA 검수',
};

// Matches lowercase stage IDs like 📍 [plan], 📍 [develop-review]
// Does NOT match 📍 [INIT] (uppercase = system markers)
const STAGE_MARKER_REGEX = /📍\s*\[([a-z][a-z0-9-]+)\]/;

// Legacy step marker (kept for backward compat with old pipeline.md)
const STEP_REGEX = /📍\s*\[STEP\s+(\d)\/4\]\s*(.+)/;

const STEP_LABELS: Record<number, string> = {
  1: '계획 수립',
  2: '티켓 생성',
  3: '개발',
  4: 'QA',
};

const USERGATE_REGEX = /⏸\s*\[사용자 확인 필요\]/;
const ABORT_REGEX = /⛔/;
const COMPLETE_REGEX = /✅\s*\[PIPELINE COMPLETE\]|✅\s*파이프라인 완료/;

/** Parse stage ID from orchestrator markers like "📍 [plan] 기획 분석 시작" */
export function parseStageId(text: string): string | null {
  const match = text.match(STAGE_MARKER_REGEX);
  return match ? match[1] : null;
}

/** Parse legacy step number from old "📍 [STEP N/4]" markers */
export function parseProgress(text: string): PipelineProgress | null {
  const match = text.match(STEP_REGEX);
  if (!match) return null;

  const step = parseInt(match[1], 10);
  const detail = match[2].trim();

  return {
    step,
    label: STEP_LABELS[step] ?? `STEP ${step}`,
    detail,
  };
}

export function detectUserGate(text: string): boolean {
  return USERGATE_REGEX.test(text);
}

export function detectAbort(text: string): boolean {
  return ABORT_REGEX.test(text);
}

export function detectCompletion(text: string): boolean {
  return COMPLETE_REGEX.test(text);
}

export function extractUserGatePrompt(text: string): string {
  const lines = text.split('\n');
  const gateIdx = lines.findIndex((l) => USERGATE_REGEX.test(l));
  if (gateIdx === -1) return text;
  return lines.slice(gateIdx).join('\n').trim();
}

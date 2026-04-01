---
description: 프로젝트+업무유형 설정을 읽어 활성화된 단계만 순서대로 실행하는 동적 파이프라인 오케스트레이터
allowed-tools: Read, Glob, Grep, Bash, Agent, Write, Edit, WebFetch, mcp__Framelink-MCP-for-Figma__get_figma_data, mcp__Framelink-MCP-for-Figma__download_figma_images
argument-hint: <docs-directory-path>
effort: high
---

## 입력

배경 자료 디렉토리: `$ARGUMENTS`

이 디렉토리 안에 `session.md`가 있어야 합니다.

---

## Orchestrator 역할

당신은 동적 파이프라인 오케스트레이터입니다.
config.json에서 활성화된 단계만 순서대로 실행하고, 각 단계의 결과를 검수하여 루프를 제어합니다.
**직접 코드를 작성하거나 분석하지 마세요.** 모든 실제 작업은 SubAgent가 담당합니다.
각 Agent 호출은 완전히 독립된 새 세션으로 실행됩니다. 세션 간 컨텍스트는 파일과 프롬프트 주입으로만 전달합니다.

---

## STEP 0: 초기화

### 0-A. session.md 읽기

`$ARGUMENTS/session.md`를 읽으세요. 아래 필드를 파악합니다:
- `project_path`: 작업할 코드베이스 루트 경로
- `project_slug`: 프로젝트 슬러그 (예: groupware)
- `task_type`: 업무유형 슬러그 (예: 신규스펙개발)
- `confluence_urls`, `api_doc_urls`, `figma_urls`, `figma_notes`
- `swagger_urls`, `markup.path`, `markup.notes`, `be_api_status`
- `login_url`, `login_id`, `login_pw`
- `ticket_prefix`, `epic`, `assignee`
- `branch_name`, `notes`

session.md에 `project_slug`나 `task_type`이 없으면:
- project_slug = "default"
- task_type = "신규스펙개발"
으로 fallback합니다.

### 0-B. 파이프라인 설정 읽기

`.claude/commands/projects/{project_slug}/{task_type}/config.json`을 Read 도구로 읽으세요.

파일이 없으면 아래 기본값을 사용합니다:
```json
{
  "stages": [
    { "id": "plan",           "enabled": true },
    { "id": "plan-review",    "enabled": true },
    { "id": "ticket",         "enabled": true },
    { "id": "ticket-review",  "enabled": true },
    { "id": "develop",        "enabled": true },
    { "id": "develop-review", "enabled": true },
    { "id": "pr",             "enabled": true },
    { "id": "qa",             "enabled": true },
    { "id": "qa-review",      "enabled": true }
  ]
}
```

enabled: true인 단계만 실행합니다. 순서는 config.json의 배열 순서를 따릅니다.

`genericPipeline` 필드도 읽어 `{GENERIC_PIPELINE}` 변수에 저장합니다.
- 값이 있으면: 해당 값을 사용 (예: `"QA수정"` → `generic/QA수정/`)
- 값이 없으면: `task_type`을 fallback으로 사용

### 0-C. 특수 규칙 로드

`.claude/commands/projects/{project_slug}/{task_type}/special.md`를 Read 도구로 읽으세요.

파일이 없으면: 각 `{RULES_*}` 변수를 빈 값으로 설정합니다.

파일이 있으면: `## SECTION명` 헤더를 기준으로 섹션을 파싱하여 아래 변수에 매핑합니다:
- `{RULES_PLANNER}` ← `## PLANNER` 섹션 내용
- `{RULES_DEVELOPER}` ← `## DEVELOPER` 섹션 내용
- `{RULES_TICKET}` ← `## TICKET` 섹션 내용
- `{RULES_REVIEWER_AC}` ← `## REVIEWER_AC` 섹션 내용
- `{RULES_REVIEWER_ARCH}` ← `## REVIEWER_ARCH` 섹션 내용
- `{RULES_REVIEWER_CONVENTION}` ← `## REVIEWER_CONVENTION` 섹션 내용
- `{RULES_QA}` ← `## QA` 섹션 내용

### 0-D. 사전 검증

1. `project_path` 디렉토리 존재 확인 → 없으면 ⛔ 중단
2. `$ARGUMENTS/session.md` 존재 확인 → 없으면 ⛔ 중단
3. enabled 단계가 최소 1개 이상인지 확인 → 없으면 ⛔ 중단

### 0-E. 공통 변수 매핑

이후 단계에서 사용할 공통 변수를 설정합니다:
- `{DOCS_DIR}` → `$ARGUMENTS`
- `{PROJECT_PATH}` → session.md의 project_path
- `{MARKUP_PATH}` → session.md의 markup.path (없으면 "없음")
- `{MARKUP_NOTES}` → session.md의 markup.notes (없으면 "없음")
- `{BE_API_STATUS}` → session.md의 be_api_status (없으면 "dev")
- `{LOGIN_URL}` → session.md의 login_url
- `{LOGIN_ID}` → session.md의 login_id
- `{LOGIN_PW}` → session.md의 login_pw
- `{TICKET_PREFIX}` → session.md의 ticket_prefix (없으면 "")
- `{EPIC}` → session.md의 epic
- `{ASSIGNEE}` → session.md의 assignee
- `{FIGMA_NOTES}` → session.md의 figma_notes
- `{NOTES}` → session.md의 notes
- `{BRANCH_NAME}` → session.md의 branch_name (없으면 "")
- `{BASE_BRANCH}` → session.md의 base_branch (없으면 "main")

초기화 완료 후 출력:
```
📍 [INIT] 파이프라인 초기화 완료
  - 프로젝트: {project_slug} / {task_type}
  - 활성 단계: {enabled 단계 목록, 쉼표 구분}
  - 특수 규칙: {로드됨 / 없음}
  - 코드베이스: {PROJECT_PATH}
```

---

## STEP 1+: 단계별 실행

config.json의 stages 배열을 순서대로 순회하며, enabled: true인 단계만 실행합니다.

### 단계 실행 방법

각 단계에 대해:

1. **프롬프트 파일 읽기**: `.claude/commands/generic/{GENERIC_PIPELINE}/{stage.id}.md`를 Read 도구로 읽으세요
2. **변수 치환**: 파일 내 모든 `{변수}` 플레이스홀더를 실제 값으로 치환하세요
3. **Agent 실행**: 치환된 프롬프트를 Agent 도구의 prompt 파라미터로 전달하세요
4. **결과 확인**: review 단계는 결과 파일에서 PASS/FAIL을 확인하세요

### 단계별 특성

**plan** (기획 분석 → plan.md 생성)
- 실행 전: `📍 [plan] 기획 분석 시작`
- 결과 파일: `{DOCS_DIR}/plan.md`
- 다음 단계로 진행

**plan-review** (plan.md 검수 → review-plan.md)
- 실행 전: `📍 [plan-review] 계획서 검수 시작`
- 결과 파일: `{DOCS_DIR}/review-plan.md`에서 `## 판정: PASS | FAIL` 확인
- FAIL이면 plan 단계가 enabled인 경우 최대 3회 재시도 (plan → plan-review 루프)
- 3회 모두 FAIL이면 ⛔ 중단

**ticket** (티켓 생성 → tickets.md)
- 실행 전: `📍 [ticket] 티켓 생성 시작`
- `{PREV_TICKETS}` = 이전 tickets.md가 있으면 그 내용, 없으면 빈 값
- `{TICKET_FEEDBACK}` = 이전 review-tickets.md가 있으면 피드백 섹션, 없으면 빈 값
- 결과 파일: `{DOCS_DIR}/tickets.md`

**ticket-review** (tickets.md 검수 → review-tickets.md)
- 실행 전: `📍 [ticket-review] 티켓 검수 시작`
- FAIL이면 ticket 단계가 enabled인 경우 최대 3회 재시도
- 3회 모두 FAIL이면 ⛔ 중단

**develop** (코드 개발)
- 실행 전: `📍 [develop] 개발 시작`
- `{PREV_PLAN}` = plan.md 내용
- `{REPLAN_REASON}` = 재개발 사유 (없으면 빈 값)
- 결과: 코드 변경 + `{DOCS_DIR}/changed-files.md`

**develop-review** (코드 리뷰 — 3개 검수자 병렬)
- 실행 전: `📍 [develop-review] 코드 리뷰 시작 (3개 검수자 병렬)`
- reviewer-ac, reviewer-architecture, reviewer-convention을 Agent 도구로 병렬 실행
- 각각 `.claude/commands/pipeline/reviewer-ac.md`, `reviewer-architecture.md`, `reviewer-convention.md` 사용
- 결과 파일: `review-ac.md`, `review-architecture.md`, `review-convention.md`
- ANY FAIL이면 develop 단계가 enabled인 경우 최대 3회 재시도
- 3회 모두 FAIL이면 ⛔ 중단

**pr** (PR 작성 → pr.md)
- 실행 전: `📍 [pr] PR 작성 시작`

**qa** (QA 실행 → qa.md)
- 실행 전: `📍 [qa] QA 시작`

**qa-review** (QA 검수 → review-qa.md)
- 실행 전: `📍 [qa-review] QA 검수 시작`
- FAIL이면 qa 단계가 enabled인 경우 최대 3회 재시도

---

## 완료

모든 활성 단계가 완료되면:

```
✅ [PIPELINE COMPLETE]
  실행된 단계: {실행된 단계 목록}
  건너뛴 단계: {disabled 단계 목록}
  산출물 위치: {DOCS_DIR}
```

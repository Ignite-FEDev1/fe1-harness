---
description: session.md를 읽어 plan → tickets → 개발 → QA까지 전체 FE 파이프라인을 실행합니다.
allowed-tools: Read, Glob, Grep, Bash, Agent, Write, Edit, WebFetch, mcp__Framelink-MCP-for-Figma__get_figma_data, mcp__Framelink-MCP-for-Figma__download_figma_images
argument-hint: <docs-directory-path>
effort: high
---

## 입력

배경 자료 디렉토리: `$ARGUMENTS`

이 디렉토리 안에 `session.md`가 있어야 합니다.

---

## Orchestrator 역할

당신은 이 파이프라인의 Orchestrator입니다.
각 단계를 순서대로 실행하고, 검수 결과를 읽어 PASS/FAIL을 판단하며, 루프를 제어합니다.
**직접 코드를 작성하거나 분석하지 마세요.** 모든 실제 작업은 SubAgent가 담당합니다.
각 Agent 호출은 완전히 독립된 새 세션으로 실행됩니다. 세션 간 컨텍스트는 파일과 프롬프트 주입으로만 전달합니다.

### Agent 프롬프트 파일 참조 규칙

각 Agent의 상세 프롬프트는 `.claude/commands/pipeline/` 디렉토리에 별도 파일로 분리되어 있습니다.
Agent를 실행할 때:
1. 해당 프롬프트 파일을 Read 도구로 읽으세요
2. 파일 내의 `{변수}` 플레이스홀더를 실제 값으로 치환하세요
3. 치환된 프롬프트를 Agent 도구의 prompt 파라미터로 전달하세요

공통 변수 매핑:
- `{DOCS_DIR}` → `$ARGUMENTS`
- `{PROJECT_PATH}` → session.md의 project_path
- `{MARKUP_PATH}` → session.md의 markup.path
- `{MARKUP_NOTES}` → session.md의 markup.notes
- `{BE_API_STATUS}` → session.md의 be_api_status
- `{LOGIN_URL}` → session.md의 login_url
- `{LOGIN_ID}` → session.md의 login_id
- `{LOGIN_PW}` → session.md의 login_pw
- `{TICKET_PREFIX}` → session.md의 ticket_prefix
- `{EPIC}` → session.md의 epic
- `{ASSIGNEE}` → session.md의 assignee
- `{FIGMA_NOTES}` → session.md의 figma_notes
- `{NOTES}` → session.md의 notes
- `{RULES_PLANNER}` → 0-E에서 로드한 프로젝트 특화 규칙 PLANNER 섹션
- `{RULES_DEVELOPER}` → 0-E에서 로드한 프로젝트 특화 규칙 DEVELOPER 섹션
- `{RULES_TICKET}` → 0-E에서 로드한 프로젝트 특화 규칙 TICKET 섹션
- `{RULES_REVIEWER_CONVENTION}` → 0-E에서 로드한 프로젝트 특화 규칙 REVIEWER_CONVENTION 섹션
- `{RULES_REVIEWER_AC}` → 0-E에서 로드한 프로젝트 특화 규칙 REVIEWER_AC 섹션
- `{RULES_REVIEWER_ARCH}` → 0-E에서 로드한 프로젝트 특화 규칙 REVIEWER_ARCH 섹션
- `{RULES_QA}` → 0-E에서 로드한 프로젝트 특화 규칙 QA 섹션

### 📍 진행 상태 보고 규칙

파이프라인은 장시간 실행됩니다. 사용자가 현재 진행 상황을 알 수 있도록 **각 주요 시점마다** 아래 형식으로 상태를 출력하세요:

```
📍 [STEP 1/4] 계획 수립 — 자료 수집 중...
📍 [STEP 1/4] 계획 수립 — Planner Agent 실행 중 (1/3회 시도)
📍 [STEP 1/4] 계획 수립 — Plan Reviewer: PASS ✅
📍 [STEP 2/4] 티켓 생성 — Ticket Generator Agent 실행 중 (1/3회 시도)
📍 [STEP 3/4] 개발 — Developer Agent 실행 중 (1/3회 시도)
📍 [STEP 3/4] 개발 — 코드 검수 3명 병렬 실행 중...
📍 [STEP 3/4] 개발 — 검수 결과: AC ✅ / 컨벤션 ✅ / 아키텍처 ✅ → PASS
📍 [STEP 4/4] QA — QA Agent 실행 중...
📍 [STEP 4/4] QA — QA Reviewer: PASS ✅
```

### ⛔ 문제 발생 시 중단 원칙

파이프라인 진행 중 아래 상황이 발생하면 **억지로 넘어가지 말고 즉시 중단**하여 사용자에게 보고하고 확인을 요청하세요:

- session.md에 필수 정보 누락 (project_path 미존재, 기획서 URL 없음 등)
- markup.path가 지정되어 있으나 해당 파일이 실제로 존재하지 않음
- 기획서 URL 수집 실패 (모든 Confluence URL에 접근 불가)
- SubAgent가 오류를 반환하거나 산출물 파일을 생성하지 않음
- 3회 연속 FAIL로 루프가 종료된 경우
- 판단이 모호하여 사용자 의사결정이 필요한 경우

보고 형식:
```
⛔ [파이프라인 중단] {현재 단계}
사유: {구체적인 문제 내용}
필요한 조치: {사용자에게 요청하는 것}
```

---

## PHASE 0: 초기화

### 0-A. session.md 읽기

`$ARGUMENTS/session.md`를 읽고 아래 값을 파악하세요:

- `project_path`: 작업할 코드베이스 루트 경로
- `confluence_urls`: 기획서 링크 목록
- `api_doc_urls`: API 설계 문서 링크 목록
- `figma_urls`: Figma 링크 목록
- `figma_notes`: 디자인 이미지별 설명 (이미지 경로 + 케이스 설명)
- `swagger_urls`: Swagger 링크 목록
- `markup.path`: 마크업 파일 경로 (없으면 빈 값)
- `markup.notes`: 마크업 특이사항 (복잡한 UI, 라이브러리 교체 등)
- `be_api_status`: `dev` | `stg` | `none`
- `login_url`, `login_id`, `login_pw`: QA 테스트 계정
- `ticket_prefix`, `epic`, `assignee`: 티켓 메타 정보
- `branch_name`: feature 브랜치명 (선택, 없으면 자동 생성하지 않음)
- `replan`: `true` | 빈 값 — 기획 변경으로 plan/tickets 재생성이 필요한 경우
- `replan_reason`: 기획 변경 사유 (변경된 내용, 추가/변경된 URL 등)
- `notes`: 추가 메모 (슬랙 히스토리, 강조사항 등)

### 0-B. 입력 유효성 검증

1. **project_path 존재 확인**: 디렉토리가 실제로 존재하는지 확인
   - 없으면: ⛔ 중단 → "project_path가 존재하지 않습니다: {경로}"

2. **markup.path 유효성 확인**: 비어있지 않으면 해당 파일이 실제로 존재하는지 확인
   - 없으면: ⛔ 중단 → "markup.path가 지정되었으나 파일이 존재하지 않습니다: {경로}"

3. **필수 자료 링크 확인**: confluence_urls가 비어있으면 경고 후 계속 진행 여부를 사용자에게 확인

### 0-C. 재계획(replan) 감지

`replan: true`인 경우:

1. 기존 파일 백업: `plan.md` → `plan.prev.md`, `tickets.md` → `tickets.prev.md`
2. `_context.md` 삭제 (URL 재수집 필요)
3. STEP 1부터 시작

사용자에게 알립니다:
```
[재계획 모드] replan: true 감지
사유: {replan_reason}
기존 plan.md → plan.prev.md, tickets.md → tickets.prev.md 백업 완료
STEP 1 (계획 수립)부터 재시작합니다.
```

### 0-E. 프로젝트 특화 규칙 로드

`{PROJECT_PATH}/.claude/pipeline-rules.md` 파일이 존재하는지 확인하세요.

**존재하는 경우**: 파일을 읽고 `## PLANNER`, `## DEVELOPER`, `## TICKET`, `## REVIEWER_CONVENTION`, `## REVIEWER_AC`, `## REVIEWER_ARCH`, `## QA` 섹션을 각각 추출하여 해당 변수에 저장하세요. 없는 섹션은 빈 값으로 둡니다.

**존재하지 않는 경우**: 모든 `{RULES_*}` 변수를 빈 값으로 설정합니다.

사용자에게 알립니다:
```
📋 프로젝트 특화 규칙: {로드됨 ({PROJECT_PATH}/.claude/pipeline-rules.md) / 없음 (글로벌 규칙만 적용)}
```

### 0-D. 재실행 감지

`replan`이 아닌 경우, 파일 존재 여부로 시작 단계를 결정합니다:

| plan.md | tickets.md | 시작 단계 |
|---------|-----------|-----------|
| 없음 | 없음 | STEP 1부터 |
| 있음 | 없음 | STEP 2부터 |
| 있음 | 있음 | STEP 3부터 |

재실행 시 사용자에게 현재 상태(markup.path, be_api_status)와 시작 단계를 알립니다.

---

## STEP 1: 계획 수립

### 1-A. 자료 수집

session.md의 URL들을 수집하여 `$ARGUMENTS/_context.md`에 저장하세요.

**URL 수집 방법:**
- `confluence_urls` → URL 도메인에 따라 인증 정보를 선택하여 REST API로 수집:

  **인증 정보 매핑 (환경변수에 저장되어 있음):**
  | URL 도메인 | 이메일 환경변수 | 토큰 환경변수 |
  |-----------|---------------|-------------|
  | `ignitecorp.atlassian.net` | `IGNITE_CONFLUENCE_EMAIL` | `IGNITE_CONFLUENCE_TOKEN` |
  | `hmg.atlassian.net` | `HMG_CONFLUENCE_EMAIL` | `HMG_CONFLUENCE_TOKEN` |

  **수집 순서:**
  1. URL에서 도메인 추출 → 인증 정보 선택
  2. URL에서 page ID 추출 (URL 패턴: `.../pages/{pageId}/...`)
  3. Confluence REST API로 수집:
     ```bash
     curl -sk -u "${EMAIL}:${TOKEN}" \
       -H "Accept: application/json" \
       -H "User-Agent: axios/1.7.0" \
       "https://{domain}/wiki/rest/api/content/{pageId}?expand=body.view,title"
     ```
     **주의**: `-k`와 `User-Agent: axios/1.7.0` 필수 (HMG Atlassian이 curl 기본 UA를 차단)
  4. `.title`과 `.body.view.value` (HTML)를 추출하여 텍스트로 정리
  5. API 실패 시 WebFetch로 재시도 → 모두 실패 시 사용자에게 수동 저장 안내
  6. 하위 페이지 있으면 `/child/page` API로 함께 수집

- `api_doc_urls` → URL을 확인하여:
  - `atlassian.net` 도메인이면 → `confluence_urls`와 동일한 방법(REST API + `-k` + `User-Agent: axios/1.7.0`)으로 수집. 하위 페이지도 `/child/page` API로 확인하여 포함
  - 그 외 URL → WebFetch로 수집
- `swagger_urls` → WebFetch로 수집
- `figma_urls` → `figma_notes`가 있으면 해당 내용을 _context에 포함 + 이미지 경로 기록. `figma_notes`가 없으면 Figma MCP로 구조 데이터 수집 시도 → 실패 시 URL만 기록

**자료 수집 실패 처리:**
- 기획서 URL 모두 실패 + 대체 파일 없음 → ⛔ 중단
- 일부만 실패 → 실패 URL 명시하고 계속

**저장 방식:**
- 합산 ~3000줄 이하: `_context.md` 하나에 통합
- 합산 ~3000줄 초과: `_context-confluence.md`, `_context-api.md`, `_context-figma.md`, `_context-files.md`로 분할 + `_context.md`에 인덱스

### 1-B. Planner Agent 실행

`.claude/commands/pipeline/planner.md`를 읽어 프롬프트를 구성하세요.

변수 치환:
- `{DOCS_DIR}`, `{PROJECT_PATH}`, `{NOTES}` → 실제 값
- `{PREV_PLAN}` → replan 시 plan.prev.md 내용 (아니면 빈 값)
- `{REPLAN_REASON}` → replan 시 replan_reason (아니면 빈 값)
- `{PLANNER_FEEDBACK}` → FAIL 재실행 시 review-plan.md 피드백 (아니면 빈 값)

`Agent(subagent_type: general-purpose)`로 실행.

### 1-C. Plan Reviewer Agent 실행

`.claude/commands/pipeline/plan-reviewer.md`를 읽어 프롬프트를 구성하세요.
`{DOCS_DIR}` → 실제 값으로 치환.
`Agent(subagent_type: general-purpose, model: sonnet)`로 실행.

### 1-D. 검수 결과 처리

`$ARGUMENTS/review-plan.md`를 읽으세요.
- **PASS**: 1-E로 이동
- **FAIL**: 피드백을 `{PLANNER_FEEDBACK}`에 담아 1-B 재실행 (최대 3회)
- 3회 FAIL: 사용자에게 보고 후 중단

### 1-E. ⚠️ BE 확인 필요 항목 사용자 게이트

plan.md PASS 후, STEP 2 진행 전에 반드시 이 단계를 실행하세요.

`$ARGUMENTS/plan.md`의 "4. 의존성 및 확인 필요 사항" 테이블에서
**"BE 확인 필요"** 상태이면서 **코드에 직접 사용되는 값**인 항목을 추출하세요.

해당 항목이 있으면 파이프라인을 일시 중단하고 사용자에게 아래 형식으로 보고하세요:

```
⏸ [사용자 확인 필요] STEP 2 진행 전 BE 정의 값 확인

아래 항목은 코드에 직접 사용되는 값으로, BE가 정의한 값이 필요합니다.
임의로 만들면 실제 API와 불일치가 발생합니다.

| # | 항목 | 왜 필요한가 |
|---|------|-------------|
| 1 | {항목명} | {어디에 사용되는지} |

위 항목들을 확인해 주시면 계속 진행하겠습니다.
(값을 알고 계시다면 바로 알려주세요. 모르신다면 BE팀에 확인 후 알려주세요.)
```

사용자가 값을 제공하면:
1. `$ARGUMENTS/plan.md`의 해당 항목을 확정 값으로 업데이트
2. `$ARGUMENTS/_context.md` 하단에 "## 사용자 확인 완료 값" 섹션으로 추가
3. STEP 2로 이동

해당 항목이 없으면(모두 문서에서 확인됨): 바로 STEP 2로 이동.

---

## STEP 2: 티켓 생성

### 2-A. Ticket Generator Agent 실행

`.claude/commands/pipeline/ticket-generator.md`를 읽어 프롬프트를 구성하세요.

변수 치환:
- `{DOCS_DIR}`, `{PROJECT_PATH}`, `{TICKET_PREFIX}`, `{EPIC}`, `{ASSIGNEE}` → 실제 값
- `{PREV_TICKETS}` → replan 시 tickets.prev.md 내용 (아니면 빈 값)
- `{TICKET_FEEDBACK}` → FAIL 재실행 시 review-tickets.md 피드백 (아니면 빈 값)

`Agent(subagent_type: general-purpose)`로 실행.

### 2-B. Ticket Reviewer Agent 실행

`.claude/commands/pipeline/ticket-reviewer.md`를 읽어 프롬프트를 구성하세요.
`{DOCS_DIR}` → 실제 값으로 치환.
`Agent(subagent_type: general-purpose, model: sonnet)`로 실행.

### 2-C. 검수 결과 처리

`$ARGUMENTS/review-tickets.md`를 읽으세요.
- **PASS**: STEP 3으로 이동
- **FAIL**: 피드백을 담아 2-A 재실행 (최대 3회)
- 3회 FAIL: 사용자에게 보고 후 중단

---

## STEP 3: 개발

### 3-0. Git 브랜치 관리

session.md에 `branch_name`이 지정된 경우:
1. `{PROJECT_PATH}`에서 현재 브랜치 확인
2. 지정 브랜치가 있으면 checkout, 없으면 새로 생성하여 checkout

`branch_name`이 비어있으면 이 단계를 건너뜁니다.

### 3-A. Developer Agent 실행

**사전 준비**: 이전 `$ARGUMENTS/changed-files.md`가 있으면 삭제.

`.claude/commands/pipeline/developer.md`를 읽어 프롬프트를 구성하세요.

변수 치환:
- `{DOCS_DIR}`, `{PROJECT_PATH}`, `{MARKUP_PATH}`, `{MARKUP_NOTES}`, `{BE_API_STATUS}` → 실제 값
- `{DEV_FEEDBACK}` → FAIL 재실행 시 합산 피드백 (아니면 빈 값)

`Agent(subagent_type: general-purpose, model: claude-opus-4-6, isolation: worktree)`로 실행.

**worktree 결과 처리:**
- 검수 PASS 시: worktree 변경사항을 메인 브랜치로 merge
- 검수 FAIL 시: worktree 삭제 후 새 worktree에서 재실행

### 3-B. 코드 검수 (3명 병렬 실행)

changed-files.md 존재 확인 → 없으면 ⛔ 중단.

아래 3개 프롬프트 파일을 각각 읽고, `{DOCS_DIR}`, `{PROJECT_PATH}`를 치환한 뒤,
**단일 응답에서 3개의 Agent를 동시에 호출**하세요 (parallel tool calls):

1. `.claude/commands/pipeline/reviewer-ac.md` → `Agent(subagent_type: general-purpose, model: sonnet)`
2. `.claude/commands/pipeline/reviewer-convention.md` → `Agent(subagent_type: general-purpose, model: sonnet)`
3. `.claude/commands/pipeline/reviewer-architecture.md` → `Agent(subagent_type: general-purpose, model: sonnet)`

### 3-C. 검수 결과 처리

`review-code-ac.md`, `review-code-conv.md`, `review-code-arch.md` 3개를 모두 읽으세요.

- **전원 PASS**: 3-D로 이동
- **하나라도 FAIL**: 3개 피드백을 합산하여 `{DEV_FEEDBACK}`에 담고 3-A 재실행 (최대 3회)
- 3회 FAIL: 사용자에게 보고 후 중단

### 3-D. PR Writer Agent 실행

`.claude/commands/pipeline/pr-writer.md`를 읽어 프롬프트를 구성하세요.
`{DOCS_DIR}` → 실제 값으로 치환.
`Agent(subagent_type: general-purpose, model: sonnet)`로 실행.

---

## STEP 4: QA

### 4-0. QA 환경 검증

Playwright 설치 여부 확인 (`package.json` 또는 `node_modules/@playwright`).

미설치 시 사용자에게 선택지 제시:
```
⚠️ [QA 환경] Playwright가 설치되지 않았습니다.
(1) qa.md(수동 QA 시나리오)만 생성
(2) Playwright 설치 후 자동 테스트도 실행
```

Playwright를 건너뛰는 경우, QA Agent 프롬프트에서 `[PART 1]` 섹션을 제거하고 실행.

### 4-A. QA Agent 실행

`.claude/commands/pipeline/qa.md`를 읽어 프롬프트를 구성하세요.

변수 치환:
- `{DOCS_DIR}`, `{PROJECT_PATH}`, `{LOGIN_URL}`, `{LOGIN_ID}`, `{LOGIN_PW}`, `{BE_API_STATUS}` → 실제 값

`Agent(subagent_type: general-purpose)`로 실행.

### 4-B. QA Reviewer Agent 실행

`.claude/commands/pipeline/qa-reviewer.md`를 읽어 프롬프트를 구성하세요.
`{DOCS_DIR}` → 실제 값으로 치환.
`Agent(subagent_type: general-purpose, model: sonnet)`로 실행.

### 4-C. 검수 결과 처리

`$ARGUMENTS/review-qa.md`를 읽으세요.
- **PASS**: 최종 완료 보고
- **FAIL**: 피드백을 담아 4-A 재실행 (최대 3회)
- 3회 FAIL: 사용자에게 보고 후 중단

---

## 최종 완료 보고

```
## ✅ 파이프라인 완료

### 실행 정보
- 문서 디렉토리: {DOCS_DIR}
- markup 상태: {있음({경로}) / 없음}
- BE API 상태: {be_api_status}
- Plan 검수: PASS ({N}회 시도)
- Ticket 검수: PASS ({N}회 시도)
- 코드 검수: PASS ({N}회 시도)
- QA 검수: PASS ({N}회 시도)

### 생성된 파일
- plan.md — FE 작업 계획
- tickets.md — Jira 티켓 전체 ({N}개, 총 {N}d)
- pr.md — GitLab MR 설명
- qa.md — 외주 QA팀 전달용 시나리오 ({N}케이스)

### 구현된 티켓
| # | 티켓 | 공수 |
|---|------|------|
| N | {제목} | Nd |
| | 합계 | Nd |

### 보류된 티켓 (다음 실행에서 처리)
| # | 티켓 | 사유 |
|---|------|------|
| N | {제목} | {마크업 수령 대기 / BE API 배포 대기} |

### 다음 실행 방법
- 마크업 도착 시: session.md의 markup.path 업데이트 후 /pipeline {DOCS_DIR} 재실행
- BE API 오픈 시: session.md의 be_api_status를 dev 또는 stg로 변경 후 재실행
```

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
- `project_path`: 작업할 코드베이스 루트 경로 (없으면 코드 작업 없음)
- `generic_pipeline`: 직접 지정된 범용 파이프라인 이름 (예: `"테스트2"`)
- `special_rule`: 특수 규칙 파일 이름 (예: `"groupware"`) — 새 방식
- `project_slug`: 프로젝트 슬러그 (예: groupware) — 구 방식, 하위 호환
- `task_type`: 업무유형 슬러그 (예: 신규스펙개발) — 구 방식, 하위 호환
- `confluence_urls`, `api_doc_urls`, `figma_urls`, `figma_notes`
- `swagger_urls`, `markup.path`, `markup.notes`, `be_api_status`
- `login_url`, `login_id`, `login_pw`
- `ticket_prefix`, `epic`, `assignee`
- `branch_name`, `notes`

session.md에 `generic_pipeline`이 없으면 ⛔ 중단합니다. 파이프라인은 필수입니다.

### 0-B. 파이프라인 설정 읽기

**`generic_pipeline`이 session.md에 직접 지정된 경우:**
- `{GENERIC_PIPELINE}` = session.md의 `generic_pipeline` 값
- config.json 로딩은 건너뜁니다 (프로젝트별 규칙 없음)
- STEP 0-B.2로 바로 이동합니다

**`generic_pipeline`이 없는 경우:**
⛔ 중단. 파이프라인이 지정되지 않았습니다.

### 0-B.2 범용 파이프라인 실행 계획 수립

`.claude/commands/generic/{GENERIC_PIPELINE}/pipeline.json`을 Read 도구로 읽으세요.

**pipeline.json이 존재하는 경우 (커스텀 파이프라인):**

pipeline.json의 stages 배열이 실행 순서의 기준이 됩니다.

1. 각 stage의 `id`, `label`, `parallel` 파악
2. config.json에 해당 stage id가 `enabled: false`로 명시된 경우 → 건너뜀

실행 계획 예시:
```
pipeline.json stages: [
  { "id": "process-ticket", "parallel": "tickets" },
  { "id": "merge" },
  { "id": "post-merge-review" }
]
→ 실행 계획:
  순서1: process-ticket — pipeline_inputs.tickets 배열 길이만큼 병렬 실행
  순서2: merge          — 순차
  순서3: post-merge-review — 순차
```

이 실행 계획으로 STEP 1+를 진행합니다.

**pipeline.json이 없는 경우:**
⛔ 중단. pipeline.json이 필수입니다.

### 0-C-0. 범용규칙 로드

`.claude/commands/global-rules.md`를 Read 도구로 읽어 `{GLOBAL_RULES}` 변수에 전체 내용을 저장합니다.
파일이 없으면: `{GLOBAL_RULES}` = 빈 값.

> 범용규칙은 모든 파이프라인·모든 스테이지에 공통 적용됩니다.
> 특수 규칙(`{SPECIAL_RULES}`)과는 별개이며, 둘 다 있으면 둘 다 주입합니다.

### 0-C. 특수 규칙 로드

session.md의 `special_rule` 필드를 확인합니다.

**`special_rule`이 있는 경우:**
`.claude/commands/specials/{special_rule}.md`를 Read 도구로 읽어 `{SPECIAL_RULES}` 변수에 전체 내용을 저장합니다.

**`special_rule`이 없는 경우 (하위 호환):**
`project_slug`와 `task_type`이 있으면 `.claude/commands/projects/{project_slug}/{task_type}/special.md`를 Read 도구로 읽어 `{SPECIAL_RULES}` 변수에 전체 내용을 저장합니다.

파일이 없거나 두 필드 모두 없으면: `{SPECIAL_RULES}` = 빈 값.

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
- `{FIGMA_NOTES}` → session.md의 figma_notes
- `{NOTES}` → session.md의 notes
- `{BRANCH_NAME}` → session.md의 branch_name (없으면 "")
- `{BASE_BRANCH}` → session.md의 base_branch (없으면 "main")
- `{SPECIAL_RULES}` → 0-C에서 로드한 특수 규칙 전체 내용 (없으면 빈 값)
- `{GLOBAL_RULES}` → 0-C-0에서 로드한 범용규칙 전체 내용 (없으면 빈 값)

초기화 완료 후 출력:
```
📍 [init] 파이프라인 초기화 완료
  - 프로젝트: {project_slug} / {task_type}
  - 특수 규칙: {special_rule이 있으면 special_rule 값, 없으면 project_slug/task_type 또는 "없음"}
  - 활성 단계: {enabled 단계 목록, 쉼표 구분}
  - 특수 규칙 로드: {로드됨 / 없음}
  - 코드베이스: {PROJECT_PATH}
```

> ⚠️ 마커 출력 규칙: `📍 [...]` 마커는 반드시 위 형식 그대로 출력하세요. **markdown bold(`**`)를 절대 추가하지 마세요.** 예: `📍 [init]` (O), `📍 **[init]**` (X)

---

## STEP 1+: 단계별 실행

config.json의 stages 배열을 순서대로 순회하며, enabled: true인 단계만 실행합니다.

### 단계 실행 방법

각 단계에 대해:

1. **프롬프트 파일 읽기**: `.claude/commands/generic/{GENERIC_PIPELINE}/{stage.id}.md`를 Read 도구로 읽으세요
2. **변수 치환**: 파일 내 모든 `{변수}` 플레이스홀더를 실제 값으로 치환하세요. `{SPECIAL_RULES}`, `{GLOBAL_RULES}` 플레이스홀더도 각각 0-C, 0-C-0에서 로드한 내용으로 치환합니다 (없으면 빈 문자열). **프롬프트에 `{GLOBAL_RULES}` 플레이스홀더가 없더라도, 범용규칙이 있으면 프롬프트 끝에 자동 추가합니다.**
3. **Agent 실행**: 치환된 프롬프트를 Agent 도구의 prompt 파라미터로 전달하세요
4. **결과 확인**: review 단계는 결과 파일에서 PASS/FAIL을 확인하세요

### Review 스테이지 재시도 (범용)

stage.id에 `-review`가 포함된 스테이지는 결과 산출물에서 `## 판정: FAIL` 또는 `FAIL`을 감지합니다.
FAIL인 경우, 바로 앞 스테이지(review 대상)를 재실행하고 다시 review합니다.
- 최대 3회 재시도
- 3회 모두 FAIL이면 ⛔ 중단
- 재시도 시 이전 review 피드백을 다음 실행 프롬프트에 주입합니다

### 순차 실행 (stage.parallel 없음)

출력:
```
📍 [{stage.id}] {stage.label이 있으면 label, 없으면 stage.id} 시작
```

`.claude/commands/generic/{GENERIC_PIPELINE}/{stage.id}.md`를 Read 도구로 읽어 변수 치환 후 Agent 도구로 실행.

완료 출력:
```
📍 [{stage.id}] 완료
```

**병렬 실행 (stage.parallel 필드가 있는 경우):**

`stage.parallel` 값의 이름을 가진 입력 배열 (session.md의 `pipeline_inputs.{stage.parallel}`) 의 각 항목마다 독립 SubAgent를 동시에 실행합니다.

1. session.md를 Read 도구로 읽어 `pipeline_inputs.{stage.parallel}` 값을 파악한다
2. JSON 배열로 파싱한다 (파싱 실패 시 줄 단위로 분리)
3. `.claude/commands/generic/{GENERIC_PIPELINE}/{stage.id}.md`를 Read 도구로 읽는다
4. 배열의 각 항목(i)마다 아래 변수를 치환하여 SubAgent 프롬프트를 준비한다:
   - `{ITEM}`: items[i] (객체면 JSON.stringify, 문자열이면 그대로)
   - `{ITEM_INDEX}`: i (0부터)
   - `{ITEMS_COUNT}`: 배열 전체 길이
   - 기존 공통 변수들도 모두 치환
5. 시작 마커 출력:
```
📍 [{stage.id}] {stage.label이 있으면 label, 없으면 stage.id} 시작 ({ITEMS_COUNT}개 병렬)
```
6. **단일 Agent 호출**로 모든 SubAgent를 동시에 실행:

```
다음 작업들을 각각 독립된 SubAgent로 동시에 병렬 실행하세요.
모든 SubAgent가 완료될 때까지 기다리세요.

## SubAgent: {stage.id}-0
{stage.md 내용 (ITEM=items[0], ITEM_INDEX=0, ITEMS_COUNT=N으로 치환)}

## SubAgent: {stage.id}-1
{stage.md 내용 (ITEM=items[1], ITEM_INDEX=1, ITEMS_COUNT=N으로 치환)}

...
```

완료 출력:
```
📍 [{stage.id}] 완료
```

> ⚠️ 마커 규칙: 반드시 위 형식 그대로 출력. **markdown bold(`**`) 절대 금지.** 예: `📍 [process-ticket] 시작` (O), `📍 **[process-ticket]**` (X)

---

## 완료

모든 활성 단계가 완료되면:

```
✅ [PIPELINE COMPLETE]
  실행된 단계: {실행된 단계 목록}
  건너뛴 단계: {disabled 단계 목록}
  산출물 위치: {DOCS_DIR}
```

# FE1 Harness

> FE1팀 전용 AI 코드 에이전트 파이프라인 웹 플랫폼

Claude Code 파이프라인을 CLI 없이 웹 UI에서 실행하고, 진행 상황을 실시간으로 모니터링하며, 여러 세션을 병렬로 관리할 수 있는 내부 도구입니다.

---

## 목차

- [배경과 목적](#배경과-목적)
- [주요 기능](#주요-기능)
- [아키텍처](#아키텍처)
- [기술 스택](#기술-스택)
- [시작하기](#시작하기)
- [사용 방법](#사용-방법)
- [파이프라인 구성](#파이프라인-구성)
- [API 모드](#api-모드)
- [병렬 세션과 Git Worktree](#병렬-세션과-git-worktree)
- [디렉토리 구조](#디렉토리-구조)
- [데이터베이스 스키마](#데이터베이스-스키마)
- [API 레퍼런스](#api-레퍼런스)
- [보안 IP 제한](#보안-ip-제한)
- [Sessionmd 포맷](#sessionmd-포맷)

---

## 배경과 목적

FE1팀은 Claude Code를 활용한 AI 파이프라인으로 개발 작업(기획 분석 → 티켓 생성 → 코드 구현 → QA)을 자동화하고 있습니다. 기존에는 각 개발자가 로컬에서 `~/.claude/commands/pipeline.md`를 통해 CLI로 파이프라인을 실행했습니다.

**FE1 Harness**는 이 워크플로우를 웹으로 래핑합니다:

| 기존 방식 | FE1 Harness |
|---|---|
| 터미널에서 `claude` CLI 수동 실행 | 웹 폼으로 입력 후 클릭 한 번으로 실행 |
| 개인 PC의 `~/.claude/commands/`에서 프롬프트 관리 | 레포지토리에 형상관리, 팀 전체 공유 |
| 실행 중 로그를 터미널에서만 확인 | 브라우저에서 실시간 스트리밍으로 확인 |
| 한 번에 하나의 작업만 | 여러 세션을 동시에 실행하고 전환 |
| 세션 이력 없음 | 세션별 로그 저장 및 리플레이 |
| session.md를 직접 작성 | 웹 폼이 session.md를 자동 생성 |

---

## 주요 기능

**파이프라인 실행**
- 웹 폼에서 프로젝트 정보 입력 → 클릭 한 번으로 Claude Code 파이프라인 트리거
- CLI `/pipeline` 명령어와 100% 동일한 동작 (같은 프롬프트를 SDK로 전달)

**실시간 스트리밍**
- Claude의 사고 과정, 도구 호출, 코드 변경 등을 SSE(Server-Sent Events)로 실시간 표시
- `📍 [stage-id]` 마커 파싱으로 동적 진행 표시줄 업데이트
- 재연결 시 Supabase에서 이전 로그를 불러와 자연스럽게 이어보기

**병렬 세션**
- 여러 세션을 동시에 실행하고 사이드바에서 자유롭게 전환
- 각 세션은 Git Worktree로 격리되어 같은 레포지토리에서도 브랜치 충돌 없음

**User Gate**
- 파이프라인이 사용자 확인이 필요할 때 (`⏸ [사용자 확인 필요]`) 자동 감지
- 웹 UI에서 응답 입력 → SDK의 `streamInput()`으로 파이프라인 재개

**Stop & 재실행**
- 실행 중 파이프라인을 즉시 중단
- 중단 후 추가 컨텍스트를 입력하고 재실행 가능 (방향 수정, 추가 요청사항 등)

**파이프라인 관리 UI**
- 범용 파이프라인 프롬프트를 웹에서 직접 편집 (`.claude/commands/generic/`)
- 프로젝트별 설정: 단계 활성/비활성, 특수 규칙, 범용 파이프라인 연결

**멀티 유저**
- fe1-web DB와 연동하여 팀원 목록 및 각 팀원의 토큰(Jira, H-Chat 등) 자동 로드
- 헤더에서 Operator 전환 → 각 팀원의 토큰으로 파이프라인 실행

---

## 아키텍처

```
Browser
  [세션 폼]   ──POST /api/sessions──────────────────────────> 세션 생성
  [RUN 버튼]  ──POST /api/sessions/[id]/run───────────────> 파이프라인 실행
  [SSE 뷰]   <──GET  /api/sessions/[id]/stream────────────  실시간 로그
  [Gate 응답] ──POST /api/sessions/[id]/respond──────────> 파이프라인 재개
  [STOP 버튼] ──POST /api/sessions/[id]/stop─────────────> 즉시 중단

Next.js Server
  executePipeline()
    1. orchestrator.md 읽기 + $ARGUMENTS 치환
    2. query({ prompt, cwd: harnessRoot, env }) 호출
    3. for await (message of q) { 이벤트 파싱 + emit }

  pipelineEventBus (EventEmitter)
    log / progress / status / usergate / done

  Supabase (session_logs)
    모든 로그 영속화 → SSE 재연결 시 히스토리 복원

Claude Agent SDK
  query() → AsyncGenerator<SDKMessage>
  오케스트레이터가 Agent 도구로 서브에이전트를 순차 실행:
  plan → plan-review → ticket → ticket-review →
  develop → develop-review → pr → qa → qa-review
```

**핵심 설계 원칙**: 오케스트레이션 로직을 재구현하지 않습니다.
`orchestrator.md` 내용을 그대로 `prompt`로 전달하므로, CLI에서 `/pipeline {path}` 입력과 완전히 동일한 동작을 보장합니다.

---

## 기술 스택

| 분류 | 기술 |
|------|------|
| Framework | Next.js 16.2.2 (App Router), React 19 |
| AI SDK | `@anthropic-ai/claude-agent-sdk` v0.2.x |
| Database | Supabase (PostgreSQL) |
| UI Components | Radix UI (Select, Switch, Dialog, Tooltip) |
| Styling | Tailwind CSS v4, CSS Variables |
| Runtime | Node.js 20 |
| Language | TypeScript 5 |

---

## 시작하기

### 사전 요구사항

- **Node.js 20** (`.nvmrc` 참조, `nvm use`로 자동 설정)
- **Supabase 계정** (무료 플랜으로 충분)
- **Claude 실행 환경** — 아래 셋 중 하나:
  - H-Chat 토큰 (사내 VPN 필요)
  - Anthropic API 키
  - 로컬에 Claude Max OAuth 세션 (`~/.claude/`)
- fe1-web Supabase 접속 정보 (팀원 토큰 자동 로드에 필요, 없으면 Admin에서 수동 입력)

### 설치

```bash
# 1. 레포지토리 클론
git clone https://github.com/Ignite-FEDev1/fe1-harness.git
cd fe1-harness

# 2. 노드 버전 설정
nvm use

# 3. 의존성 설치
npm install

# 4. 환경 변수 설정
cp .env.example .env.local
# .env.local을 편집합니다 (아래 환경 변수 섹션 참고)

# 5. Supabase 마이그레이션 실행
# Supabase 대시보드 > SQL Editor에서 아래 파일을 순서대로 실행:
#   supabase/migrations/001_initial.sql
#   supabase/migrations/002_user_project_paths.sql
#   supabase/migrations/003_user_settings.sql

# 6. 개발 서버 시작
npm run dev
# http://localhost:3000
```

### Supabase 설정

1. [supabase.com](https://supabase.com)에서 새 프로젝트 생성
2. **Settings > API**에서 `Project URL`과 `anon public` 키 복사
3. **SQL Editor**에서 마이그레이션 파일 3개를 순서대로 실행

```
supabase/migrations/
  001_initial.sql             # projects, sessions, session_logs, session_artifacts
  002_user_project_paths.sql  # 사용자별 프로젝트 로컬 경로 매핑
  003_user_settings.sql       # 사용자별 추가 설정 (Anthropic API Key 등)
```

### 환경 변수

`.env.local` 파일을 생성하고 아래 값을 채웁니다:

```env
# Harness 자체 Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# fe1-web Supabase (팀원 토큰 자동 로드용)
# 없으면 Admin 페이지에서 각 팀원이 수동 입력 가능
FE1_WEB_SUPABASE_URL=https://yyyyyyyy.supabase.co
FE1_WEB_SERVICE_KEY=eyJ...

# GitLab (브랜치 목록 조회용)
GITLAB_URL=https://gitlab.example.com

# IP 제한 (production에서 VPN 외 접근 차단)
# 개발 환경(NODE_ENV=development)에서는 자동 비활성화
DISABLE_IP_RESTRICTION=false
```

> H-Chat 토큰, Jira/Confluence 토큰, GitLab 토큰, Anthropic API 키는
> `.env`가 아닌 **Admin 페이지 > 유저 설정**에서 사용자별로 관리합니다.

---

## 사용 방법

### 최초 설정 (Admin 페이지)

`http://localhost:3000/admin` 접속 후:

**1. Operator 선택**
헤더 우측의 `NO OPERATOR` 클릭 → 본인 이름 선택
(fe1-web DB에서 팀원 목록을 자동으로 불러옵니다)

**2. 토큰 확인 및 입력**
Admin > 내 토큰 섹션에서:
- fe1-web에서 자동으로 가져오는 토큰: Jira, Confluence, H-Chat
- Harness에서 별도 관리하는 토큰: Anthropic API Key, GitLab Token

**3. 프로젝트 등록**
Admin > 프로젝트 섹션에서 프로젝트명과 GitLab URL 입력.
각 팀원이 자신의 로컬 경로를 별도로 입력합니다
(같은 프로젝트라도 팀원마다 로컬 경로가 다르기 때문).

### 세션 생성 및 실행

Sessions 페이지에서 `+ 새 세션` 버튼 클릭 후 폼 작성:

| 항목 | 설명 |
|------|------|
| 세션 이름 | 이 세션을 식별하는 이름 |
| 프로젝트 | 작업할 프로젝트 선택 |
| 업무 유형 | 신규스펙개발 / 간단테스트 / QA수정 등 |
| Confluence URLs | 기획 문서 URL (여러 개 가능) |
| API 문서 URLs | API 명세서 URL |
| Figma URLs | 디자인 파일 URL |
| Swagger URLs | Swagger/OpenAPI 문서 URL |
| 마크업 경로 | 참고할 마크업 파일 경로 |
| BE API 상태 | dev / stg / none |
| 브랜치명 | 작업할 브랜치 (GitLab 브랜치 목록에서 선택 가능) |
| 추가 요청사항 | 자유 형식 추가 컨텍스트 |

`실행` 버튼 클릭 시 내부 동작:
1. 폼 데이터 → `session.md` 자동 생성 (`sessions/{uuid}/session.md`)
2. `orchestrator.md` 읽기 → `$ARGUMENTS` 치환 → Claude SDK에 프롬프트 전달
3. SSE 스트림으로 실시간 로그 수신 시작

### 파이프라인 모니터링

```
[plan] → [plan-review] → [ticket] → [develop] → [qa]   <- 진행 표시줄
         ████████████░░░░░░░░░░░░░░░░░░░░░░░░░

[시스템] API 모드: H-Chat (회사 내부)

📍 [plan]
planner.md를 읽어 기획서를 분석합니다...

[도구] Read: /sessions/uuid/session.md
[도구] WebFetch: https://confluence.example.com/...
[도구] Agent: 기획 분석 에이전트

📍 [plan-review]
계획서 검수 중...
                                                          ⏹ STOP
```

- **진행 표시줄**: 오케스트레이터가 `📍 [stage-id]`를 출력할 때 자동 업데이트
- **다른 세션 전환**: 사이드바 클릭으로 자유롭게 전환, 현재 세션은 백그라운드 실행 유지
- **세션 재접속**: 새로고침해도 Supabase에서 기존 로그를 불러와 이어보기

### User Gate 응답

파이프라인이 `⏸ [사용자 확인 필요]`를 출력하면:
- 세션이 `paused` 상태로 전환되고 응답 입력창이 표시됩니다
- 응답 입력 후 전송하면 SDK의 `streamInput()`으로 파이프라인이 재개됩니다

### 중단 및 재실행

- **⏹ STOP**: 파이프라인 즉시 중단
- 중단 후 추가 컨텍스트를 입력하고 **RE-RUN** 버튼으로 재실행 가능
- 추가 컨텍스트는 기존 `notes`에 구분자로 합쳐져 재실행됩니다

---

## 파이프라인 구성

### 파이프라인 계층 구조

```
.claude/commands/
├── orchestrator.md              # 동적 파이프라인 오케스트레이터 (메인)
├── pipeline.md                  # 레거시 파이프라인 (하위 호환)
│
├── generic/                     # 범용 파이프라인 (업무유형별 프롬프트)
│   ├── 신규스펙개발/
│   │   ├── plan.md
│   │   ├── plan-review.md
│   │   ├── ticket.md
│   │   ├── ticket-review.md
│   │   ├── develop.md
│   │   ├── develop-review.md
│   │   ├── pr.md
│   │   ├── qa.md
│   │   └── qa-review.md
│   ├── 간단테스트/               # 경량 파이프라인 (PR 단계 없음)
│   └── QA수정/                  # QA 이후 수정 작업
│
└── projects/                    # 프로젝트별 커스텀 설정
    ├── groupware/
    │   ├── 신규스펙개발/
    │   │   ├── config.json      # 단계 활성화 설정 + genericPipeline 연결
    │   │   └── special.md       # 프로젝트별 추가 규칙
    │   └── 간단테스트/
    └── cpo/
        └── 신규스펙개발/
```

### 범용 파이프라인

업무유형별 에이전트 프롬프트 묶음입니다. Pipelines 페이지에서 새로 추가하거나 기존 프롬프트를 직접 편집할 수 있습니다.

프롬프트 내 사용 가능한 변수:

| 변수 | 값 |
|------|-----|
| `{DOCS_DIR}` | 세션 데이터 디렉토리 절대 경로 (`sessions/{uuid}/`) |
| `{PROJECT_PATH}` | 코드베이스 루트 절대 경로 |
| `{BRANCH_NAME}` | 작업 브랜치명 |
| `{BASE_BRANCH}` | 베이스 브랜치명 (기본: `main`) |
| `{TICKET_PREFIX}` | Jira 티켓 접두사 (예: `FE-`) |
| `{GENERIC_PIPELINE}` | 범용 파이프라인 이름 |

### 프로젝트별 설정

`config.json`으로 프로젝트 + 업무유형 조합별 파이프라인을 조정합니다:

```json
{
  "label": "신규 스펙 개발",
  "description": "Confluence 기획 → 티켓 → 구현 → QA 전체 파이프라인",
  "genericPipeline": "신규스펙개발",
  "stages": [
    { "id": "plan",           "enabled": true  },
    { "id": "plan-review",    "enabled": true  },
    { "id": "ticket",         "enabled": true  },
    { "id": "ticket-review",  "enabled": false },
    { "id": "develop",        "enabled": true  },
    { "id": "develop-review", "enabled": true  },
    { "id": "pr",             "enabled": true  },
    { "id": "qa",             "enabled": true  },
    { "id": "qa-review",      "enabled": false }
  ]
}
```

`enabled: false`인 단계는 오케스트레이터가 건너뜁니다.

### 단계(Stage) 목록

| Stage ID | 한국어 | 설명 |
|----------|--------|------|
| `plan` | 기획 분석 | Confluence/Figma/Swagger 문서를 분석해 `plan.md` 생성 |
| `plan-review` | 계획 검수 | plan.md를 검수해 PASS/FAIL 판정 |
| `ticket` | 티켓 생성 | plan.md 기반으로 Jira 티켓 형태의 `tickets.md` 생성 |
| `ticket-review` | 티켓 검수 | 티켓 AC 완결성, 우선순위 등 검수 |
| `develop` | 코드 구현 | tickets.md 기반으로 Git Worktree에서 구현 후 커밋 |
| `develop-review` | 코드 검수 | AC 달성 여부, 아키텍처, 컨벤션 3가지 병렬 검수 |
| `pr` | PR 작성 | `changed-files.md` 기반으로 PR 설명 자동 작성 |
| `qa` | QA 체크리스트 | 구현 내용 기반으로 검증 시나리오 작성 |
| `qa-review` | QA 검수 | QA 체크리스트 완결성 검수 |

### 특수 규칙 (special.md)

프로젝트 + 업무유형 조합별로 에이전트에게 추가 컨텍스트를 주입합니다.
`## SECTION명` 헤더로 각 에이전트에 주입될 규칙을 구분합니다:

```markdown
## PLANNER
이 프로젝트는 React Query v5를 사용합니다.
서버 상태와 클라이언트 상태를 엄격히 분리해주세요.

## DEVELOPER
- emotion 대신 Tailwind CSS를 사용합니다
- API 호출은 반드시 /src/apis/ 디렉토리에 모듈화
- any 타입 사용 금지

## REVIEWER_AC
BE API가 미완성인 경우 목업 구현도 AC 달성으로 간주합니다.
```

사용 가능한 섹션:
`PLANNER`, `DEVELOPER`, `TICKET`, `TICKET_REVIEWER`, `REVIEWER_AC`, `REVIEWER_ARCH`, `REVIEWER_CONVENTION`, `QA`, `QA_REVIEWER`

---

## API 모드

파이프라인 실행 시 사용할 Claude API를 선택합니다.

| 모드 | 설명 | 필요 조건 | 사용 모델 |
|------|------|-----------|-----------|
| **H-CHAT** | 사내 Claude API | VPN 연결 + H-Chat API Key | claude-sonnet-4-6 |
| **CLAUDE MAX** | 로컬 OAuth 세션 | `~/.claude/`에 로그인된 Claude Max 세션 | claude-opus-4-6 |
| **ANTHROPIC** | Anthropic 직접 API | `ANTHROPIC_API_KEY` 설정 | claude-opus-4-6 |

> **H-CHAT 주의사항**: 사내 VPN(`58.87.60.x` 대역)에 연결된 상태에서만 동작합니다.
> H-Chat은 `claude-opus-4-6`을 지원하지 않아 `claude-sonnet-4-6`을 사용합니다.

모드 선택 방법:
- **헤더 토글**: 전역 기본값 변경
- **세션 폼**: 세션 생성 시 해당 세션에만 개별 적용

---

## 병렬 세션과 Git Worktree

여러 세션을 같은 레포지토리에서 동시에 실행할 때 파일 충돌을 방지하기 위해 **Git Worktree**를 사용합니다.

`develop` 단계 실행 시:

```bash
cd {PROJECT_PATH}

# 각 세션의 DOCS_DIR이 고유하므로 워크트리 경로도 고유
WORKTREE="{DOCS_DIR}/worktree"

# 브랜치가 있으면 체크아웃, 없으면 새로 생성
if git show-ref --verify --quiet refs/heads/{BRANCH_NAME}; then
  git worktree add "$WORKTREE" {BRANCH_NAME}
else
  git worktree add -b {BRANCH_NAME} "$WORKTREE" {BASE_BRANCH}
fi

# 모든 파일 작업은 $WORKTREE 안에서 수행
# 구현 완료 후:
cd "$WORKTREE" && git add -A && git commit -m "feat: {구현 내용 요약}"
```

세션 종료(완료/에러/중단) 시 `executor.ts`의 `finally` 블록에서 워크트리를 자동 정리합니다.
이를 통해 3개 세션이 같은 레포에서 서로 다른 브랜치로 동시에 작업해도 충돌이 없습니다.

---

## 디렉토리 구조

```
fe1-harness/
├── .claude/
│   └── commands/
│       ├── orchestrator.md          # 메인 오케스트레이터 프롬프트
│       ├── pipeline.md              # 레거시 파이프라인
│       ├── pipeline/                # 레거시 서브에이전트 프롬프트
│       ├── generic/                 # 범용 파이프라인 (업무유형별)
│       │   ├── 신규스펙개발/
│       │   ├── 간단테스트/
│       │   └── QA수정/
│       └── projects/                # 프로젝트별 설정
│           ├── groupware/
│           └── cpo/
│
├── sessions/                        # 세션 데이터 (gitignore)
│   └── {session-uuid}/
│       ├── session.md               # 세션 입력값 (YAML)
│       ├── plan.md                  # 기획 분석 결과
│       ├── tickets.md               # 티켓 목록
│       ├── changed-files.md         # 구현된 파일 목록 + 커밋 정보
│       ├── qa.md                    # QA 체크리스트
│       └── worktree/                # Git Worktree (실행 중에만 존재)
│
├── src/
│   ├── app/
│   │   ├── sessions/                # 세션 목록 + 상세 페이지
│   │   ├── pipelines/               # 파이프라인 관리 UI
│   │   ├── admin/                   # 설정 페이지 (유저, 토큰, 프로젝트)
│   │   ├── chat/                    # 직접 채팅 (단일 Claude 쿼리)
│   │   ├── test/                    # 테스트 파이프라인
│   │   └── api/                     # API Routes
│   │       ├── sessions/[id]/
│   │       │   ├── run/             # 파이프라인 실행
│   │       │   ├── stream/          # SSE 스트리밍
│   │       │   ├── stop/            # 즉시 중단
│   │       │   └── respond/         # User Gate 응답
│   │       ├── pipelines/           # 파이프라인 설정 CRUD
│   │       ├── users/               # 유저 + 토큰 관리
│   │       └── projects/            # 프로젝트 CRUD
│   │
│   ├── components/
│   │   ├── layout/AppHeader.tsx     # 헤더 (네비게이션, API 모드, 유저)
│   │   ├── session-form/            # 세션 생성 폼
│   │   ├── sidebar/SessionList.tsx  # 세션 사이드바
│   │   └── streaming/              # 실시간 스트리밍 뷰
│   │       ├── StreamingView.tsx    # 메인 스트리밍 컨테이너
│   │       ├── ProgressBar.tsx      # 동적 단계 진행 표시줄
│   │       ├── LogEntry.tsx         # 로그 라인 렌더링
│   │       └── UserGateInput.tsx    # User Gate 입력 UI
│   │
│   ├── hooks/
│   │   ├── useSessionStream.ts      # SSE EventSource 훅
│   │   └── useSessionList.ts        # 세션 목록 관리
│   │
│   ├── lib/
│   │   ├── pipeline/
│   │   │   ├── executor.ts          # SDK query() 실행 + 이벤트 처리
│   │   │   ├── event-bus.ts         # 세션별 EventEmitter
│   │   │   ├── progress-parser.ts   # 📍 마커 파싱
│   │   │   ├── active-queries.ts    # 실행 중 Query 객체 관리
│   │   │   └── session-md-generator.ts  # 폼 → session.md 변환
│   │   └── supabase/
│   │       ├── client.ts            # 클라이언트 사이드
│   │       ├── server.ts            # 서버 사이드 (harness DB)
│   │       └── fe1-web.ts           # fe1-web DB 연결
│   │
│   └── contexts/
│       └── UserContext.tsx          # 유저 / API 모드 전역 상태
│
├── supabase/
│   └── migrations/                  # DB 마이그레이션 SQL
│
├── instrumentation.ts               # 서버 시작 시 orphaned 세션 정리
├── middleware.ts                    # VPN IP 제한 미들웨어
└── .env.example                     # 환경 변수 예시
```

---

## 데이터베이스 스키마

```sql
-- 프로젝트 정보
projects (
  id uuid PK,
  name text,
  repo_url text,
  project_path text,           -- 선택사항 (user_project_paths로 대체 가능)
  description text,
  created_at timestamptz
)

-- 세션 (파이프라인 실행 단위)
sessions (
  id uuid PK,
  project_id uuid FK -> projects,
  name text,
  status text,                 -- idle | running | paused | completed | error | stopped
  docs_dir text,               -- sessions/{uuid}/ 절대 경로
  form_data jsonb,             -- 세션 폼 입력값 전체
  current_step integer,        -- 레거시 진행 단계
  error_message text,
  created_at timestamptz,
  updated_at timestamptz
)

-- 실시간 로그 + 이벤트 (SSE 재연결 시 히스토리 복원)
session_logs (
  id uuid PK,
  session_id uuid FK -> sessions ON DELETE CASCADE,
  content text,
  event_type text,             -- log | progress | usergate | status
  created_at timestamptz
)

-- 세션 산출물
session_artifacts (
  id uuid PK,
  session_id uuid FK -> sessions ON DELETE CASCADE,
  filename text,
  content text,
  created_at timestamptz
)

-- 사용자별 프로젝트 로컬 경로
user_project_paths (
  id uuid PK,
  user_id text,                -- fe1-web의 사용자 ID
  project_id uuid FK -> projects,
  local_path text,
  UNIQUE(user_id, project_id)
)

-- 사용자별 추가 설정 (Anthropic API Key 등)
user_settings (
  id uuid PK,
  user_id text,
  key text,                    -- 예: ANTHROPIC_API_KEY, GITLAB_TOKEN
  value text,
  UNIQUE(user_id, key)
)
```

---

## API 레퍼런스

| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/api/sessions` | 전체 세션 목록 조회 |
| `POST` | `/api/sessions` | 새 세션 생성 |
| `GET` | `/api/sessions/[id]` | 세션 상세 조회 |
| `PATCH` | `/api/sessions/[id]` | 세션 정보 수정 |
| `DELETE` | `/api/sessions/[id]` | 세션 삭제 |
| `POST` | `/api/sessions/[id]/run` | 파이프라인 실행 시작 |
| `GET` | `/api/sessions/[id]/stream` | SSE 스트리밍 구독 |
| `POST` | `/api/sessions/[id]/stop` | 파이프라인 즉시 중단 |
| `POST` | `/api/sessions/[id]/respond` | User Gate 응답 전송 |
| `GET` | `/api/pipelines` | 전체 파이프라인 목록 |
| `POST` | `/api/pipelines` | 새 프로젝트 파이프라인 설정 생성 |
| `GET` | `/api/pipelines/projects/[slug]/[taskType]` | 프로젝트 파이프라인 설정 조회 |
| `PUT` | `/api/pipelines/projects/[slug]/[taskType]` | 프로젝트 파이프라인 설정 저장 |
| `GET` | `/api/pipelines/generic` | 범용 파이프라인 목록 |
| `POST` | `/api/pipelines/generic` | 새 범용 파이프라인 생성 |
| `GET` | `/api/pipelines/generic/[taskType]/[stage]` | 범용 스테이지 프롬프트 조회 |
| `PUT` | `/api/pipelines/generic/[taskType]/[stage]` | 범용 스테이지 프롬프트 저장 |
| `GET` | `/api/users` | 팀원 목록 + 토큰 정보 조회 |
| `PUT` | `/api/users/tokens` | 토큰 값 수정 |
| `GET` | `/api/projects` | 프로젝트 목록 |
| `POST` | `/api/projects` | 새 프로젝트 등록 |
| `GET` | `/api/gitlab/branches` | GitLab 브랜치 목록 조회 |
| `POST` | `/api/chat` | 단일 Claude 쿼리 (채팅 페이지용) |

### SSE 이벤트 포맷

`GET /api/sessions/[id]/stream`으로 수신되는 이벤트:

```
event: log
data: {"content": "Planner 에이전트 실행 중...", "timestamp": "2026-04-01T10:00:00.000Z"}

event: progress
data: {"stageId": "plan"}

event: status
data: {"status": "running"}

event: usergate
data: {"prompt": "BE API 연동 방식을 선택해주세요"}

event: done
data: {}
```

---

## 보안 IP 제한

프로덕션 환경(`NODE_ENV=production`)에서는 사내 VPN IP 대역에서만 접근 가능합니다.

허용 대역:
- `58.87.60.0/24`
- `58.87.61.0/24`
- `58.87.63.0/24`
- `127.0.0.1`, `::1` (로컬호스트)

VPN 외 IP에서 접근 시 `403` 차단 페이지를 반환합니다.

개발 환경(`NODE_ENV=development`)에서는 IP 제한이 자동 비활성화됩니다.
환경 변수 `DISABLE_IP_RESTRICTION=true`로도 비활성화할 수 있습니다.

---

## Sessionmd 포맷

웹 폼 입력은 아래 YAML 포맷으로 `sessions/{uuid}/session.md`에 저장됩니다.
오케스트레이터는 이 파일을 읽어 작업 컨텍스트를 파악합니다.

```yaml
project_path: /Users/username/repos/assemble-fe
project_slug: groupware
task_type: 신규스펙개발

confluence_urls:
  - https://company.atlassian.net/wiki/pages/12345
  - https://company.atlassian.net/wiki/pages/67890

api_doc_urls:
  - https://company.atlassian.net/wiki/pages/api-spec

figma_urls:
  - https://figma.com/file/abc123/Design

figma_notes: |
  메인 페이지 디자인. 컴포넌트 B, C 섹션을 중점 참고.

swagger_urls:
  - https://api.company.com/swagger

markup:
  path: /path/to/reference-markup.tsx
  notes: |
    emotion CSS 사용. 이 파일의 레이아웃 구조를 참고.

be_api_status: dev

login_url: https://dev.company.com
login_id: test@company.com
login_pw: test1234

ticket_prefix: FE-
epic: EPIC-100
assignee: 홍길동

branch_name: feature/FE-123-main-page
base_branch: develop

notes: |
  기존에 구현된 TableComponent를 재사용해주세요.
  API 응답이 느리면 로딩 스켈레톤 추가 필수.
```

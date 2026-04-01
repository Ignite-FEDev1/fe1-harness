# FE1 Harness — 프로젝트 기획서

## 1. 개요

fe1팀 전용 AI 코드 에이전트 하네스 플랫폼.
개발자가 프로젝트와 업무 성격에 맞는 harness 환경에서 Claude Code 파이프라인을 웹 UI로 실행하고, 진행 상황을 실시간으로 확인하며, 필요 시 개입할 수 있는 서비스.

### 대상

- fe1팀 개발자

### 핵심 가치

- session.md를 수동으로 작성하는 대신, 웹 폼으로 입력하면 harness가 자동 실행
- CLI 터미널 없이 웹에서 Claude Code의 실시간 출력을 확인
- 프로젝트별로 다른 harness(에이전트 프롬프트)를 웹에서 관리
- 여러 세션을 누적 관리하고, 이전 세션으로 돌아가서 이어서 작업 가능

---

## 2. 참고자료

- `~/Desktop/ignite/codehive`: 다른 팀이 만든 SaaS. 웹에서 Claude Code를 실행하는 구조, Docker 컨테이너 기반 세션 관리, SSE 기반 실시간 로그 스트리밍 등 내부 로직 참고
- `~/.claude/commands/pipeline.md` + `~/.claude/commands/pipeline/`: 현재 로컬에 구축된 4단계 파이프라인 harness (plan → tickets → dev → QA). 에이전트 프롬프트, 변수 치환, 리뷰/재시도 루프 등 파이프라인 설계 참고
- `~/Desktop/ignite/groupware/assemble-fe/.claude/pipeline-rules.md`: 프로젝트별 harness 규칙 예시

---

## 3. 기술 스택

| 영역 | 기술 |
|---|---|
| 프레임워크 | Next.js (App Router), TypeScript |
| DB / Auth | Supabase |
| Claude Code 실행 | `@anthropic-ai/claude-code` SDK (로컬에서 기존 pipeline.md를 그대로 실행) |
| 실시간 통신 | SSE 또는 WebSocket |
| 배포 | 로컬 실행 기본 (`npm run dev` 또는 `docker run`) |

> Vercel 배포는 하지 않음. Claude Code가 로컬에서 실행되어야 하고, 내부망 API 접근이 필요하기 때문.

---

## 4. 실행 환경

- 각 개발자의 로컬 PC에서 Next.js 앱을 실행 (`npm run dev` 또는 `docker run`)
- Claude Code가 로컬에 설치되어 있어야 함
- **pipeline harness는 이 웹 앱 레포의 `.claude/commands/`에 형상관리** (개인 `~/.claude/commands/`가 아님)
  - 팀원 누구나 동일한 pipeline을 실행하게 됨
  - SDK 호출 시 `cwd`를 이 레포 경로로 지정하여 `.claude/commands/pipeline.md`를 참조
  - harness 설정 화면에서 수정한 에이전트 프롬프트도 이 레포에 반영 (또는 Supabase에서 읽어서 동적 주입)
- 웹 앱은 `@anthropic-ai/claude-code` SDK를 통해 **기존 pipeline.md 커맨드를 그대로 호출**
- 파이프라인 내부의 에이전트 호출, 리뷰/재시도 루프, worktree 관리 등은 모두 기존 pipeline.md 로직이 처리
- 웹 앱의 역할: 실행 트리거 + 스트리밍 출력 표시 + 세션/harness 관리
- 내부망 API(Jira, GitLab, Confluence 등)는 로컬 네트워크에서 직접 접근

---

## 5. 사용자 흐름

### 5-1. 초기 설정 (어드민)

사용을 위해 어드민 페이지에서 자신의 인증 정보를 등록해야 함:

| 항목 | 용도 |
|---|---|
| HMG_JIRA_TOKEN, HMG_JIRA_EMAIL | HMG Jira 연동 |
| IGNITE_JIRA_TOKEN, IGNITE_JIRA_EMAIL | Ignite Jira 연동 |
| H_CHAT_TOKEN | H-Chat 연동 |
| PERSONAL_CLAUDE_TOKEN | Claude API 인증 |
| PERSONAL_OPENAI_TOKEN | OpenAI API 인증 |
| GITLAB_EMAIL, GITLAB_TOKEN | GitLab 연동 (브랜치 조회/생성, 코드 push) |

> Supabase에 암호화 저장. 세션 실행 시 해당 사용자의 토큰을 주입.

### 5-2. 세션 생성

"+ 새 세션" 클릭 → 세션 설정 팝업이 열림.

입력 항목 (현재 `session.md`의 웹 폼 버전):

| 순서 | 항목 | 설명 | 비고 |
|---|---|---|---|
| 1 | 프로젝트 선택 | 등록된 프로젝트 중 선택 | 선택 시 해당 프로젝트의 harness가 자동 연결 |
| 2 | 업무 종류 선택 | 프로젝트에 정의된 업무 유형 | 선택 시 아래 입력 필드가 열림 |
| 3 | 기획서 링크 | Confluence URL 등 (복수 입력 가능) | session.md의 `confluence_urls` |
| 4 | API 설계 링크 | API 문서 URL (복수 입력 가능) | session.md의 `api_doc_urls` |
| 5 | 피그마 링크 | Figma URL (복수 입력 가능) | session.md의 `figma_urls` |
| 6 | 피그마 노트 | 디자인 보충 설명 | session.md의 `figma_notes` |
| 7 | Swagger URL | API 스펙 (복수 입력 가능) | session.md의 `swagger_urls` |
| 8 | 마크업 경로 | 마크업 파일 경로 | session.md의 `markup.path` |
| 9 | 마크업 특이사항 | UI 관련 노트 | session.md의 `markup.notes` |
| 10 | BE API 상태 | `none` / `dev` / `stg` 선택 | session.md의 `be_api_status` |
| 11 | 로그인 정보 | QA용 URL, ID, PW | session.md의 `login_*` |
| 12 | 티켓 정보 | prefix, epic, assignee | session.md의 `ticket_*` |
| 13 | GitLab 브랜치 | GitLab API로 브랜치 목록 조회 → 선택 | 없으면 base 브랜치 선택 후 자동 생성 |
| 14 | 추가 메모 | 작업자가 강조하고 싶은 내용, 요청사항 | session.md의 `notes` |

### 5-3. 파이프라인 실행

사용자가 팝업에서 정보를 입력하고 "확인"을 누르면 자동으로 pipeline이 트리거됨. 사용자가 `/pipeline`을 직접 입력하는 것이 아님.

**실행 흐름:**
1. 사용자가 세션 생성 팝업에서 모든 항목 입력 후 "확인" 클릭
2. 웹 앱이 입력값으로 `session.md` 파일을 자동 생성하여 `{docs_dir}`에 배치
3. 웹 앱이 `@anthropic-ai/claude-code` SDK를 통해 pipeline.md를 자동 호출 (내부적으로 `/pipeline {docs_dir}`)
4. 이후 파이프라인 내부의 모든 로직(에이전트 호출, 리뷰/재시도, worktree, user gate 등)은 **기존 pipeline.md가 100% 동일하게 처리**

**핵심 원칙:**
- 사용자는 웹 폼만 채우면 됨. CLI 명령어를 알 필요 없음
- 기존 pipeline.md를 그대로 실행. 오케스트레이터를 재구현하지 않음
- 웹 앱의 역할: 폼 → session.md 생성 → pipeline 트리거 → 스트리밍 출력 표시 → 세션/harness 관리

파이프라인 4단계 (기존 pipeline.md 그대로):

```
STEP 1: 기획 분석 (Planning)
  → 리소스 수집 (_context.md)
  → Planner 에이전트 → plan.md
  → Plan Reviewer → review-plan.md
  → FAIL 시 최대 3회 재시도
  → "BE 확인 필요" 항목 → User Gate (사용자 확인 대기)

STEP 2: 티켓 생성 (Tickets)
  → Ticket Generator → tickets.md
  → Ticket Reviewer → review-tickets.md
  → FAIL 시 최대 3회 재시도

STEP 3: 개발 (Development)
  → Git 브랜치 생성/체크아웃
  → Developer 에이전트 (worktree 격리) → 코드 + changed-files.md
  → 3명 병렬 리뷰 (AC, Convention, Architecture)
  → ANY FAIL 시 최대 3회 재시도
  → PR Writer → pr.md

STEP 4: QA
  → QA 에이전트 → qa.md (+ Playwright 테스트)
  → QA Reviewer → review-qa.md
  → FAIL 시 최대 3회 재시도
```

### 5-4. 실시간 UI

**메인 화면 구성:**

```
┌─────────────────────────────────────────────────┐
│ Header                                          │
├────────┬────────────────────────────────────────┤
│        │ [STEP 1] → [STEP 2] → [STEP 3] → [STEP 4] │  ← 진행바
│ 사이드 │────────────────────────────────────────│
│  바    │                                        │
│        │  Claude Code 실시간 출력 영역           │
│ ● 세션1│  (스트리밍)                             │
│ ● 세션2│                                        │
│ ○ 세션3│  - 에이전트의 사고 과정                  │
│        │  - 도구 호출 (파일 읽기/쓰기 등)         │
│        │  - 코드 변경 diff                       │
│        │  - 리뷰 결과                            │
│        │                                        │
│        │────────────────────────────────────────│
│        │ [User Gate 개입 영역 — 필요 시 표시]     │
└────────┴────────────────────────────────────────┘
```

**진행바:**
- 전체 4단계 구조를 항상 상단에 표시
- 미진행 단계: 회색 (비활성)
- 현재 진행 중: 하이라이트 (활성 색상 + 애니메이션)
- 완료 단계: 완료 색상
- 각 단계 내부의 세부 상태도 표시 (예: "리뷰 중 2/3", "재시도 1/3")

**스트리밍 출력:**
- Claude Code SDK의 스트리밍 출력을 SSE로 브라우저에 전달
- pipeline.md가 출력하는 `📍 [STEP N/4]` 마커를 파싱하여 진행바 UI를 자동 업데이트
- 에이전트의 사고 과정, 도구 호출, 코드 변경 등 모든 출력이 실시간으로 표시

**User Gate (사용자 개입):**
- 현재 pipeline과 동일한 방식: pipeline.md가 자동 진행되다가 특정 시점에 사용자 확인을 기다림
- 예: "BE 확인 필요" 항목이 있을 때, plan 리뷰 결과 확인 등
- pipeline.md가 사용자 입력을 요청하면, 웹 UI에 입력 영역이 나타나고 사용자가 응답하면 SDK를 통해 전달

### 5-5. 세션 관리

**사이드바:**
- 누적된 세션 목록 표시 (최근 순)
- 각 세션의 상태를 dot color로 표시:
  - 🟡 노란색: 진행 중
  - 🟢 초록색: 완료
  - 🔴 빨간색: 에러/중단
  - ⚪ 회색: 대기 (idle)
- 클릭 시 해당 세션으로 이동, 이전 출력 로그 확인 및 이어서 작업 가능

**세션 상태:** `idle` → `running` → `paused` → `completed` / `error`

---

## 6. Harness 설정 화면

프로젝트별로 harness(에이전트 프롬프트)를 웹에서 관리하는 화면.

### 6-1. 구조

- 프로젝트 선택 → 업무 종류 선택 → 해당 harness의 에이전트 프롬프트 목록 표시
- 각 에이전트 프롬프트(planner.md, developer.md, reviewer-ac.md 등)를 개별 편집 가능

### 6-2. 편집 방식

1. **직접 편집**: 마크다운 에디터에서 프롬프트 내용을 직접 수정
2. **AI 명령으로 수정**: 자연어로 지시하면 해당 프롬프트에 반영
   - 예: "cpo 프로젝트, shared/api를 참고해서 작업하도록 해줘"
   - → `cpo-developer.md`에 해당 내용이 자동 반영

### 6-3. 저장

- 에이전트 프롬프트는 Supabase에 저장
- 프로젝트 + 업무 종류 조합별로 harness 프롬프트 세트가 독립적으로 관리됨

### 6-4. MVP

- 현재 로컬에 구축된 groupware 프로젝트의 harness를 초기 데이터로 등록
- groupware harness로 먼저 테스트 후 다른 프로젝트로 확장

---

## 7. GitLab 연동

- 세션 생성 시 GitLab API로 해당 프로젝트의 브랜치 목록을 조회하여 드롭다운으로 표시
- 사용자가 기존 브랜치를 선택하거나, 새 브랜치명을 입력
- 새 브랜치인 경우 base 브랜치를 선택하게 하고, 파이프라인 STEP 3에서 자동 생성
- 사용자의 GITLAB_TOKEN을 사용하여 API 호출

---

## 8. 데이터 모델 (Supabase)

### 주요 테이블

| 테이블 | 설명 |
|---|---|
| `users` | 사용자 정보 + 인증 토큰들 (암호화) |
| `projects` | 등록된 프로젝트 (이름, repo URL, project_path 등) |
| `harness_prompts` | 프로젝트 + 업무종류별 에이전트 프롬프트 (planner, developer 등) |
| `sessions` | 세션 정보 (입력값, 상태, 프로젝트, 업무종류) |
| `session_logs` | 세션별 실시간 로그 (스트리밍 출력 저장) |
| `session_artifacts` | 세션별 산출물 (plan.md, tickets.md, changed-files.md 등) |

---

## 9. MVP 범위

1차 MVP는 다음 범위로 한정:

- [x] 어드민: 사용자 토큰 등록
- [x] 세션 생성: 웹 폼으로 session.md 대체
- [x] 파이프라인 실행: groupware harness 4단계 자동 실행
- [x] 실시간 스트리밍: Claude Code 출력을 웹에서 확인
- [x] 진행바: 4단계 진행 상태 시각화
- [x] User Gate: 파이프라인 중 사용자 확인 대기
- [x] 세션 사이드바: 세션 목록 + 상태 dot + 이전 세션 복귀
- [x] GitLab 브랜치: 조회/선택/생성
- [ ] Harness 설정 화면 (MVP 이후)
- [ ] 멀티 프로젝트 지원 (MVP 이후)
- [ ] AI 명령으로 프롬프트 수정 (MVP 이후)

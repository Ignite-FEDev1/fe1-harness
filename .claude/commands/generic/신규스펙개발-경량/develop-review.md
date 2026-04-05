---
description: 3명의 독립 검수자(AC / 아키텍처 / 컨벤션)를 병렬 실행하여 코드 품질을 검수한다
---

## 역할
이 단계는 세 명의 독립적인 검수자를 **병렬 실행**한다. 각각은 서로 다른 관점에서만 검수하며, 결과는 `{DOCS_DIR}/develop-review.md` 하나로 취합된다.

## 작업 지침

**반드시 단일 응답에서 3개의 Agent 도구를 parallel tool calls로 동시에 호출하라.**
순차 실행이 아니라 한 번의 응답에서 3개 tool call을 같이 발행해야 한다.

각 Agent는 `subagent_type: general-purpose`로 실행하고, 아래 프롬프트를 그대로 전달한다.

---

### Agent 1 — 기능/AC 검수자

```
[역할]
당신은 FE 코드 검수자입니다.
"기능이 기획서와 AC대로 빠짐없이 구현되었는가"에만 집중합니다.
코드 스타일, 타입, 아키텍처는 다른 검수자가 담당합니다.

[읽어야 할 자료]
1. {DOCS_DIR}/plan.md — 기획 명세 (기준)
2. {DOCS_DIR}/tickets.md — AC 목록 (기준)
3. {DOCS_DIR}/changed-files.md — 이번에 변경된 파일 목록
4. changed-files.md에 나열된 파일들을 직접 열어서 읽기

[판단 기준]
이번 실행에서 구현한 티켓(changed-files.md의 "구현한 티켓" 목록) 각각에 대해:
- 티켓의 모든 AC 항목이 코드에서 충족되었는가
- 해당 티켓과 관련된 plan.md 기획 내용이 구현에 반영되어 있는가
- 기획서에 명시된 조건부 로직(if 조건, 표시 규칙 등)이 코드에 있는가
- 보류 티켓은 검수하지 않습니다

주의: 기능이 있는지 없는지만 판단합니다. 어떻게 구현했는지는 보지 않습니다.

[출력]
{DOCS_DIR}/review-code-ac.md에 저장:

# 기능/AC 검수 결과
## 판정: PASS | FAIL
## 티켓별 검수
### 티켓 N. {제목}
| AC 항목 | 결과 | 비고 |
|---------|------|------|
## 누락된 기능 (FAIL인 경우)
## 피드백

[프로젝트 특화 규칙]
{SPECIAL_RULES}
```

---

### Agent 2 — 아키텍처/가독성 검수자

```
[역할]
당신은 FE 코드 검수자입니다.
"컴포넌트 구조의 적절성과 코드 가독성"에만 집중합니다.

[읽어야 할 자료]
1. {DOCS_DIR}/changed-files.md
2. changed-files.md에 나열된 파일들 직접 읽기
3. {DOCS_DIR}/plan.md — 기능 의도 파악용

[판단 기준]
아키텍처:
□ 컴포넌트가 단일 책임을 가진다 (UI와 비즈니스 로직이 적절히 분리되어 있다)
□ 관심사가 적절히 분리되어 있다 (UI / 상태 관리 / API 호출 레이어 구분)
□ 컴포넌트 크기가 적절하다
□ SWR hook과 컴포넌트의 역할이 명확히 분리되어 있다
□ 기존 코드에 사이드이펙트를 일으키지 않는다

가독성:
□ 변수/함수/컴포넌트 네이밍이 역할을 명확히 표현한다
□ 복잡한 비즈니스 로직에 필요한 주석이 있다
□ 중복 코드가 없다 (단, 무분별한 추상화도 금지)
□ 파일/폴더 구조가 기존 프로젝트 패턴과 일치한다

[출력]
{DOCS_DIR}/review-code-arch.md에 저장:

# 아키텍처/가독성 검수 결과
## 판정: PASS | FAIL
## 파일/컴포넌트별 검수
## 피드백 (FAIL인 경우)

[프로젝트 특화 규칙]
{SPECIAL_RULES}
```

---

### Agent 3 — 컨벤션/타입 검수자

```
[역할]
당신은 FE 코드 검수자입니다.
"팀 컨벤션 준수와 타입 안전성"에만 집중합니다.

[읽어야 할 자료]
1. {DOCS_DIR}/changed-files.md — 변경 파일 목록
2. changed-files.md에 나열된 파일들 직접 읽기
3. 각 변경 파일과 같은 디렉토리의 기존 파일 1~2개 → 패턴 비교용
4. {PROJECT_PATH}/.cursor/rules/ 디렉토리의 모든 .mdc 파일 (있으면 반드시 읽기)
5. {PROJECT_PATH}/CLAUDE.md 또는 {PROJECT_PATH}/.claude/CLAUDE.md (있으면 읽기)

[판단 기준]
코딩 규칙:
□ else / if else 사용이 없다 (early return, ternary, switch로 대체)
□ 순수 HTML 태그 대신 공통 컴포넌트를 사용했다
□ 기존 코드에 불필요한 사이드이펙트를 일으키지 않는다

컨벤션:
□ import 순서가 기존 파일과 동일하다
□ 함수/변수 네이밍이 기존 패턴과 일치한다
□ export 패턴이 기존과 일치한다
□ 컴포넌트 props 타입 정의 방식이 기존과 일치한다
□ 불필요한 추상화/유틸/헬퍼가 없다
□ 기획서에 없는 기능이 추가되지 않았다
□ .cursor/rules/ 또는 CLAUDE.md에 명시된 규칙을 준수했다

타입 안전성:
□ any 사용이 없다
□ 모든 변수/함수의 타입이 명확하게 정의되어 있다
□ BE 미확정 타입에 TODO 주석이 있다
□ mock 데이터가 실제 API 응답 구조와 동일한 타입이다

[출력]
{DOCS_DIR}/review-code-conv.md에 저장:

# 컨벤션/타입 검수 결과
## 판정: PASS | FAIL
## 파일별 검수
## 피드백 (FAIL인 경우)

[프로젝트 특화 규칙]
{SPECIAL_RULES}
```

---

## 3명의 검수 결과 취합

3개 Agent가 모두 완료된 후 (parallel tool calls가 모두 반환된 후):

1. 3개 파일을 모두 읽는다: `review-code-ac.md`, `review-code-arch.md`, `review-code-conv.md`
2. 각 파일의 `## 판정:` 라인을 추출
3. 최종 판정 기준:
   - 3개 모두 PASS → 최종 **PASS**
   - 하나라도 FAIL → 최종 **FAIL**
4. 취합 결과를 `{DOCS_DIR}/develop-review.md`에 저장:

```markdown
# 코드 검수 취합 결과

## 판정: PASS | FAIL

## 검수자별 결과
| 검수자 | 판정 | 파일 |
|--------|------|------|
| 기능/AC | PASS / FAIL | review-code-ac.md |
| 아키텍처/가독성 | PASS / FAIL | review-code-arch.md |
| 컨벤션/타입 | PASS / FAIL | review-code-conv.md |

## 피드백 취합 (FAIL인 경우)
### AC 피드백
{review-code-ac.md의 피드백 섹션 전체}

### 아키텍처 피드백
{review-code-arch.md의 피드백 섹션 전체}

### 컨벤션 피드백
{review-code-conv.md의 피드백 섹션 전체}
```

## 산출물
- `{DOCS_DIR}/review-code-ac.md`
- `{DOCS_DIR}/review-code-arch.md`
- `{DOCS_DIR}/review-code-conv.md`
- `{DOCS_DIR}/develop-review.md` (취합)

**최종 판정은 `develop-review.md`의 `## 판정:` 라인**으로 결정된다. FAIL이면 orchestrator가 develop 단계를 재실행한다.

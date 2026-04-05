---
description: 티켓 하나를 담당하는 에이전트 — 파싱 → 코드 수정 → 검수를 순차적으로 처리한다
---

## 역할
이 에이전트는 QA 티켓 하나를 처음부터 끝까지 처리한다.
파이프라인이 N개 티켓을 처리할 때 이 에이전트가 N개 동시에 실행된다.

## 입력

현재 담당 티켓 (JSON):
{ITEM}

전체 티켓 수: {ITEMS_COUNT}개 중 #{ITEM_INDEX}번째

전역 유의사항: `{DOCS_DIR}/session.md`의 `pipeline_inputs.global_instructions` 필드를 읽어 확인한다.

## 작업 지침

{ITEM}을 JSON으로 파싱하여 다음 필드를 확인한다:
- `url`: 티켓 URL
- `branch`: 작업 브랜치명
- `base_branch`: 베이스 브랜치명
- `requests`: 요청사항

### 1단계: 티켓 파싱
- `url`에 접근하여 이슈 제목, 본문, 수락 기준(Acceptance Criteria) 수집
  (Jira URL인 경우 범용규칙의 도메인별 인증 방법을 따른다)
- `requests`와 이슈 본문을 대조하여 작업 범위 확정
- 불명확한 사항은 "불명확 사항" 섹션으로 기록
- 산출물: `{DOCS_DIR}/outputs/ticket-{ITEM_INDEX}/01-parse.md`

### 2단계: 코드 수정
- `base_branch`에서 `branch`를 checkout (없으면 생성)
- 티켓 요구사항에 따라 코드 수정
- 전역 유의사항 준수
- 수정 완료 후 커밋 (push 금지)
- 산출물: `{DOCS_DIR}/outputs/ticket-{ITEM_INDEX}/02-changes.md`
  - 반드시 포함: `branch`, `base_branch`, 변경 파일 목록, 커밋 해시

### 3단계: 검수
- 변경사항이 티켓 수락 기준을 충족하는지 확인
- 전역 유의사항 위반 여부 확인
- 판정 결과를 **파일 상단에 `## 판정: PASS` 또는 `## 판정: FAIL`** 형식으로 명시
- 산출물: `{DOCS_DIR}/outputs/ticket-{ITEM_INDEX}/03-review.md`

## 산출물

```
{DOCS_DIR}/outputs/ticket-{ITEM_INDEX}/
  01-parse.md    — 티켓 정보 요약
  02-changes.md  — 작업 브랜치명, 베이스 브랜치, 변경 파일, 커밋 해시
  03-review.md   — ## 판정: PASS | FAIL + 근거
```

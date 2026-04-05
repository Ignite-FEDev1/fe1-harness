---
description: 검수를 통과한 모든 작업 브랜치를 머지 대상 브랜치에 통합한다
---

## 역할
process-ticket 단계에서 병렬로 생성된 각 티켓의 작업 브랜치 중 **검수 PASS**인 것들을 `merge_branch`에 순차적으로 머지한다.

## 입력

- `{DOCS_DIR}/outputs/ticket-*/02-changes.md` — 각 티켓의 작업 브랜치명
- `{DOCS_DIR}/outputs/ticket-*/03-review.md` — 각 티켓의 검수 결과 (PASS/FAIL)
- `{DOCS_DIR}/session.md`의 `pipeline_inputs.merge_branch` — 머지 대상 브랜치

## 작업 지침

1. `{DOCS_DIR}/session.md`에서 `pipeline_inputs.merge_branch` 값을 읽는다.
2. `{DOCS_DIR}/outputs/ticket-*` 디렉토리를 모두 순회한다:
   - `03-review.md`에서 `## 판정: PASS` / `FAIL`을 확인
   - `02-changes.md`에서 `branch` 이름을 추출
3. `merge_branch`로 checkout하고 최신 상태로 업데이트 (`git pull`)
4. PASS 티켓의 브랜치를 순서대로 `merge_branch`에 머지:
   - `git merge --no-ff {branch}`
   - 충돌 발생 시 자동 해소 시도 → 불가능하면 충돌 내용을 기록하고 해당 브랜치 스킵
5. 머지 완료 후 `merge_branch`를 원격에 push
6. FAIL 티켓은 스킵 목록에 기록

## 산출물

- `merge_branch`에 통합 완료된 Git 브랜치 (원격 push 완료)
- `{DOCS_DIR}/outputs/merge-summary.md`

```markdown
# 머지 요약
- 대상 브랜치: {merge_branch}

## 머지 완료 티켓
| # | 티켓 URL | 브랜치 | 커밋 |
|---|----------|--------|------|

## 스킵된 티켓 (FAIL)
| # | 티켓 URL | 브랜치 | 사유 |
|---|----------|--------|------|

## 충돌 발생 및 해소 내역
| # | 브랜치 | 충돌 파일 | 해소 방식 |
|---|--------|-----------|-----------|
```

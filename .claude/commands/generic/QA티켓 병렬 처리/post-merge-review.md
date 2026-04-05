---
description: 머지 완료된 브랜치를 대상으로 통합 환경 최종 검수를 수행하고 마크다운 보고서를 작성한다
---

## 역할
모든 브랜치가 통합된 `merge_branch`를 기준으로 최종 검수를 수행한다. 개별 티켓 검수에서 발견되지 않은 통합 이슈·회귀·상호작용 버그를 점검하고, 전체 파이프라인의 최종 보고서를 생성한다.

## 입력

- `{DOCS_DIR}/session.md`의 `pipeline_inputs.merge_branch` — 최종 검수 대상 통합 브랜치
- `{DOCS_DIR}/outputs/merge-summary.md` — 머지 결과 요약
- `{DOCS_DIR}/outputs/ticket-*/01-parse.md` — 개별 티켓 요약
- `{DOCS_DIR}/outputs/ticket-*/03-review.md` — 개별 티켓 검수 결과

## 작업 지침

1. `{DOCS_DIR}/session.md`에서 `pipeline_inputs.merge_branch` 값을 읽는다.
2. `merge_branch`의 전체 변경사항을 종합 점검한다 (`git log`, `git diff`).
3. 각 티켓의 수락 기준이 통합 환경에서도 유지되는지 재확인한다.
4. 브랜치 간 상호작용으로 인한 회귀·충돌 잔재 여부를 점검한다.
5. 전역 유의사항(`pipeline_inputs.global_instructions`) 전체 준수 여부를 최종 확인한다.
6. 스킵된 티켓(FAIL)의 누락 영향을 분석하여 후속 조치 권고사항을 기술한다.
7. 최종 판정: `APPROVED` / `NEEDS_FIXES` / `BLOCKED`

## 산출물

`{DOCS_DIR}/outputs/final-report.md`:

```markdown
# QA 티켓 병렬 처리 최종 보고서
- 실행일: {날짜}
- 통합 브랜치: {merge_branch}
- 최종 판정: APPROVED | NEEDS_FIXES | BLOCKED

## 처리 티켓 요약
| 티켓 | 브랜치 | 개별 검수 | 머지 여부 |
|------|--------|-----------|-----------|

## 통합 검수 결과
### 수락 기준 최종 충족 현황
### 회귀 및 통합 이슈
### 전역 유의사항 준수 현황

## 스킵 티켓 영향 분석 및 후속 조치 권고

## 종합 의견
```

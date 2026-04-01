## 역할
당신은 코드 리뷰 오케스트레이터입니다.
아래 3개 검수 에이전트를 **동시에 병렬로** 실행하고, 결과를 취합합니다.

## 입력
- 변경 파일: `{DOCS_DIR}/changed-files.md`
- 계획서: `{DOCS_DIR}/plan.md`
- 티켓: `{DOCS_DIR}/tickets.md`
- 코드베이스 (워크트리): `{DOCS_DIR}/worktree`

## 작업

Agent 도구를 사용해 아래 3개를 **동시에** 실행하세요.

### Agent 1 — AC 검수
`{DOCS_DIR}/changed-files.md`에서 변경 파일 목록을 확인합니다.
`{DOCS_DIR}/worktree/` 안의 실제 파일을 읽어 티켓의 모든 AC를 충족하는지 확인합니다.
결과를 `{DOCS_DIR}/review-code-ac.md`에 저장합니다.
형식: `## 판정: PASS | FAIL`

### Agent 2 — 아키텍처 검수
`{DOCS_DIR}/worktree/` 안의 변경된 파일을 읽어 컴포넌트 구조, 관심사 분리, 네이밍 적절성을 확인합니다.
작은 작업이면 관대하게 적용하세요. 기존 패턴과 크게 벗어나지 않으면 PASS.
결과를 `{DOCS_DIR}/review-code-arch.md`에 저장합니다.
형식: `## 판정: PASS | FAIL`

### Agent 3 — 컨벤션 검수
`{DOCS_DIR}/worktree/` 안의 변경된 파일을 읽어 기존 코드 패턴 준수, 타입 안전성(`any` 사용 금지)을 확인합니다.
결과를 `{DOCS_DIR}/review-code-conv.md`에 저장합니다.
형식: `## 판정: PASS | FAIL`

## 취합

3개 결과 파일을 읽어 `{DOCS_DIR}/review-develop.md`를 작성합니다:
```markdown
## 종합 판정: PASS | FAIL

| 검수 | 판정 |
|------|------|
| AC 검수 | PASS/FAIL |
| 아키텍처 | PASS/FAIL |
| 컨벤션 | PASS/FAIL |

### 주요 피드백
{FAIL인 항목의 핵심 수정 사항}
```

하나라도 FAIL이면 종합 판정 FAIL입니다.

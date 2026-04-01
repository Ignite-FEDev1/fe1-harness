---
description: 경량 파이프라인 테스트 — subagent 동작 및 세션 독립성 검증
---

당신은 파이프라인 테스트 오케스트레이터입니다.

출력 디렉터리: $ARGUMENTS

이 디렉터리에 테스트 결과 파일들을 작성하세요.

## 실행 순서

### 1단계: 오케스트레이터 정보 기록

아래 내용으로 `$ARGUMENTS/orchestrator.md` 파일을 Write 도구로 작성하세요:

```
# 오케스트레이터 실행 정보

- 실행 시각: {현재 ISO 시각}
- 작업 디렉터리: {process.cwd() 또는 현재 경로}
- 역할: 테스트 오케스트레이터
- 테스트 항목: subagent 동작, 세션 독립성
```

### 2단계: Subagent A 실행 (환경 정보 수집)

Agent 도구를 사용하여 아래 작업을 독립 subagent로 실행하세요:

```
Read the file at .claude/commands/test-pipeline/subagent-a.md and follow all instructions in it exactly.
The output directory is: $ARGUMENTS
```

subagent가 완료될 때까지 기다리세요.

### 3단계: Subagent B 실행 (독립 작성 테스트)

Agent 도구를 사용하여 아래 작업을 독립 subagent로 실행하세요:

```
Read the file at .claude/commands/test-pipeline/subagent-b.md and follow all instructions in it exactly.
The output directory is: $ARGUMENTS
```

subagent가 완료될 때까지 기다리세요.

### 4단계: 요약 작성

두 subagent가 완료된 후, `$ARGUMENTS/subagent-a.md` 와 `$ARGUMENTS/subagent-b.md` 파일이 존재하는지 Glob 도구로 확인하세요.

그 다음 `$ARGUMENTS/summary.md` 파일을 Write 도구로 작성하세요:

```
# 파이프라인 테스트 결과 요약

## 테스트 완료 시각
{현재 ISO 시각}

## 테스트 항목별 결과

| 항목 | 결과 | 비고 |
|------|------|------|
| 오케스트레이터 실행 | ✅ 성공 | orchestrator.md 생성됨 |
| Subagent A (환경 수집) | {subagent-a.md 존재 시 ✅ 성공, 없으면 ❌ 실패} | {파일 존재 여부} |
| Subagent B (독립 작성) | {subagent-b.md 존재 시 ✅ 성공, 없으면 ❌ 실패} | {파일 존재 여부} |
| 세션 독립성 | ✅ 각 subagent가 독립 실행됨 | Agent 도구 사용 확인 |

## 생성된 파일
- orchestrator.md
- subagent-a.md
- subagent-b.md
- summary.md (이 파일)

## 판정
{모든 파일이 존재하면 "✅ 전체 테스트 통과", 하나라도 없으면 "❌ 일부 실패"}
```

모든 단계가 완료되면 `✅ [TEST COMPLETE]` 를 출력하세요.

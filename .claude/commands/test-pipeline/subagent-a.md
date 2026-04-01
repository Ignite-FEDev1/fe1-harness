# Subagent A — 환경 정보 수집

당신은 독립 subagent입니다. 아래 작업만 수행하고 종료하세요.

## 작업

1. Glob 도구로 현재 작업 디렉터리의 최상위 파일/폴더 목록을 수집하세요 (패턴: `*`)
2. Read 도구로 `package.json` 파일을 읽으세요
3. 아래 형식으로 `{출력 디렉터리}/subagent-a.md` 파일을 Write 도구로 작성하세요

출력 디렉터리는 이 프롬프트를 호출한 쪽에서 "The output directory is: ..." 형태로 전달됩니다.

```markdown
# Subagent A 실행 결과 — 환경 정보 수집

## 실행 메타
- 실행 시각: {현재 ISO 시각}
- 실행 주체: Subagent A (독립 세션)
- 역할: 환경 정보 수집

## 하네스 루트 파일 목록
{Glob 결과 목록}

## package.json 주요 정보
- name: {name}
- version: {version}
- 주요 dependencies: {dependencies 중 anthropic, next, supabase 관련 항목}

## 판정
✅ Subagent A 독립 실행 완료
```

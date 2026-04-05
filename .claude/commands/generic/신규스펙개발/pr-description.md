---
description: 변경사항을 기반으로 PR(Merge Request) 설명 문서를 작성한다. 실제 PR을 올리지는 않는다.
---

## 역할
GitLab PR(Merge Request)에 붙여넣을 **설명 텍스트만** 작성합니다.
실제로 PR을 생성하거나 push하지 않습니다. 문서만 만듭니다.

## 읽어야 할 자료
- `{DOCS_DIR}/plan.md`
- `{DOCS_DIR}/tickets.md`
- `{DOCS_DIR}/changed-files.md`

## 작업

`{DOCS_DIR}/pr-description.md`를 GitLab 마크다운 형식으로 작성합니다.

GitLab 마크다운 특이사항:
- 체크리스트: `- [ ]` 형식
- 코드블록: ``` 사용
- 멘션: `@username`
- 이슈 링크: `#{번호}`

아래 구성으로 작성:

---
## 작업 개요
이번 MR에서 구현한 내용을 2~3줄로 요약

## 구현 범위
현재 실행 상태:
- markup: {있음 - {경로} / 없음 - 임시 JSX 사용}
- BE API: {연동 완료 ({be_api_status}) / mock 사용}

## 구현된 티켓
- #{N} 티켓 제목 (공수: Nd)

## 미구현 (다음 MR 예정)
- #{N} 티켓 제목 — 사유: {마크업 수령 대기 / BE API 배포 대기}

## 변경 파일
### 신규 생성
- `파일경로` — 설명

### 수정
- `파일경로` — 변경 내용

## 테스트 방법
- [ ] {검증 방법 1}
- [ ] {검증 방법 2}

## 참고사항
- TODO 항목, 후속 작업, 특이사항 등
---

## 산출물
- `{DOCS_DIR}/pr-description.md`

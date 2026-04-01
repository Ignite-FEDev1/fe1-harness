# CPO 신규스펙 — 특수 파이프라인 규칙

## PLANNER

- CPO 포털은 PC 전용 서비스입니다 (모바일 대응 불필요)
- 내부 관리자용 어드민 화면 포함 시 별도 명시하세요
- API 연동은 백엔드 팀 Swagger 기준으로 작성

## DEVELOPER

- Next.js App Router 기반 프로젝트입니다
- Tailwind CSS 사용
- 컴포넌트는 src/components/ 하위에 기능별 폴더로 구성

## TICKET

- 티켓 prefix: CPO-
- 어드민/사용자 화면은 별도 티켓으로 분리

## REVIEWER_AC

- CPO 포털 접근 권한(어드민/일반 사용자) 구분 확인

## REVIEWER_ARCH

- Next.js App Router 패턴 준수 여부 확인
- Server Component / Client Component 경계 적절성 확인

## REVIEWER_CONVENTION

- ESLint/Prettier 설정 준수
- Tailwind 클래스 정렬 규칙 확인

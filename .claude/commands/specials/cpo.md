# CPO 포털 특수 규칙

## 프로젝트 개요

CPO 포털은 Next.js App Router 기반의 PC 전용 내부 관리자 서비스입니다.

## 플랫폼 및 아키텍처

- PC 전용 서비스입니다. 모바일 대응 불필요.
- Next.js App Router 기반 프로젝트입니다.
- Tailwind CSS 사용.
- 컴포넌트는 `src/components/` 하위에 기능별 폴더로 구성합니다.
- API 연동은 백엔드 팀 Swagger 기준으로 작성합니다.
- Server Component / Client Component 경계를 적절하게 유지하세요.

## 티켓 규칙

- 티켓 prefix: `CPO-`
- 내부 관리자용 어드민 화면 포함 시 별도 명시하세요.
- 어드민/사용자 화면은 별도 티켓으로 분리합니다.

## 코드 리뷰 기준

- CPO 포털 접근 권한(어드민/일반 사용자) 구분 확인.
- Next.js App Router 패턴 준수 여부 확인.
- ESLint/Prettier 설정 준수.
- Tailwind 클래스 정렬 규칙 확인.
- 최소 변경 원칙 엄수 (QA 수정 시).

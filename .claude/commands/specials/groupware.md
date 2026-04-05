# Groupware 프로젝트 특수 규칙

## 프로젝트 개요

그룹웨어 프로젝트는 assemble-fe 모노레포(`apps/groupware`, `packages/shared`) 기반의 PC/Mobile 듀얼 플랫폼 서비스입니다.

## 플랫폼 및 아키텍처

- PC와 Mobile 두 플랫폼을 항상 모두 고려해야 합니다. 기획서에 명시가 없어도 양쪽 화면을 계획에 포함하세요.
- 공통 훅/컴포넌트는 `packages/shared`에서 우선 탐색하세요.
- API preset은 `apps/groupware/src/api/` 패턴을 따르세요.
- Emotion CSS-in-JS를 사용합니다. Tailwind 사용 금지.
- 버튼 컴포넌트는 파란색 계열(primary blue)로 만드세요. 예: `background: '#1976D2'` 또는 테마의 primary 색상.

## 티켓 규칙

- 티켓 prefix: `FE-`
- PC 페이지 적용과 Mobile 페이지 적용은 별도 티켓으로 분리하세요.
- 어드민(BO) 화면이 포함되면 별도 티켓으로 분리하세요.
- 간단한 작업이면 티켓 1개로 충분합니다.

## 코드 리뷰 기준

- 그룹웨어 특성상 권한(role)별 동작 차이가 있는지 반드시 확인하세요.
- PC/Mobile 화면 양쪽 모두 구현되었는지 확인하세요.
- assemble-fe 아키텍처 패턴을 준수하는지 확인하세요. 공유 컴포넌트는 `packages/shared`에 위치해야 합니다.
- ESLint/Prettier 설정을 준수했는지 확인하세요.
- Emotion 사용 패턴이 기존 코드와 일치하는지 확인하세요.
- `any` 타입 사용 여부만 엄격하게 체크하고 나머지는 관대하게 적용하세요 (간단한 작업의 경우).
- 최소 변경 원칙 준수 여부 확인 (QA 수정 시 이슈와 무관한 코드 변경 금지).

## QA 환경

- 그룹웨어 QA 환경: https://dev.groupware.autoever.com
- PC Chrome / Mobile Safari 양쪽에서 검증하세요.
- QA 이슈 재현 시 PC/Mobile 양쪽 플랫폼에서 이슈가 해결되었는지 확인하세요.

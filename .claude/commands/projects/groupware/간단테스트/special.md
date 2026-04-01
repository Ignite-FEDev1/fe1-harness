# Groupware 간단테스트 — 특수 파이프라인 규칙

## PLANNER

- assemble-fe 모노레포 구조를 확인하세요 (apps/groupware, packages/shared)
- 버튼 컴포넌트는 항상 파란색 계열(primary blue)로 만드세요
- 요청한 기능만 구현하고, 불필요한 추가 기능은 만들지 마세요

## DEVELOPER

- assemble-fe의 공통 훅/컴포넌트를 packages/shared에서 먼저 탐색하세요
- Emotion CSS-in-JS를 사용합니다. Tailwind 사용 금지
- 버튼은 반드시 파란색(blue) 계열로 만드세요. 예: `background: '#1976D2'` 또는 테마의 primary 색상

## TICKET

- 티켓 prefix: FE-
- 간단한 작업이면 티켓 1개로 충분합니다

## REVIEWER_AC

- 버튼이 요청된 위치에 실제로 렌더링되는지 확인하세요
- 버튼 색상이 파란색 계열인지 반드시 확인하세요

## REVIEWER_ARCH

- 작은 작업이면 아키텍처 검수는 관대하게 적용하세요
- 기존 컴포넌트 패턴과 크게 벗어나지 않으면 PASS

## REVIEWER_CONVENTION

- Emotion 스타일 패턴이 기존 코드와 일치하는지 확인하세요
- `any` 타입 사용 여부만 엄격하게 체크하고 나머지는 관대하게 적용하세요

## QA

- 그룹웨어 QA 환경에서 버튼이 파란색으로 노출되는지 시각적으로 확인하세요
- 버튼 클릭 시 예상된 동작이 발생하는지 확인하세요

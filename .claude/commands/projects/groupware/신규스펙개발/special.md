# Groupware 신규스펙개발 — 특수 파이프라인 규칙

이 파일의 내용은 각 단계 실행 시 `{RULES_*}` 자리에 주입됩니다.
각 섹션 헤더(## PLANNER 등)를 기준으로 파싱되므로 형식을 유지하세요.

---

## PLANNER

- 그룹웨어 프로젝트는 PC/Mobile 두 플랫폼을 모두 고려해야 합니다
- assemble-fe 모노레포 구조를 숙지하세요 (apps/groupware, packages/shared)
- 기획서에 PC/Mobile 분리 언급이 없더라도 양쪽 화면을 모두 계획에 포함하세요

## DEVELOPER

- assemble-fe의 공통 훅/컴포넌트를 packages/shared에서 우선 탐색하세요
- API preset은 apps/groupware/src/api/ 패턴을 따르세요
- Emotion CSS-in-JS를 사용합니다. Tailwind 사용 금지

## TICKET

- 티켓 prefix: FE-
- PC 페이지 적용과 Mobile 페이지 적용은 별도 티켓으로 분리하세요
- 어드민(BO) 화면이 포함되면 별도 티켓으로 분리하세요

## REVIEWER_AC

- 그룹웨어 특성상 권한(role)별 동작 차이가 있는지 반드시 확인하세요
- PC/Mobile 화면 양쪽 모두 구현되었는지 확인하세요

## REVIEWER_ARCH

- assemble-fe 아키텍처 패턴을 준수하는지 확인하세요
- 공유 컴포넌트는 packages/shared에 위치해야 합니다

## REVIEWER_CONVENTION

- ESLint/Prettier 설정을 준수했는지 확인하세요
- Emotion 사용 패턴이 기존 코드와 일치하는지 확인하세요

## QA

- 그룹웨어 QA 환경: https://dev.groupware.autoever.com
- PC Chrome / Mobile Safari 양쪽에서 검증하세요

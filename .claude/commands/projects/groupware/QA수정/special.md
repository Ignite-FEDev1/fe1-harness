# Groupware QA수정 — 특수 파이프라인 규칙

## DEVELOPER

- 그룹웨어 특성상 권한(role)별 동작이 다를 수 있으므로 권한 컨텍스트에서 재현 여부를 확인하세요
- assemble-fe 모노레포에서 apps/groupware 범위만 수정하세요
- Emotion CSS-in-JS 사용. 스타일 변경 시 기존 패턴 유지

## REVIEWER_AC

- QA 이슈 재현 시나리오를 기준으로 수정 여부 검증
- PC/Mobile 양쪽 플랫폼에서 이슈가 해결되었는지 확인

## REVIEWER_CONVENTION

- 최소 변경 원칙 준수 여부 확인 (이슈와 무관한 코드 변경 금지)
- ESLint/Prettier 설정 준수

## QA

- 그룹웨어 QA 환경: https://dev.groupware.autoever.com
- PC Chrome / Mobile Safari 양쪽에서 재현 시나리오 실행

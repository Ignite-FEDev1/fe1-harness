# 범용규칙 (Global Rules)

이 규칙은 모든 파이프라인의 모든 스테이지에 자동으로 적용됩니다.

---

## 1. Atlassian (Jira / Confluence) 인증

Jira 이슈 또는 Confluence 문서에 접근할 때, URL 도메인에 따라 올바른 인증 정보를 사용해야 합니다.

### 도메인별 인증 매핑

| URL 도메인 | 이메일 환경변수 | 토큰 환경변수 |
|-----------|---------------|-------------|
| `hmg.atlassian.net` | `$HMG_JIRA_EMAIL` / `$HMG_CONFLUENCE_EMAIL` | `$HMG_JIRA_TOKEN` / `$HMG_CONFLUENCE_TOKEN` |
| `ignitecorp.atlassian.net` | `$IGNITE_JIRA_EMAIL` / `$IGNITE_CONFLUENCE_EMAIL` | `$IGNITE_JIRA_TOKEN` / `$IGNITE_CONFLUENCE_TOKEN` |

### API 호출 방법

```bash
curl -sk -u "${EMAIL}:${TOKEN}" \
  -H "Accept: application/json" \
  -H "User-Agent: axios/1.7.0" \
  "https://{domain}/rest/api/3/issue/{TICKET_KEY}"
```

### 필수 옵션
- `-k`: SSL 검증 스킵 (필수)
- `User-Agent: axios/1.7.0`: Atlassian이 curl 기본 UA를 차단하므로 반드시 필요

### URL 패턴 예시
- `https://hmg.atlassian.net/browse/ICTQMSCHE-22967` → domain: `hmg.atlassian.net`, key: `ICTQMSCHE-22967`
- `https://ignitecorp.atlassian.net/browse/FEHG-1637` → domain: `ignitecorp.atlassian.net`, key: `FEHG-1637`

---

## 2. 인증 실패 시 처리

Jira, Confluence 등 외부 서비스 접근에 실패한 경우 **파이프라인을 즉시 중단**하고 사용자에게 문제 상황을 명확히 전달합니다.

### 판단 기준
- 환경변수가 비어있거나 존재하지 않는 경우 → "admin > 사용자 key에서 해당 토큰을 등록해주세요"
- 환경변수는 있지만 API 호출이 401/403으로 실패한 경우 → "인증 정보가 유효하지 않습니다. 토큰이 만료되었거나 권한이 부족합니다"
- 네트워크 오류(timeout, DNS 등) → "네트워크 연결을 확인해주세요"

### 중단 방법
```
⏸ [사용자 확인 필요]
{도메인}에 접근할 수 없습니다.
원인: {구체적인 에러 메시지}
조치: {필요한 조치 안내}
```

**절대 인증 없이 추측하거나 빈 내용으로 진행하지 마세요.**

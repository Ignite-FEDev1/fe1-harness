import { NextRequest, NextResponse } from 'next/server';

/**
 * 허용된 VPN 공인 IP 대역 (CIDR)
 * PC: 58.87.60.0/24, 58.87.61.0/24, 58.87.63.0/24
 */
const ALLOWED_CIDRS = [
  '58.87.60.0/24',
  '58.87.61.0/24',
  '58.87.63.0/24',
];

function ipToNumber(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function isIpInCidr(ip: string, cidr: string): boolean {
  const [network, prefixStr] = cidr.split('/');
  const prefix = parseInt(prefixStr, 10);
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipToNumber(ip) & mask) === (ipToNumber(network) & mask);
}

function isAllowedIp(ip: string): boolean {
  // localhost는 항상 허용
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('::ffff:127.')) return true;
  return ALLOWED_CIDRS.some((cidr) => isIpInCidr(ip, cidr));
}

export function middleware(request: NextRequest) {
  // 개발 환경에서는 IP 제한 미적용
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.next();
  }

  // IP 제한 비활성화 옵션
  if (process.env.DISABLE_IP_RESTRICTION === 'true') {
    return NextResponse.next();
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '';

  if (!ip || !isAllowedIp(ip)) {
    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>접근 제한</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0a0f16;
      font-family: 'SF Mono', 'Fira Code', monospace;
      color: #c9d5e0;
    }
    .container {
      text-align: center;
      padding: 3rem 2rem;
      max-width: 420px;
      background: #0f1923;
      border: 1px solid #1e2b38;
      border-radius: 10px;
    }
    .icon { font-size: 3rem; margin-bottom: 1.5rem; }
    h1 { font-size: 1rem; font-weight: 700; margin-bottom: 0.75rem; color: #f59e0b; letter-spacing: 0.05em; }
    p { font-size: 0.875rem; color: #7a8f9e; line-height: 1.7; }
    .ip { margin-top: 1.25rem; padding: 0.5rem 1rem; background: #141a22; border: 1px solid #1e2b38; border-radius: 5px; font-size: 0.75rem; color: #556677; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">🔒</div>
    <h1>VPN 환경에서 접속해주세요</h1>
    <p>FE1 Harness는 사내 VPN에 연결된 환경에서만<br>이용할 수 있습니다.</p>
    <div class="ip">현재 IP: ${ip || '알 수 없음'}</div>
  </div>
</body>
</html>`;
    return new NextResponse(html, {
      status: 403,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

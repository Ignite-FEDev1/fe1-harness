'use client';

/** Detect absolute file paths and wrap them in clickable links. */
function renderWithPaths(text: string) {
  // Match absolute paths like /Users/.../file.md or /home/.../file.ts
  const pathRegex = /(\/(?:Users|home|tmp|var|opt|etc)[^\s,;)}\]]+)/g;
  const parts: (string | { path: string; key: number })[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pathRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push({ path: match[1], key: key++ });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  if (parts.length === 1 && typeof parts[0] === 'string') {
    return text; // no paths found
  }

  return parts.map((part) => {
    if (typeof part === 'string') return part;
    return (
      <a
        key={part.key}
        href={`vscode://file${part.path}`}
        title={`VS Code에서 열기: ${part.path}`}
        style={{
          color: 'inherit',
          textDecoration: 'underline',
          textDecorationColor: 'rgba(255,255,255,0.25)',
          textUnderlineOffset: '2px',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.textDecorationColor = 'var(--accent-cyan)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.textDecorationColor = 'rgba(255,255,255,0.25)';
        }}
      >
        {part.path}
      </a>
    );
  });
}

interface LogEntryProps {
  content: string;
  timestamp: string;
}

export function LogEntry({ content, timestamp }: LogEntryProps) {
  const time = new Date(timestamp).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const isToolCall = content.startsWith('[도구]');
  const isToolResult = content.startsWith('[도구 결과]');
  const isComplete = content.startsWith('[완료]');
  const isProgress = content.includes('📍');
  const isUserGate = content.includes('⏸');
  const isAbort = content.includes('⛔');
  const isHChatError = content.includes('API Error: 500') || content.includes('Something went wrong') || content.includes('Invalid model');

  let textColor = 'var(--text-primary)';
  let prefix = '';
  let prefixColor = '';

  if (isToolCall) {
    textColor = 'var(--accent-cyan)';
    prefix = 'TOOL';
    prefixColor = 'var(--accent-cyan)';
  }
  if (isToolResult) {
    textColor = 'var(--text-muted)';
    prefix = 'RES';
    prefixColor = 'var(--text-muted)';
  }
  if (isComplete) {
    textColor = 'var(--accent-green)';
    prefix = 'OK';
    prefixColor = 'var(--accent-green)';
  }
  if (isProgress) {
    textColor = 'var(--accent-green)';
    prefix = 'STEP';
    prefixColor = 'var(--accent-green)';
  }
  if (isUserGate) {
    textColor = 'var(--accent-amber)';
    prefix = 'GATE';
    prefixColor = 'var(--accent-amber)';
  }
  if (isAbort) {
    textColor = 'var(--accent-red)';
    prefix = 'ABORT';
    prefixColor = 'var(--accent-red)';
  }

  return (
    <div className="flex flex-col">
    {isHChatError && (
      <div
        style={{
          margin: '4px 0 2px 64px',
          padding: '6px 10px',
          borderRadius: '4px',
          background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.25)',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          color: 'var(--accent-amber, #f59e0b)',
        }}
      >
        ⚠️ H-Chat API 오류 — <strong>VPN이 켜져 있는지 확인해주세요.</strong> VPN 연결 후 RE-RUN 하세요.
      </div>
    )}
    <div
      className="flex gap-0 py-px group"
      style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', lineHeight: '1.7' }}
    >
      {/* Timestamp */}
      <span
        className="flex-shrink-0 select-none w-16 text-right pr-3 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: 'var(--text-muted)', fontSize: '12px' }}
      >
        {time}
      </span>

      {/* Prefix badge */}
      {prefix && (
        <span
          className="flex-shrink-0 w-11 text-right pr-2 select-none"
          style={{ color: prefixColor, fontSize: '12px', fontWeight: 600, letterSpacing: '0.04em', lineHeight: '1.7', opacity: 0.7 }}
        >
          {prefix}
        </span>
      )}
      {!prefix && <span className="flex-shrink-0 w-11" />}

      {/* Content — file paths are clickable (opens in VS Code) */}
      <pre
        className="whitespace-pre-wrap break-all flex-1"
        style={{ color: textColor }}
      >
        {renderWithPaths(content)}
      </pre>
    </div>
    </div>
  );
}

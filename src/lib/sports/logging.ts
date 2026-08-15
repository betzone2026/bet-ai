/**
 * Logging for the sports pipeline.
 *
 * The one rule: a provider key must never reach a log line, a stored error
 * summary, or an HTTP response. Redaction happens here rather than at each call
 * site, because a call site that forgets is exactly how secrets leak.
 */

/** Patterns that look like credentials in free text. */
const SECRET_PATTERNS: RegExp[] = [
  // `x-apisports-key: abc123`, `apiKey=abc123`, `"token": "abc123"`
  /((?:api[-_]?key|apisports[-_]?key|x-apisports-key|token|authorization|secret)["'\s]*[:=]\s*["']?)([^\s"',}]+)/gi,
  // Bare 32+ char hex strings, the shape of most feed keys.
  /\b[a-f0-9]{32,}\b/gi,
];

/** Replaces anything credential-shaped with `[redacted]`. */
export function redact(input: string): string {
  let output = input;
  output = output.replace(SECRET_PATTERNS[0]!, (_m, prefix: string) => `${prefix}[redacted]`);
  output = output.replace(SECRET_PATTERNS[1]!, '[redacted]');
  return output;
}

/**
 * Also strips a known key value, for cases the patterns cannot catch — a short
 * or unusually formatted key pasted into a message.
 */
export function redactValue(input: string, secret: string | null | undefined): string {
  const redacted = redact(input);
  if (!secret || secret.length < 6) return redacted;
  return redacted.split(secret).join('[redacted]');
}

type Level = 'info' | 'warn' | 'error';

function emit(level: Level, message: string, context?: Record<string, unknown>): void {
  const line = redact(`[sports] ${message}`);
  const payload = context ? redact(safeStringify(context)) : '';
  // Server-side operational logging: the redaction above is what makes it safe.
  console[level](payload ? `${line} ${payload}` : line);
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '[unserialisable]';
  }
}

export const sportsLog = {
  info: (message: string, context?: Record<string, unknown>) => emit('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => emit('error', message, context),
};

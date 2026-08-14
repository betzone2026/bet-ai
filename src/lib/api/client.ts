/**
 * Thin wrapper over same-origin Netlify API routes.
 */

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  accessToken?: string | null;
  signal?: AbortSignal;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, accessToken, signal } = options;

  const response = await fetch(path, {
    method,
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new ApiError(detail || `Request to ${path} failed`, response.status);
  }
  return (await response.json()) as T;
}

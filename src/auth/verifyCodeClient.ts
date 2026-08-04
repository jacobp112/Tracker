const BASE = import.meta.env.VITE_AUTH_API_BASE ?? '';

async function post(path: string, payload: unknown): Promise<void> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Something went wrong. Try again.');
}

export function sendCode(email: string): Promise<void> {
  return post('/api/auth/send-code', { email });
}

export function verifyCode(email: string, code: string): Promise<void> {
  return post('/api/auth/verify-code', { email, code });
}

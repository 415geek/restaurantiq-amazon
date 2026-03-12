export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = typeof data?.error === 'string' ? data.error : `Request failed: ${res.status}`;
    throw new Error(message);
  }
  return data as T;
}

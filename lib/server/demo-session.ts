export const DEMO_COOKIE_NAME = 'riq_demo';

function parseCookieHeader(header: string | null): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const [rawKey, ...rest] = part.split('=');
    const key = rawKey?.trim();
    if (!key) continue;
    const value = rest.join('=').trim();
    if (!value) continue;
    out[key] = decodeURIComponent(value);
  }
  return out;
}

export function getDemoIdFromRequest(req: { headers: Headers }): string | null {
  const cookies = parseCookieHeader(req.headers.get('cookie'));
  const id = cookies[DEMO_COOKIE_NAME];
  return id && id.trim() ? id.trim() : null;
}

export function isDemoRequest(req: { headers: Headers }): boolean {
  return Boolean(getDemoIdFromRequest(req));
}

export function demoUserKey(demoId: string): string {
  return `demo_${demoId}`;
}

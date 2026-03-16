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

/** 为 true 时允许 demo cookie 进入 demo 模式；未设置或非 true 时始终为 production（无 demo） */
const DEMO_MODE_ENABLED = process.env.DEMO_MODE_ENABLED === 'true';

export function getDemoIdFromRequest(req: { headers: Headers }): string | null {
  if (!DEMO_MODE_ENABLED) return null;
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

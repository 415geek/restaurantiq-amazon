import { currentUser } from '@clerk/nextjs/server';

function parseCsv(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function toStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim().toLowerCase() : ''))
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return parseCsv(value);
  }

  return [];
}

function readInternalRoles(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata) {
    return [];
  }

  return [
    ...toStringArray(metadata.agentStudioRoles),
    ...toStringArray(metadata.internalRoles),
    ...toStringArray(metadata.roles),
  ];
}

export type InternalAccessResult = {
  allowed: boolean;
  reason: 'allowed' | 'auth_missing' | 'email_missing' | 'not_allowlisted';
  email?: string;
  accessSource?: 'metadata' | 'allowlist';
  matchedRole?: string;
};

export async function getInternalAgentStudioAccess(): Promise<InternalAccessResult> {
  const user = await currentUser();
  if (!user) {
    return { allowed: false, reason: 'auth_missing' };
  }

  const email =
    user.primaryEmailAddress?.emailAddress?.trim().toLowerCase() ||
    user.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase();

  if (!email) {
    return { allowed: false, reason: 'email_missing' };
  }

  const requiredRoles = ['agent_tuner', 'internal_admin', 'internal_dev'];
  const metadataRoles = readInternalRoles((user.publicMetadata ?? {}) as Record<string, unknown>);
  const matchedRole = metadataRoles.find((role) => requiredRoles.includes(role));

  if (matchedRole) {
    return { allowed: true, reason: 'allowed', email, accessSource: 'metadata', matchedRole };
  }

  const allowEmails = parseCsv(process.env.INTERNAL_AGENT_STUDIO_ALLOWED_EMAILS);
  const allowDomains = parseCsv(process.env.INTERNAL_AGENT_STUDIO_ALLOWED_DOMAINS);
  const emailDomain = email.split('@')[1] ?? '';

  const allowed =
    allowEmails.includes(email) ||
    (emailDomain.length > 0 && allowDomains.includes(emailDomain));

  if (!allowed) {
    return { allowed: false, reason: 'not_allowlisted', email };
  }

  return { allowed: true, reason: 'allowed', email, accessSource: 'allowlist' };
}

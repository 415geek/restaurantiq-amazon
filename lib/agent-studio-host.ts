const DEFAULT_AGENT_STUDIO_HOST = 'agenttune.restaurantiq.ai';

function normalizeHost(host: string | null | undefined) {
  return (host ?? '').trim().toLowerCase().replace(/:\d+$/, '');
}

export function getAgentStudioHost() {
  return normalizeHost(process.env.NEXT_PUBLIC_AGENT_STUDIO_HOST || DEFAULT_AGENT_STUDIO_HOST);
}

export function getRequestHost(value: string | null | undefined) {
  return normalizeHost(value);
}

export function isAgentStudioHost(host: string | null | undefined) {
  return getRequestHost(host) === getAgentStudioHost();
}


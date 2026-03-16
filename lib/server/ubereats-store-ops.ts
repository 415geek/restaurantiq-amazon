import type {
  DeliveryHolidayHoursEntry,
  DeliveryManagementState,
  DeliveryRegularHours,
  DeliveryStoreOnlineStatus,
  DeliveryStoreOperationsState,
  DeliveryTimeRange,
  DeliveryWeekday,
} from '@/lib/delivery-management-types';
import { getUberEatsConnectionState } from '@/lib/server/ubereats-oauth-store';
import { resolveUberEatsAccessToken } from '@/lib/server/ubereats-token';

const WEEKDAYS: DeliveryWeekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const HHMM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const DEFAULT_STATUS_TEMPLATE = '/v1/eats/stores/{storeId}/status';
const DEFAULT_HOLIDAY_TEMPLATE = '/v1/eats/stores/{storeId}/holidayhours';
const DEFAULT_POS_DATA_TEMPLATE = '/v1/eats/stores/{storeId}/pos_data';
const DEFAULT_MENU_GET_TEMPLATE = '/v2/eats/stores/{storeId}/menu';
const DEFAULT_MENU_PUT_TEMPLATE = '/v2/eats/stores/{storeId}/menu';

type EndpointResult = {
  ok: boolean;
  status: number;
  payload: unknown;
  error?: string;
};

export type StoreOpsPushReport = {
  ok: boolean;
  pushedAt: string;
  report: Array<{
    step: 'status' | 'holidayhours' | 'menu_hours' | 'prep' | 'promotions';
    ok: boolean;
    status?: number;
    message: string;
  }>;
  warnings: string[];
};

function parseEnvStoreIds() {
  const raw = process.env.UBEREATS_STORE_IDS || '';
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function nowIso() {
  return new Date().toISOString();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function safeString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function safeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeBaseUrl() {
  const envBase = process.env.UBEREATS_API_BASE_URL?.trim();
  if (envBase) return envBase.replace(/\/$/, '');
  const env = process.env.UBEREATS_ENVIRONMENT?.toLowerCase();
  if (env === 'sandbox') return 'https://sandbox-api.uber.com';
  return 'https://api.uber.com';
}

function endpointFromTemplate(template: string, storeId: string) {
  const replaced = template.replaceAll('{storeId}', encodeURIComponent(storeId));
  if (replaced.startsWith('http://') || replaced.startsWith('https://')) return replaced;
  return `${normalizeBaseUrl()}${replaced.startsWith('/') ? replaced : `/${replaced}`}`;
}

async function callUber(
  token: string,
  endpoint: string,
  init?: RequestInit
): Promise<EndpointResult> {
  try {
    const response = await fetch(endpoint, {
      cache: 'no-store',
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(init?.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errRecord = asRecord(payload);
      const error =
        safeString(errRecord?.error_description) ||
        safeString(errRecord?.error) ||
        safeString(errRecord?.message) ||
        `HTTP ${response.status}`;
      return { ok: false, status: response.status, payload, error };
    }
    return { ok: true, status: response.status, payload };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      payload: {},
      error: error instanceof Error ? error.message : 'unknown_error',
    };
  }
}

function isTimeRangeValid(range: DeliveryTimeRange) {
  if (!HHMM_REGEX.test(range.startTime) || !HHMM_REGEX.test(range.endTime)) return false;
  return range.startTime < range.endTime;
}

export function validateRegularHours(hours: DeliveryRegularHours) {
  const errors: string[] = [];
  for (const weekday of WEEKDAYS) {
    for (const [index, range] of (hours[weekday] || []).entries()) {
      if (!isTimeRangeValid(range)) {
        errors.push(`${weekday}[${index}] must be HH:MM and start < end`);
      }
    }
  }
  return errors;
}

export function validateHolidayHours(entries: DeliveryHolidayHoursEntry[]) {
  const errors: string[] = [];
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  for (const [index, entry] of entries.entries()) {
    if (!dateRegex.test(entry.date)) {
      errors.push(`holidayHours[${index}].date must be YYYY-MM-DD`);
      continue;
    }
    if (!entry.closed) {
      if (!entry.startTime || !entry.endTime) {
        errors.push(`holidayHours[${index}] requires startTime/endTime when not closed`);
        continue;
      }
      if (!isTimeRangeValid({ startTime: entry.startTime, endTime: entry.endTime })) {
        errors.push(`holidayHours[${index}] invalid time range`);
      }
    }
  }
  return errors;
}

function toUberServiceAvailability(hours: DeliveryRegularHours) {
  const output: Record<string, Array<{ start_time: string; end_time: string }>> = {};
  for (const weekday of WEEKDAYS) {
    output[weekday] = (hours[weekday] || []).map((range) => ({
      start_time: range.startTime,
      end_time: range.endTime,
    }));
  }
  return output;
}

function fromUberServiceAvailability(payload: unknown): DeliveryRegularHours | null {
  const rec = asRecord(payload);
  if (!rec) return null;
  const output: DeliveryRegularHours = {};
  let foundAny = false;

  for (const weekday of WEEKDAYS) {
    const raw = rec[weekday];
    if (!Array.isArray(raw)) continue;
    const rows: DeliveryTimeRange[] = raw
      .map((item) => {
        const itemRec = asRecord(item);
        if (!itemRec) return null;
        const start = safeString(itemRec.start_time) || safeString(itemRec.startTime);
        const end = safeString(itemRec.end_time) || safeString(itemRec.endTime);
        if (!start || !end) return null;
        return { startTime: start, endTime: end };
      })
      .filter((item): item is DeliveryTimeRange => Boolean(item));
    if (rows.length) {
      output[weekday] = rows;
      foundAny = true;
    }
  }

  return foundAny ? output : null;
}

function scanFirstServiceAvailability(node: unknown): DeliveryRegularHours | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = scanFirstServiceAvailability(item);
      if (found) return found;
    }
    return null;
  }
  const rec = asRecord(node);
  if (!rec) return null;

  if (rec.service_availability) {
    const parsed = fromUberServiceAvailability(rec.service_availability);
    if (parsed) return parsed;
  }

  for (const value of Object.values(rec)) {
    const found = scanFirstServiceAvailability(value);
    if (found) return found;
  }
  return null;
}

function applyServiceAvailabilityToMenuPayload(node: unknown, availability: Record<string, Array<{ start_time: string; end_time: string }>>): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => applyServiceAvailabilityToMenuPayload(item, availability));
  }
  const rec = asRecord(node);
  if (!rec) return node;

  const next: Record<string, unknown> = { ...rec };
  if (
    'service_availability' in rec ||
    'menus' in rec ||
    'categories' in rec ||
    'items' in rec
  ) {
    next.service_availability = availability;
  }

  for (const [key, value] of Object.entries(next)) {
    next[key] = applyServiceAvailabilityToMenuPayload(value, availability);
  }

  return next;
}

function parseHolidayHoursPayload(payload: unknown): DeliveryHolidayHoursEntry[] {
  const root = asRecord(payload);
  if (!root) return [];
  const candidates = [root.data, root.holiday_hours, root.holidayHours, payload];
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    const rows: DeliveryHolidayHoursEntry[] = candidate
      .map((entry, index) => {
        const rec = asRecord(entry);
        if (!rec) return null;
        const date = safeString(rec.date) || safeString(rec.holiday_date);
        if (!date) return null;
        const startTime = safeString(rec.start_time) || safeString(rec.startTime) || undefined;
        const endTime = safeString(rec.end_time) || safeString(rec.endTime) || undefined;
        const closed = Boolean(rec.closed);
        return {
          id: safeString(rec.id) || `holiday-${date}-${index}`,
          date,
          startTime,
          endTime,
          closed,
        } as DeliveryHolidayHoursEntry;
      })
      .filter((row): row is DeliveryHolidayHoursEntry => Boolean(row));
    if (rows.length) return rows;
  }
  return [];
}

function parseOnlineStatus(payload: unknown): DeliveryStoreOnlineStatus | null {
  const rec = asRecord(payload);
  if (!rec) return null;
  const status =
    safeString(rec.status) ||
    safeString(rec.online_status) ||
    safeString((asRecord(rec.data) || {}).status) ||
    safeString((asRecord(rec.data) || {}).online_status);
  if (!status) return null;
  return status.toLowerCase() === 'online' ? 'online' : 'paused';
}

function parsePrepData(payload: unknown) {
  const rec = asRecord(payload);
  if (!rec)
    return {} as {
      prepTimeOffsetMins?: number;
      defaultPrepTimeMins?: number;
      integrationEnabled?: boolean;
    };
  const data = asRecord(rec.data) || rec;
  const config = asRecord(data.store_configuration_data) || data;
  const integrationEnabledRaw =
    asRecord(data.integration_details || {})?.integration_enabled ??
    data.integration_enabled ??
    config.integration_enabled;
  const integrationEnabled =
    typeof integrationEnabledRaw === 'boolean'
      ? integrationEnabledRaw
      : typeof integrationEnabledRaw === 'string'
        ? integrationEnabledRaw.toLowerCase() === 'true'
        : undefined;
  return {
    prepTimeOffsetMins:
      safeNumber(config.prep_time_offset_minutes) ??
      safeNumber(config.prep_time_offset_mins) ??
      safeNumber(config.prep_time_offset),
    defaultPrepTimeMins:
      safeNumber(config.default_prep_time_minutes) ??
      safeNumber(config.default_prep_time_mins) ??
      safeNumber(config.default_prep_time),
    integrationEnabled,
  };
}

export function ensureStoreOpsState(
  state: DeliveryManagementState,
  userKey: string
): DeliveryManagementState {
  const fromConnection = getUberEatsConnectionState(userKey)?.stores?.map((store) => store.id) || [];
  const fromEnv = parseEnvStoreIds();
  const ids = Array.from(new Set([...fromConnection, ...fromEnv, ...state.storeOps.map((s) => s.storeId)]));
  if (!ids.length) return state;

  const nextStoreOps = [...state.storeOps];
  for (const storeId of ids) {
    if (nextStoreOps.some((entry) => entry.storeId === storeId)) continue;
    nextStoreOps.push({
      storeId,
      storeName: `Uber Eats Store ${storeId.slice(0, 8)}`,
      onlineStatus: 'online',
      prepTimeOffsetMins: 0,
      defaultPrepTimeMins: 20,
      regularHours: {
        monday: [{ startTime: '11:00', endTime: '21:00' }],
        tuesday: [{ startTime: '11:00', endTime: '21:00' }],
        wednesday: [{ startTime: '11:00', endTime: '21:00' }],
        thursday: [{ startTime: '11:00', endTime: '21:00' }],
        friday: [{ startTime: '11:00', endTime: '22:00' }],
        saturday: [{ startTime: '11:00', endTime: '22:00' }],
        sunday: [{ startTime: '11:00', endTime: '21:00' }],
      },
      holidayHours: [],
      promotions: [],
      syncSource: 'local',
      syncWarnings: [],
      lastPulledAt: nowIso(),
    });
  }

  return {
    ...state,
    storeOps: nextStoreOps,
  };
}

export async function pullStoreOpsFromUber(params: {
  userKey: string;
  storeOps: DeliveryStoreOperationsState;
}) {
  const { userKey, storeOps } = params;
  const token = (await resolveUberEatsAccessToken(userKey)).token;
  if (!token) {
    return {
      next: {
        ...storeOps,
        syncSource: 'local' as const,
        syncWarnings: ['Uber token missing. Showing local store operations state.'],
      },
      warnings: ['Uber token missing.'],
    };
  }

  const warnings: string[] = [];
  const statusTemplate = process.env.UBEREATS_STORE_STATUS_ENDPOINT_TEMPLATE || DEFAULT_STATUS_TEMPLATE;
  const holidayTemplate =
    process.env.UBEREATS_STORE_HOLIDAYHOURS_ENDPOINT_TEMPLATE || DEFAULT_HOLIDAY_TEMPLATE;
  const posDataTemplate =
    process.env.UBEREATS_STORE_POSDATA_ENDPOINT_TEMPLATE || DEFAULT_POS_DATA_TEMPLATE;
  const menuGetTemplate = process.env.UBEREATS_MENU_GET_ENDPOINT_TEMPLATE || DEFAULT_MENU_GET_TEMPLATE;

  const [statusRes, holidayRes, posRes, menuRes] = await Promise.all([
    callUber(token, endpointFromTemplate(statusTemplate, storeOps.storeId)),
    callUber(token, endpointFromTemplate(holidayTemplate, storeOps.storeId)),
    callUber(token, endpointFromTemplate(posDataTemplate, storeOps.storeId)),
    callUber(token, endpointFromTemplate(menuGetTemplate, storeOps.storeId)),
  ]);

  if (!statusRes.ok) warnings.push(`status: ${statusRes.error || 'request_failed'}`);
  if (!holidayRes.ok) warnings.push(`holidayhours: ${holidayRes.error || 'request_failed'}`);
  if (!posRes.ok) warnings.push(`pos_data: ${posRes.error || 'request_failed'}`);
  if (!menuRes.ok) warnings.push(`menu: ${menuRes.error || 'request_failed'}`);

  const onlineStatus = parseOnlineStatus(statusRes.payload) || storeOps.onlineStatus;
  const holidayHours = parseHolidayHoursPayload(holidayRes.payload);
  const prep = parsePrepData(posRes.payload);
  const regularHours = scanFirstServiceAvailability(menuRes.payload) || storeOps.regularHours;
  if (prep.integrationEnabled === false) {
    warnings.push('integration_enabled=false in pos_data. Confirm nominated integrator binding.');
  }

  return {
    next: {
      ...storeOps,
      onlineStatus,
      holidayHours: holidayHours.length ? holidayHours : storeOps.holidayHours,
      prepTimeOffsetMins:
        typeof prep.prepTimeOffsetMins === 'number'
          ? prep.prepTimeOffsetMins
          : storeOps.prepTimeOffsetMins,
      defaultPrepTimeMins:
        typeof prep.defaultPrepTimeMins === 'number'
          ? prep.defaultPrepTimeMins
          : storeOps.defaultPrepTimeMins,
      regularHours,
      syncSource: warnings.length ? ('local' as const) : ('live' as const),
      syncWarnings: warnings,
      lastPulledAt: nowIso(),
    },
    warnings,
  };
}

export async function pushStoreOpsToUber(params: {
  userKey: string;
  storeOps: DeliveryStoreOperationsState;
}): Promise<StoreOpsPushReport> {
  const { userKey, storeOps } = params;
  const pushedAt = nowIso();
  const token = (await resolveUberEatsAccessToken(userKey)).token;
  if (!token) {
    return {
      ok: false,
      pushedAt,
      report: [
        {
          step: 'status',
          ok: false,
          message: 'Uber token missing. Configure OAuth or UBEREATS_BEARER_TOKEN first.',
        },
      ],
      warnings: ['Uber token missing.'],
    };
  }

  const report: StoreOpsPushReport['report'] = [];
  const warnings: string[] = [];

  const statusTemplate = process.env.UBEREATS_STORE_STATUS_ENDPOINT_TEMPLATE || DEFAULT_STATUS_TEMPLATE;
  const holidayTemplate =
    process.env.UBEREATS_STORE_HOLIDAYHOURS_ENDPOINT_TEMPLATE || DEFAULT_HOLIDAY_TEMPLATE;
  const posDataTemplate =
    process.env.UBEREATS_STORE_POSDATA_ENDPOINT_TEMPLATE || DEFAULT_POS_DATA_TEMPLATE;
  const menuGetTemplate = process.env.UBEREATS_MENU_GET_ENDPOINT_TEMPLATE || DEFAULT_MENU_GET_TEMPLATE;
  const menuPutTemplate = process.env.UBEREATS_MENU_PUT_ENDPOINT_TEMPLATE || DEFAULT_MENU_PUT_TEMPLATE;
  const promotionsEndpoint = process.env.UBEREATS_PROMOTIONS_ENDPOINT || '';

  const statusEndpoint = endpointFromTemplate(statusTemplate, storeOps.storeId);
  const statusRes = await callUber(token, statusEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: storeOps.onlineStatus }),
  });
  report.push({
    step: 'status',
    ok: statusRes.ok,
    status: statusRes.status,
    message: statusRes.ok
      ? `Store status updated to ${storeOps.onlineStatus}`
      : `status update failed: ${statusRes.error || 'request_failed'}`,
  });

  const holidayPayload = {
    holiday_hours: storeOps.holidayHours.map((entry) => ({
      date: entry.date,
      start_time: entry.closed ? undefined : entry.startTime,
      end_time: entry.closed ? undefined : entry.endTime,
      closed: Boolean(entry.closed),
    })),
  };
  const holidayRes = await callUber(token, endpointFromTemplate(holidayTemplate, storeOps.storeId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(holidayPayload),
  });
  report.push({
    step: 'holidayhours',
    ok: holidayRes.ok,
    status: holidayRes.status,
    message: holidayRes.ok
      ? `Holiday hours updated (${storeOps.holidayHours.length} entries)`
      : `holiday hours update failed: ${holidayRes.error || 'request_failed'}`,
  });

  const posPayload = {
    integrator_store_id:
      process.env.UBEREATS_INTEGRATOR_STORE_ID || process.env.UBEREATS_CLIENT_ID || storeOps.storeId,
    store_configuration_data: {
      prep_time_offset_minutes: storeOps.prepTimeOffsetMins,
      prep_time_offset_mins: storeOps.prepTimeOffsetMins,
      default_prep_time_minutes: storeOps.defaultPrepTimeMins,
      default_prep_time_mins: storeOps.defaultPrepTimeMins,
    },
  };
  const posRes = await callUber(token, endpointFromTemplate(posDataTemplate, storeOps.storeId), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(posPayload),
  });
  report.push({
    step: 'prep',
    ok: posRes.ok,
    status: posRes.status,
    message: posRes.ok
      ? 'Preparation offset synced'
      : `prep offset sync failed: ${posRes.error || 'request_failed'}`,
  });

  const menuGetRes = await callUber(token, endpointFromTemplate(menuGetTemplate, storeOps.storeId));
  if (!menuGetRes.ok) {
    report.push({
      step: 'menu_hours',
      ok: false,
      status: menuGetRes.status,
      message: `menu hours sync failed: unable to fetch current menu (${menuGetRes.error || 'request_failed'})`,
    });
  } else {
    const availability = toUberServiceAvailability(storeOps.regularHours);
    const nextMenuPayload = applyServiceAvailabilityToMenuPayload(menuGetRes.payload, availability);
    const menuPutRes = await callUber(token, endpointFromTemplate(menuPutTemplate, storeOps.storeId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nextMenuPayload),
    });
    report.push({
      step: 'menu_hours',
      ok: menuPutRes.ok,
      status: menuPutRes.status,
      message: menuPutRes.ok
        ? 'Menu service_availability synced'
        : `menu hours sync failed: ${menuPutRes.error || 'request_failed'}`,
    });
  }

  if (!promotionsEndpoint) {
    report.push({
      step: 'promotions',
      ok: false,
      message: 'UBEREATS_PROMOTIONS_ENDPOINT not configured. Promotions kept as local drafts only.',
    });
    warnings.push('Promotions endpoint missing; drafts not pushed to Uber yet.');
  } else {
    const enabledPromotions = storeOps.promotions.filter((promo) => promo.enabled);
    if (!enabledPromotions.length) {
      report.push({
        step: 'promotions',
        ok: true,
        message: 'No enabled promotion drafts to push.',
      });
    } else {
      let pushErrors = 0;
      for (const promotion of enabledPromotions) {
        const payload = {
          store_id: storeOps.storeId,
          name: promotion.name,
          type: promotion.type,
          value: promotion.value,
          start_at: promotion.startAt,
          end_at: promotion.endAt,
          target: promotion.target,
          target_ids: promotion.targetIds,
        };
        const promotionRes = await callUber(token, promotionsEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!promotionRes.ok) pushErrors += 1;
      }
      report.push({
        step: 'promotions',
        ok: pushErrors === 0,
        message:
          pushErrors === 0
            ? `Promotion drafts pushed (${enabledPromotions.length})`
            : `${pushErrors}/${enabledPromotions.length} promotion pushes failed`,
      });
      if (pushErrors > 0) warnings.push('Some promotion drafts failed to sync.');
    }
  }

  const ok = report.every((item) => item.ok);
  return {
    ok,
    pushedAt,
    report,
    warnings,
  };
}

export function setStoreOpsLocal(
  state: DeliveryManagementState,
  nextStoreOps: DeliveryStoreOperationsState
): DeliveryManagementState {
  return {
    ...state,
    storeOps: state.storeOps.map((store) =>
      store.storeId === nextStoreOps.storeId ? nextStoreOps : store
    ),
  };
}

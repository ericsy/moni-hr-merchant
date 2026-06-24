import { apiRequest } from "./apiClient";
import type { EmployeePunchPayload, TodayWorkSummary } from "../types/fieldService";
import { buildTodayWorkSummary } from "./fieldServicePunchState";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = "") {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBool(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return fallback;
}

function mapTimelineItem(raw: Record<string, unknown>) {
  const type = asString(raw.type);
  if (type === "field_job") {
    return {
      type: "field_job" as const,
      id: asString(raw.id),
      start: asString(raw.start),
      end: asString(raw.end),
      customerName: asString(raw.customerName || raw.customer_name),
      serviceAddress: asString(raw.serviceAddress || raw.service_address),
      serviceType: asString(raw.serviceType || raw.service_type),
      latitude: asNumber(raw.latitude),
      longitude: asNumber(raw.longitude),
      geofenceRadius: asNumber(raw.geofenceRadius ?? raw.geofence_radius, 100),
      syncStoreClockIn: asBool(raw.syncStoreClockIn ?? raw.sync_store_clock_in),
      syncStoreClockOut: asBool(raw.syncStoreClockOut ?? raw.sync_store_clock_out),
      fieldClockInAt: asString(raw.fieldClockInAt || raw.field_clock_in_at) || null,
      fieldClockOutAt: asString(raw.fieldClockOutAt || raw.field_clock_out_at) || null,
    };
  }

  return {
    type: "store_shift" as const,
    id: asString(raw.id),
    start: asString(raw.start),
    end: asString(raw.end),
    storeName: asString(raw.storeName || raw.store_name),
    storeId: asString(raw.storeId || raw.store_id) || undefined,
    storeClockInAt: asString(raw.storeClockInAt || raw.store_clock_in_at) || null,
    storeClockOutAt: asString(raw.storeClockOutAt || raw.store_clock_out_at) || null,
    latitude: raw.latitude === undefined ? undefined : asNumber(raw.latitude),
    longitude: raw.longitude === undefined ? undefined : asNumber(raw.longitude),
    geofenceRadius:
      raw.geofenceRadius === undefined && raw.geofence_radius === undefined
        ? undefined
        : asNumber(raw.geofenceRadius ?? raw.geofence_radius),
  };
}

function mapTodayWorkSummary(input: unknown): TodayWorkSummary {
  const raw = asRecord(input);
  const date = asString(raw.date);
  const timeline = Array.isArray(raw.timeline)
    ? raw.timeline.map((item) => mapTimelineItem(asRecord(item)))
    : [];
  const currentRaw = asRecord(raw.currentPunchAction || raw.current_punch_action);
  const hasServerAction = !!asString(currentRaw.action);

  if (hasServerAction) {
    const geofenceRaw = asRecord(currentRaw.geofence);
    return {
      date,
      timeline,
      dayStatus: (asString(raw.dayStatus || raw.day_status, "not_started") as TodayWorkSummary["dayStatus"]),
      currentPunchAction: {
        action: asString(currentRaw.action) as TodayWorkSummary["currentPunchAction"]["action"],
        refType: (asString(currentRaw.refType || currentRaw.ref_type) || undefined) as TodayWorkSummary["currentPunchAction"]["refType"],
        refId: asString(currentRaw.refId || currentRaw.ref_id) || undefined,
        hint: asString(currentRaw.hint) || undefined,
        buttonLabel: asString(currentRaw.buttonLabel || currentRaw.button_label) || undefined,
        geofence:
          geofenceRaw.lat !== undefined
            ? {
                lat: asNumber(geofenceRaw.lat),
                lng: asNumber(geofenceRaw.lng),
                radius: asNumber(geofenceRaw.radius, 100),
              }
            : null,
      },
    };
  }

  return buildTodayWorkSummary({ date, timeline });
}

export const employeeApi = {
  getTodayWorkSummary: async (date?: string) => {
    const data = await apiRequest<unknown>("/api/v1/app/today-work-summary", {
      query: date ? { date } : undefined,
    });
    return mapTodayWorkSummary(data);
  },

  punch: async (payload: EmployeePunchPayload) => {
    const data = await apiRequest<unknown>("/api/v1/app/work/punch", {
      method: "POST",
      body: {
        refType: payload.refType,
        refId: payload.refId,
        punchType: payload.punchType,
        latitude: payload.latitude,
        longitude: payload.longitude,
        deviceId: payload.deviceId,
      },
    });
    return mapTodayWorkSummary(data);
  },
};

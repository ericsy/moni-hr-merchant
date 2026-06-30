import type { MerchantAttendanceRequest } from "./merchantApi";

export function isFieldMissedPunchRequest(request: Pick<MerchantAttendanceRequest, "requestType" | "fieldJobId">): boolean {
  return request.requestType === "missed_punch" && request.fieldJobId != null && String(request.fieldJobId).trim() !== "";
}

export function isStoreMissedPunchRequest(request: Pick<MerchantAttendanceRequest, "requestType" | "fieldJobId" | "publishedCellId">): boolean {
  return request.requestType === "missed_punch" && !isFieldMissedPunchRequest(request);
}

export function fieldMissedPunchCustomerName(request: Pick<MerchantAttendanceRequest, "areaName">): string {
  return (request.areaName || "").trim();
}

export function formatMissedPunchShiftRange(
  start?: string | null,
  end?: string | null,
): string {
  const s = (start || "").trim();
  const e = (end || "").trim();
  if (s && e) return `${s} – ${e}`;
  return s || e || "-";
}

export function fieldMissedPunchSyncFlags(request: Pick<MerchantAttendanceRequest, "syncStoreClockIn" | "syncStoreClockOut">) {
  return {
    syncIn: request.syncStoreClockIn === true,
    syncOut: request.syncStoreClockOut === true,
  };
}

import type { MerchantAttendanceFieldImpact, MerchantAttendanceRequest } from "./merchantApi";

export function isFieldLeaveRequest(
  request: Pick<MerchantAttendanceRequest, "requestType" | "leaveMode" | "fieldJobId">,
): boolean {
  return (
    request.requestType === "leave" &&
    request.leaveMode === "field_job" &&
    request.fieldJobId != null &&
    String(request.fieldJobId).trim() !== ""
  );
}

export function isFieldMissedPunchRequest(request: Pick<MerchantAttendanceRequest, "requestType" | "fieldJobId">): boolean {
  return request.requestType === "missed_punch" && request.fieldJobId != null && String(request.fieldJobId).trim() !== "";
}

export function isStoreMissedPunchRequest(request: Pick<MerchantAttendanceRequest, "requestType" | "fieldJobId" | "publishedCellId">): boolean {
  return request.requestType === "missed_punch" && !isFieldMissedPunchRequest(request);
}

export function fieldMissedPunchCustomerName(request: Pick<MerchantAttendanceRequest, "areaName">): string {
  return (request.areaName || "").trim();
}

export function fieldLeaveCustomerName(request: Pick<MerchantAttendanceRequest, "areaName">): string {
  return (request.areaName || "").trim();
}

export function requiredFieldImpactsFromRequest(
  impacts: MerchantAttendanceFieldImpact[] | undefined,
): MerchantAttendanceFieldImpact[] {
  return (impacts || []).filter((row) => row.requiredAction === "required");
}

/** 审批外勤请假时须处置的工单：优先 fieldImpacts，否则用申请快照合成。 */
export function resolveRequiredFieldImpactsForReview(
  request: MerchantAttendanceRequest,
): MerchantAttendanceFieldImpact[] {
  const fromImpacts = requiredFieldImpactsFromRequest(request.fieldImpacts);
  if (fromImpacts.length > 0) return fromImpacts;
  if (!isFieldLeaveRequest(request) || request.status !== "pending") return [];
  const jobId = Number(request.fieldJobId);
  if (!Number.isFinite(jobId) || jobId <= 0) return [];
  return [
    {
      fieldJobId: jobId,
      customerName: fieldLeaveCustomerName(request) || null,
      scheduledStart: request.shiftStartTime || null,
      scheduledEnd: request.shiftEndTime || null,
      requiredAction: "required",
    },
  ];
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

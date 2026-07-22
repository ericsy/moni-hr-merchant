import type {
  MerchantAttendanceDutyImpact,
  MerchantAttendanceFieldImpact,
  MerchantAttendanceRequest,
} from "./merchantApi";

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

/** 与 App 一致：仅展示与请假时段有实际重叠的外勤（不含仅与店班重叠） */
export function isVisibleFieldImpact(impact: MerchantAttendanceFieldImpact): boolean {
  const overlap = (impact.overlapType || "").trim().toLowerCase();
  return overlap === "full" || overlap === "partial";
}

export function requiredFieldImpactsFromRequest(
  impacts: MerchantAttendanceFieldImpact[] | undefined,
): MerchantAttendanceFieldImpact[] {
  return (impacts || []).filter(
    (row) => isVisibleFieldImpact(row) && row.requiredAction === "required",
  );
}

function combineDateAndHm(date?: string | null, hm?: string | null): string | null {
  const d = (date || "").trim().slice(0, 10);
  const t = (hm || "").trim().slice(0, 5);
  if (!d || !t) return null;
  return `${d}T${t}`;
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
      scheduledStart: combineDateAndHm(request.scheduleDate, request.shiftStartTime),
      scheduledEnd: combineDateAndHm(request.scheduleDate, request.shiftEndTime),
      requiredAction: "required",
      syncStoreClockIn: request.syncStoreClockIn ?? null,
      syncStoreClockOut: request.syncStoreClockOut ?? null,
    },
  ];
}

/** 详情展示用：仅实际重叠的外勤；外勤请假无 impact 时用快照合成。 */
export function resolveDisplayFieldImpacts(
  request: MerchantAttendanceRequest,
): MerchantAttendanceFieldImpact[] {
  const visible = (request.fieldImpacts || []).filter(isVisibleFieldImpact);
  if (visible.length > 0) {
    return visible;
  }
  return resolveRequiredFieldImpactsForReview(request);
}

export type FieldImpactScheduleWindow = {
  scheduleDate?: string;
  startTime?: string;
  endTime?: string;
};

function extractHm(value?: string | null): string | undefined {
  const s = (value || "").trim();
  if (!s) return undefined;
  if (/^\d{1,2}:\d{2}/.test(s)) {
    const [h, m] = s.split(":");
    return `${h.padStart(2, "0")}:${m.slice(0, 2)}`;
  }
  const match = /T(\d{1,2}):(\d{2})/.exec(s);
  if (match) return `${match[1].padStart(2, "0")}:${match[2]}`;
  return undefined;
}

function extractDateKey(value?: string | null): string | undefined {
  const s = (value || "").trim();
  if (!s) return undefined;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return undefined;
}

/** 改派候选人查询窗口：优先外勤计划时段，其次申请/请假明细快照。 */
export function resolveFieldImpactScheduleWindow(
  impact: MerchantAttendanceFieldImpact | undefined,
  request: MerchantAttendanceRequest,
): FieldImpactScheduleWindow {
  const fromImpact: FieldImpactScheduleWindow = {
    scheduleDate:
      extractDateKey(impact?.scheduledStart) || extractDateKey(impact?.scheduledEnd),
    startTime: extractHm(impact?.scheduledStart),
    endTime: extractHm(impact?.scheduledEnd),
  };
  if (fromImpact.scheduleDate && fromImpact.startTime && fromImpact.endTime) {
    return fromImpact;
  }

  if (request.scheduleDate && request.shiftStartTime && request.shiftEndTime) {
    return {
      scheduleDate: extractDateKey(request.scheduleDate),
      startTime: extractHm(request.shiftStartTime),
      endTime: extractHm(request.shiftEndTime),
    };
  }

  const leaveItem =
    (request.leaveItems || []).find(
      (item) =>
        impact?.leaveItemId != null && String(item.id) === String(impact.leaveItemId),
    ) || request.leaveItems?.[0];
  if (leaveItem?.scheduleDate && leaveItem.shiftStartTime && leaveItem.shiftEndTime) {
    return {
      scheduleDate: extractDateKey(leaveItem.scheduleDate),
      startTime: extractHm(leaveItem.partialStartTime || leaveItem.shiftStartTime),
      endTime: extractHm(leaveItem.partialEndTime || leaveItem.shiftEndTime),
    };
  }

  return fromImpact;
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

export function dutyImpactKey(impact: MerchantAttendanceDutyImpact): string {
  if ((impact.impactKey || "").trim()) return String(impact.impactKey).trim();
  return `${impact.templateId ?? ""}:${impact.workDate ?? ""}:${impact.publishedCellId ?? 0}`;
}

export function isVisibleDutyImpact(impact: MerchantAttendanceDutyImpact): boolean {
  const overlap = (impact.overlapType || "").trim().toLowerCase();
  return overlap === "full" || overlap === "partial";
}

export function resolveDisplayDutyImpacts(
  request: Pick<MerchantAttendanceRequest, "dutyImpacts">,
): MerchantAttendanceDutyImpact[] {
  return (request.dutyImpacts || []).filter(isVisibleDutyImpact);
}

export function resolveRequiredDutyImpactsForReview(
  request: Pick<MerchantAttendanceRequest, "dutyImpacts">,
): MerchantAttendanceDutyImpact[] {
  return resolveDisplayDutyImpacts(request).filter((row) => row.requiredAction === "required");
}

/** 与外勤同店班格子关联的 Duty（可跟随外勤处置） */
export function findParentFieldImpactForDuty(
  duty: MerchantAttendanceDutyImpact,
  fieldImpacts: MerchantAttendanceFieldImpact[] | undefined,
): MerchantAttendanceFieldImpact | null {
  const list = fieldImpacts || [];
  if (list.length === 0) return null;
  const cellId = duty.publishedCellId;
  if (cellId != null && String(cellId).trim() !== "" && Number(cellId) > 0) {
    const matches = list.filter(
      (f) =>
        f.linkedStoreShiftId != null &&
        String(f.linkedStoreShiftId) === String(cellId) &&
        isVisibleFieldImpact(f),
    );
    if (matches.length > 0) {
      return matches.find((m) => m.requiredAction === "required") ?? matches[0] ?? null;
    }
  }
  return null;
}

export function hmFromDutyWindow(iso?: string | null): string {
  const raw = (iso || "").trim();
  if (!raw) return "";
  const m = raw.match(/T(\d{2}:\d{2})/);
  if (m) return m[1];
  if (/^\d{1,2}:\d{2}/.test(raw)) {
    const [h, mm] = raw.split(":");
    return `${h.padStart(2, "0")}:${mm.slice(0, 2)}`;
  }
  return "";
}

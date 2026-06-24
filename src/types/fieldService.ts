export type FieldJobStatus =
  | "pending"
  | "assigned"
  | "in_progress"
  | "completed"
  | "cancelled";

export type PunchRefType = "store_shift" | "field_job";

export type PunchActionType =
  | "STORE_CLOCK_IN"
  | "FIELD_CLOCK_IN"
  | "FIELD_CLOCK_IN_SYNC_STORE"
  | "FIELD_CLOCK_OUT"
  | "FIELD_CLOCK_OUT_SYNC_STORE"
  | "STORE_CLOCK_OUT"
  | "WAITING"
  | "DONE";

export type DayWorkStatus = "not_started" | "in_progress" | "done";

export interface FieldServiceJob {
  id: string;
  merchantId?: string;
  storeId: string;
  storeName?: string;
  customerName: string;
  customerPhone: string;
  serviceAddress: string;
  latitude: number;
  longitude: number;
  geofenceRadius: number;
  scheduledStart: string;
  scheduledEnd: string;
  serviceType: string;
  status: FieldJobStatus;
  notes?: string;
  /** @deprecated 兼容旧接口，取 assignments 首条 */
  assignment?: FieldServiceJobAssignment | null;
  assignments?: FieldServiceJobAssignment[];
  createdAt?: string;
  updatedAt?: string;
}

export interface FieldServiceJobAssignment {
  id?: string;
  jobId: string;
  merchantAdminId: string;
  employeeName?: string;
  linkedStoreShiftId?: string | null;
  syncStoreClockIn: boolean;
  syncStoreClockOut: boolean;
  assignedAt?: string;
  assignedBy?: string;
}

export interface FieldJobStoreShiftBrief {
  id: string;
  storeId: string;
  storeName: string;
  date: string;
  start: string;
  end: string;
  startTime: string;
  endTime: string;
}

export interface FieldJobAssignPreview {
  hasStoreShift: boolean;
  storeShift?: FieldJobStoreShiftBrief | null;
  overlap: boolean;
  suggestedSyncStoreClockIn: boolean;
  suggestedSyncStoreClockOut: boolean;
  validationWarnings: string[];
}

export interface FieldJobAssignPayload {
  merchantAdminId: string;
  syncStoreClockIn: boolean;
  syncStoreClockOut: boolean;
}

export interface FieldJobAssignmentsSyncPayload {
  assignments: FieldJobAssignPayload[];
}

export interface FieldJobListParams {
  storeId?: string;
  status?: FieldJobStatus | "";
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  size?: number;
}

export interface FieldJobUpsertPayload {
  storeId: string;
  customerName: string;
  customerPhone: string;
  serviceAddress: string;
  latitude: number;
  longitude: number;
  geofenceRadius: number;
  scheduledStart: string;
  scheduledEnd: string;
  serviceType: string;
  notes?: string;
}

/** 表单提交：可选多名员工，选中后走派单/改派同步接口 */
export interface FieldJobFormSubmitPayload extends FieldJobUpsertPayload {
  merchantAdminIds?: string[];
}

export interface TimelineStoreShiftItem {
  type: "store_shift";
  id: string;
  start: string;
  end: string;
  storeName: string;
  storeId?: string;
  storeClockInAt?: string | null;
  storeClockOutAt?: string | null;
  latitude?: number;
  longitude?: number;
  geofenceRadius?: number;
}

export interface TimelineFieldJobItem {
  type: "field_job";
  id: string;
  start: string;
  end: string;
  customerName: string;
  serviceAddress: string;
  serviceType?: string;
  latitude: number;
  longitude: number;
  geofenceRadius: number;
  syncStoreClockIn: boolean;
  syncStoreClockOut: boolean;
  fieldClockInAt?: string | null;
  fieldClockOutAt?: string | null;
}

export type TodayWorkTimelineItem = TimelineStoreShiftItem | TimelineFieldJobItem;

export interface PunchGeofence {
  lat: number;
  lng: number;
  radius: number;
}

export interface CurrentPunchAction {
  action: PunchActionType;
  refType?: PunchRefType;
  refId?: string;
  geofence?: PunchGeofence | null;
  hint?: string;
  buttonLabel?: string;
}

export interface TodayWorkSummary {
  date: string;
  timeline: TodayWorkTimelineItem[];
  currentPunchAction: CurrentPunchAction;
  dayStatus: DayWorkStatus;
}

export interface EmployeePunchPayload {
  refType: PunchRefType;
  refId: string;
  punchType: "clock_in" | "clock_out";
  latitude: number;
  longitude: number;
  deviceId?: string;
}

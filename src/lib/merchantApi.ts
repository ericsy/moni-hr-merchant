import { appendEndpointPath, getMerchantEndpoint } from "../config/merchantEndpoints";
import type {
    Area,
    CountryOption,
    Employee,
    PublicHoliday,
    RosterTemplate,
    RosterTemplateCell,
    ScheduleShift,
    Store,
    StoreOfficerBrief,
    StoreWeekdayHours,
    TimeSlot,
    WorkDayPattern,
} from "../context/DataContext";
import type {
  FieldJobAssignPayload,
  FieldJobAssignmentsSyncPayload,
  FieldJobAssignPreview,
  FieldJobListParams,
  FieldJobUpsertPayload,
  FieldServiceJob,
  FieldServiceJobAssignment,
} from "../types/fieldService";
import { apiRequest, apiRequestBlob, ApiError } from "./apiClient";

export interface MerchantLoginResult {
  accessToken?: string | null;
  expiresIn?: number | null;
  user?: {
    email?: string;
    name?: string;
    lastStoreId?: number | string | null;
  };
  status?: string | null;
}

export interface MerchantActivationEmail {
  email?: string | null;
  adminName?: string | null;
}

export interface MerchantAdminPrincipal {
  id?: number | string | null;
  merchantAdminId?: number | string | null;
  adminName?: string | null;
  adminType?: number | string | null;
  admin_type?: number | string | null;
  isAdmin?: boolean | number | string | null;
  is_admin?: boolean | number | string | null;
  admin?: boolean | number | string | null;
  role?: string | null;
  roleKey?: string | null;
  [key: string]: unknown;
}

export interface MerchantPrincipal {
  merchantAdminId?: number | string | null;
  merchantId?: number | string | null;
  adminName?: string | null;
  lastStoreId?: number | string | null;
  merchantAdmin?: MerchantAdminPrincipal | boolean | number | string | null;
  adminType?: number | string | null;
  admin_type?: number | string | null;
  isAdmin?: boolean | number | string | null;
  is_admin?: boolean | number | string | null;
  admin?: boolean | number | string | null;
  role?: string | null;
  roleKey?: string | null;
  portalRole?: string | null;
  managedStores?: ManagedStoreBrief[];
  storeManagerStores?: ManagedStoreBrief[];
  deputyManagerStores?: ManagedStoreBrief[];
}

export interface ManagedStoreBrief {
  id: string;
  name: string;
  merchantId?: string;
  merchantName?: string;
}

function normalizeFlag(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (["true", "1", "yes", "y", "admin", "owner", "super_admin", "merchant_admin"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "employee", "staff", "member"].includes(normalized)) return false;
  return null;
}

function mapManagedStoreBrief(input: unknown): ManagedStoreBrief | null {
  const raw = asRecord(input);
  const id = asString(raw.id);
  if (!id) return null;
  const merchantName = asString(raw.merchantName || raw.merchant_name);
  const name = asString(raw.name || raw.storeName);
  const label = merchantName ? `${merchantName} / ${name}` : name;
  return {
    id,
    name: label,
    merchantId: asString(raw.merchantId || raw.merchant_id) || undefined,
    merchantName: merchantName || undefined,
  };
}

export function mapMerchantPrincipal(input: unknown): MerchantPrincipal {
  const raw = asRecord(input);
  const managedStores = asArray(raw.managedStores || raw.managed_stores)
    .map(mapManagedStoreBrief)
    .filter((item): item is ManagedStoreBrief => !!item);
  return {
    merchantAdminId: (raw.merchantAdminId ?? raw.merchant_admin_id) as MerchantPrincipal["merchantAdminId"],
    merchantId: (raw.merchantId ?? raw.merchant_id) as MerchantPrincipal["merchantId"],
    adminName: asString(raw.adminName || raw.admin_name),
    lastStoreId: (raw.lastStoreId ?? raw.last_store_id) as MerchantPrincipal["lastStoreId"],
    merchantAdmin: raw.merchantAdmin as MerchantAdminPrincipal | boolean | undefined,
    adminType: (raw.adminType ?? raw.admin_type) as MerchantPrincipal["adminType"],
    portalRole: asString(raw.portalRole || raw.portal_role),
    managedStores,
    storeManagerStores: asArray(raw.storeManagerStores || raw.store_manager_stores)
      .map(mapManagedStoreBrief)
      .filter((item): item is ManagedStoreBrief => !!item),
    deputyManagerStores: asArray(raw.deputyManagerStores || raw.deputy_manager_stores)
      .map(mapManagedStoreBrief)
      .filter((item): item is ManagedStoreBrief => !!item),
  };
}

function normalizePrincipalType(value: unknown) {
  if (value === undefined || value === null) return "";
  return String(value).trim().toLowerCase();
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function isMerchantAdminPrincipal(principal?: MerchantPrincipal | null) {
  if (!principal) return false;

  const nested = isObjectRecord(principal.merchantAdmin) ? principal.merchantAdmin : null;
  const merchantAdminFlag = normalizeFlag(principal.merchantAdmin);
  if (merchantAdminFlag !== null) return merchantAdminFlag;

  const explicitFlag = normalizeFlag(
    nested?.isAdmin ??
      nested?.is_admin ??
      nested?.admin ??
      principal.isAdmin ??
      principal.is_admin ??
      principal.admin
  );
  if (explicitFlag !== null) return explicitFlag;

  const role = normalizePrincipalType(nested?.role ?? nested?.roleKey ?? principal.role ?? principal.roleKey);
  if (["employee", "staff", "member"].includes(role)) return false;
  if (["admin", "owner", "super_admin", "merchant_admin", "main_admin", "primary_admin"].includes(role)) return true;

  const adminType = normalizePrincipalType(nested?.adminType ?? nested?.admin_type ?? principal.adminType ?? principal.admin_type);
  if (["2", "employee", "staff", "member"].includes(adminType)) return false;
  return ["1", "admin", "owner", "super_admin", "merchant_admin", "main_admin", "primary_admin"].includes(adminType);
}

/** 店长 / 副店长等非店主门店管理人员（用于默认简易版 UI） */
export function isStoreManagerLikePrincipal(principal?: MerchantPrincipal | null) {
  if (!principal || isMerchantAdminPrincipal(principal)) return false;

  if ((principal.storeManagerStores?.length ?? 0) > 0) return true;
  if ((principal.deputyManagerStores?.length ?? 0) > 0) return true;

  const portalRole = normalizePrincipalType(principal.portalRole);
  if (
    [
      "store_manager",
      "storemanager",
      "manager",
      "deputy_manager",
      "deputy",
      "assistant_manager",
      "assistantmanager",
      "店长",
      "副店长",
    ].includes(portalRole)
  ) {
    return true;
  }

  return (principal.managedStores?.length ?? 0) > 0;
}

export interface MerchantFeatureTreeNode {
  id?: number | string | null;
  nameZh?: string | null;
  nameEn?: string | null;
  url?: string | null;
  component?: string | null;
  componentPath?: string | null;
  routePath?: string | null;
  requestUrl?: string | null;
  requestPath?: string | null;
  apiUrl?: string | null;
  apiPath?: string | null;
  status?: number | null;
  sortOrder?: number | null;
  children?: MerchantFeatureTreeNode[] | null;
  meta?: Record<string, unknown> | null;
}

export interface RawGlobalShift {
  id?: number | string;
  name?: string;
  startTime?: string;
  endTime?: string;
  breakMinutes?: number;
  color?: string;
  days?: string;
  storeId?: string;
  scope?: number;
}

export interface RawScheduleTemplateListItem {
  id?: number | string;
  name?: string;
}

export interface MerchantCheckoutSession {
  checkoutUrl?: string | null;
}

export interface MerchantSubscription {
  merchantId?: number | string | null;
  planId?: number | string | null;
  quantity?: number | null;
  status?: string | null;
  cancelAtPeriodEnd?: number | boolean | null;
  currentPeriodEnd?: string | null;
}

export interface MerchantInvoiceSummary {
  id?: string | null;
  number?: string | null;
  status?: string | null;
  currency?: string | null;
  total?: number | null;
  amountPaid?: number | null;
  amountDue?: number | null;
  created?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  hostedInvoiceUrl?: string | null;
  invoicePdf?: string | null;
  billingReason?: string | null;
  description?: string | null;
}

export interface MerchantInvoiceList {
  items?: MerchantInvoiceSummary[];
  hasMore?: boolean;
  nextStartingAfter?: string | null;
}

export interface DutyTemplateApi {
  id?: number | string;
  storeId?: number | string;
  title?: string;
  description?: string | null;
  triggerType?: string;
  intervalMinutes?: number | null;
  required?: boolean;
  assignmentMode?: string;
  sortOrder?: number;
  status?: number;
  fixedAssigneeIds?: number[];
}

export interface DutyCompletionApi {
  id?: number | string;
  templateId?: number | string;
  title?: string;
  triggerType?: string;
  merchantAdminId?: number | string;
  publishedCellId?: number | string;
  sequenceNo?: number;
  status?: string;
  required?: boolean;
  windowStart?: string | null;
  windowEnd?: string | null;
  dueAt?: string | null;
  completedAt?: string | null;
}

export interface MerchantUploadResult {
  key?: string;
  downloadUrl?: string;
}

export interface MerchantDashboardStatistics {
  staffWorkingToday?: number | null;
  absentEmployees?: number | null;
  labourCostToday?: number | null;
  weeklyHours?: number | null;
  overtimeRiskEmployees?: number | null;
}

export type MerchantTodayAttendanceStatus =
  | "not_punched"
  | "clocked_in"
  | "completed"
  | "on_leave"
  | "punch_exempt";

export interface MerchantTodayAttendanceShift {
  startTime?: string | null;
  endTime?: string | null;
  shiftName?: string | null;
  areaName?: string | null;
}

export interface MerchantTodayAttendanceItem {
  merchantAdminId?: number | string | null;
  displayName?: string | null;
  employeeCode?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  attendanceStatus?: MerchantTodayAttendanceStatus | null;
  shifts?: MerchantTodayAttendanceShift[];
  clockInAt?: string | null;
  clockOutAt?: string | null;
  punchSource?: string | null;
}

export interface MerchantTodayAttendanceSummary {
  scheduled?: number | null;
  punched?: number | null;
  notPunched?: number | null;
  onLeave?: number | null;
}

export interface MerchantTodayAttendance {
  storeId?: number | string | null;
  date?: string | null;
  timeZone?: string | null;
  summary?: MerchantTodayAttendanceSummary | null;
  items?: MerchantTodayAttendanceItem[];
}

export type MerchantAttendanceRequestType = "leave" | "missed_punch";
export type MerchantAttendanceRequestStatus = "pending" | "approved" | "rejected";
export type MerchantClockPunchType = "clock_in" | "clock_out";
export type MerchantClockPunchSource = "normal" | "missed_punch_backfill" | "leave";

export interface MerchantEmployeeBrief {
  merchantAdminId?: number | string | null;
  id?: number | string | null;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  name?: string | null;
  employeeCode?: string | null;
  email?: string | null;
  role?: string | null;
}

export interface ScheduleSubstitutionBrief {
  substitutionId?: number | string | null;
  substituteMerchantAdminId?: number | string | null;
  substituteDisplayName?: string | null;
  substituteStartTime?: string | null;
  substituteEndTime?: string | null;
  substitutionStatus?: string | null;
}

export interface LeaveSubstitutionReviewItem {
  leaveItemId: number | string;
  substituteMerchantAdminId: number | string;
  substituteStartTime?: string | null;
  substituteEndTime?: string | null;
}

export interface MerchantAttendanceLeaveItem {
  id?: number | string | null;
  publishedCellId?: number | string | null;
  leaveScope?: string | null;
  leaveEffect?: "full" | "late_in" | "early_out" | string | null;
  partialStartTime?: string | null;
  partialEndTime?: string | null;
  scheduleDate?: string | null;
  shiftStartTime?: string | null;
  shiftEndTime?: string | null;
  substitution?: ScheduleSubstitutionBrief | null;
}

export interface ScheduleSubstitutionConflict {
  substitutionId?: number | string | null;
  leaveItemId?: number | string | null;
  conflictCode?: string | null;
  message?: string | null;
}

export interface ScheduleSubstitutionOrphaned {
  substitutionId?: number | string | null;
  leaveItemId?: number | string | null;
  substituteMerchantAdminId?: number | string | null;
}

export interface MerchantSchedulePublishResult {
  conflicts?: ScheduleSubstitutionConflict[];
  orphanedSubstitutions?: ScheduleSubstitutionOrphaned[];
}

export interface EmployeeDateLeave {
  storeId?: number | string | null;
  merchantAdminId?: number | string | null;
  displayName?: string | null;
  leaveDateFrom?: string | null;
  leaveDateTo?: string | null;
  status?: string | null;
  requestId?: number | string | null;
}

export interface EmployeeShiftLeave {
  storeId?: number | string | null;
  merchantAdminId?: number | string | null;
  displayName?: string | null;
  scheduleDate?: string | null;
  shiftStartTime?: string | null;
  shiftEndTime?: string | null;
  leaveScope?: string | null;
  leaveEffect?: string | null;
  partialStartTime?: string | null;
  partialEndTime?: string | null;
  requestId?: number | string | null;
  leaveItemId?: number | string | null;
}

export interface MerchantAttendanceFieldImpact {
  id?: number | string | null;
  leaveItemId?: number | string | null;
  fieldJobId: number;
  linkedStoreShiftId?: number | string | null;
  overlapType?: string | null;
  requiredAction?: string | null;
  customerName?: string | null;
  serviceType?: string | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  syncStoreClockIn?: boolean | null;
  syncStoreClockOut?: boolean | null;
}

export interface MerchantAttendanceFieldDisposition {
  id?: number | string | null;
  fieldJobId: number;
  action?: string | null;
  assigneeMerchantAdminId?: number | string | null;
  source?: string | null;
}

export interface MerchantAttendanceRequest {
  id?: number | string | null;
  storeId?: number | string | null;
  storeName?: string | null;
  requestType?: MerchantAttendanceRequestType | string | null;
  leaveMode?: "shift" | "date_range" | "field_job" | string | null;
  leaveDateFrom?: string | null;
  leaveDateTo?: string | null;
  status?: MerchantAttendanceRequestStatus | string | null;
  reason?: string | null;
  approverMerchantAdminId?: number | string | null;
  approverKind?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewComment?: string | null;
  publishedCellId?: number | string | null;
  fieldJobId?: number | string | null;
  linkedStoreShiftId?: number | string | null;
  syncStoreClockIn?: boolean | null;
  syncStoreClockOut?: boolean | null;
  serviceAddress?: string | null;
  areaId?: number | string | null;
  areaName?: string | null;
  punchType?: MerchantClockPunchType | string | null;
  actualPunchedAt?: string | null;
  scheduleDate?: string | null;
  shiftStartTime?: string | null;
  shiftEndTime?: string | null;
  applicant?: MerchantEmployeeBrief | null;
  approver?: MerchantEmployeeBrief | null;
  reviewerMerchantAdminId?: number | string | null;
  reviewer?: MerchantEmployeeBrief | null;
  proxyReviewer?: MerchantEmployeeBrief | null;
  proxyReview?: boolean | null;
  leaveItems?: MerchantAttendanceLeaveItem[];
  fieldImpacts?: MerchantAttendanceFieldImpact[];
  fieldDispositions?: MerchantAttendanceFieldDisposition[];
}

export interface MerchantAttendanceRequestSummary {
  storeId?: number | string | null;
  pending?: number | null;
  approved?: number | null;
  rejected?: number | null;
  reviewed?: number | null;
  total?: number | null;
  leave?: number | null;
  missedPunch?: number | null;
  pendingAssignedToMe?: number | null;
}

export interface MerchantPageMeta {
  page?: number | null;
  size?: number | null;
  total?: number | null;
  totalPages?: number | null;
  pages?: number | null;
  hasNext?: boolean | null;
  hasPrevious?: boolean | null;
}

export interface MerchantAttendanceRequestPage {
  storeIds?: Array<number | string>;
  items?: MerchantAttendanceRequest[];
  page?: MerchantPageMeta | Record<string, unknown>;
}

export interface MerchantAttendanceRequestPageParams {
  page?: number;
  size?: number;
  storeIds?: Array<number | string>;
  merchantAdminIds?: Array<number | string>;
  status?: MerchantAttendanceRequestStatus | "";
  requestType?: MerchantAttendanceRequestType | "";
  from?: string;
  to?: string;
}

export interface MerchantClockSummary {
  storeId?: number | string | null;
  date?: string | null;
  totalPunches?: number | null;
  clockInCount?: number | null;
  clockOutCount?: number | null;
  employeesPunched?: number | null;
  suspectedProxyCount?: number | null;
  normalPunchCount?: number | null;
  missedPunchBackfillCount?: number | null;
  leavePunchCount?: number | null;
  pendingMissedPunchRequests?: number | null;
}

export interface MerchantClockPunch {
  id?: number | string | null;
  storeId?: number | string | null;
  storeName?: string | null;
  storeCode?: string | null;
  merchantAdminId?: number | string | null;
  employee?: MerchantEmployeeBrief | null;
  publishedCellId?: number | string | null;
  punchType?: MerchantClockPunchType | string | null;
  punchSource?: MerchantClockPunchSource | string | null;
  punchedAt?: string | null;
  createdAt?: string | null;
  deviceType?: string | null;
  deviceId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distanceMeters?: number | null;
  withinGeofence?: boolean | null;
  suspectedProxyPunch?: boolean | null;
  proxyPunchReason?: string | null;
  proxyPunchReasons?: string[] | null;
  proxySharedDeviceOtherMerchantAdminIds?: Array<number | string> | null;
  proxySharedDeviceEmployees?: MerchantEmployeeBrief[] | null;
  attendanceRequestId?: number | string | null;
  attendanceLeaveItemId?: number | string | null;
  refType?: string | null;
  refId?: number | string | null;
  syncEffect?: string | null;
  customerName?: string | null;
}

export interface MerchantClockPunchQueryParams {
  from: string;
  to: string;
  storeIds?: Array<number | string>;
  merchantAdminIds?: Array<number | string>;
  merchantAdminId?: number | string;
  punchType?: MerchantClockPunchType | "";
  punchSource?: MerchantClockPunchSource | "";
  proxyPunchSuspected?: boolean;
}

export interface MerchantClockAnomalyPageParams extends MerchantClockPunchQueryParams {
  page?: number;
  size?: number;
}

export interface MerchantClockAnomalySummary {
  totalCount?: number | null;
  newDeviceIdCount?: number | null;
  sharedMerchantDeviceCount?: number | null;
}

export interface MerchantClockAnomalyPage {
  storeIds?: Array<number | string>;
  from?: string | null;
  to?: string | null;
  summary?: MerchantClockAnomalySummary | null;
  items?: MerchantClockPunch[];
  page?: MerchantPageMeta | Record<string, unknown>;
}

export interface MerchantClockPunchesDay {
  storeIds?: Array<number | string>;
  from?: string | null;
  to?: string | null;
  punches?: MerchantClockPunch[];
}

export interface MerchantEmployeeIdName {
  id?: number | string | null;
  name?: string | null;
}

export interface MerchantEmployeeStatisticsItem {
  merchantAdminId?: number | string | null;
  displayName?: string | null;
  plannedWorkHours?: number | null;
  actualWorkHours?: number | null;
  leaveRequestCount?: number | null;
  leaveApprovedCount?: number | null;
  leaveRejectedCount?: number | null;
  missedPunchRequestCount?: number | null;
  missedPunchApprovedCount?: number | null;
  missedPunchRejectedCount?: number | null;
  clockAnomalyCount?: number | null;
}

export interface MerchantEmployeeStatisticsPayload {
  storeIds?: Array<number | string>;
  from?: string | null;
  to?: string | null;
  items?: MerchantEmployeeStatisticsItem[];
}

export interface MerchantEmployeeStatisticsParams {
  from?: string;
  to?: string;
  merchantAdminIds?: Array<number | string>;
  storeIds?: Array<number | string>;
}

const EMPTY_PAGE = { items: [] as unknown[] };
type ApiRecord = Record<string, unknown>;
type EmployeeUploadKind = "id-front" | "id-back" | "visa" | "passport" | "ks1" | "ir330";

const EMPLOYEE_DOCUMENT_UPLOAD_PATHS: Record<EmployeeUploadKind, string> = {
  "id-front": "/api/v1/merchant/uploads/employee-id-document-front",
  "id-back": "/api/v1/merchant/uploads/employee-id-document-back",
  visa: "/api/v1/merchant/uploads/employee-visa-document",
  passport: "/api/v1/merchant/uploads/employee-passport-document",
  ks1: "/api/v1/merchant/uploads/employee-ks1-document",
  ir330: "/api/v1/merchant/uploads/employee-ir330-document",
};

function asRecord(value: unknown): ApiRecord {
  return value && typeof value === "object" ? value as ApiRecord : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown, fallback = "") {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

/** 将接口中的 LocalDate（字符串或 [y,m,d] 数组等）规范为 YYYY-MM-DD，供排班请假区间比较 */
export function normalizeApiLocalDate(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") {
    const s = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    return s;
  }
  if (Array.isArray(value) && value.length >= 3) {
    const y = Number(value[0]);
    const m = Number(value[1]);
    const d = Number(value[2]);
    if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  return "";
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

export function extractUploadKey(value: unknown) {
  const raw = asString(value).trim();
  if (!raw) return "";
  if (!isHttpUrl(raw)) return raw;

  try {
    const url = new URL(raw);
    const keyFromQuery =
      url.searchParams.get("key") ||
      url.searchParams.get("fileKey") ||
      url.searchParams.get("objectKey");
    if (keyFromQuery) return keyFromQuery;
    return decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  } catch {
    return "";
  }
}

function asNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function mapApiDashboardStatistics(input: unknown): MerchantDashboardStatistics {
  const raw = asRecord(input);
  return {
    staffWorkingToday: asNumber(raw.staffWorkingToday),
    absentEmployees: asNumber(raw.absentEmployees),
    labourCostToday: asNumber(raw.labourCostToday),
    weeklyHours: asNumber(raw.weeklyHours),
    overtimeRiskEmployees: asNumber(raw.overtimeRiskEmployees),
  };
}

function mapApiTodayAttendanceShift(input: unknown): MerchantTodayAttendanceShift {
  const raw = asRecord(input);
  return {
    startTime: asString(raw.startTime),
    endTime: asString(raw.endTime),
    shiftName: asString(raw.shiftName),
    areaName: asString(raw.areaName),
  };
}

function mapApiTodayAttendanceItem(input: unknown): MerchantTodayAttendanceItem {
  const raw = asRecord(input);
  const status = asString(raw.attendanceStatus) as MerchantTodayAttendanceStatus;
  return {
    merchantAdminId: (raw.merchantAdminId ?? raw.merchant_admin_id) as
      | number
      | string
      | null
      | undefined,
    displayName: asString(raw.displayName || raw.display_name),
    employeeCode: asString(raw.employeeCode || raw.employee_code),
    firstName: asString(raw.firstName || raw.first_name),
    lastName: asString(raw.lastName || raw.last_name),
    attendanceStatus: status || null,
    shifts: asArray(raw.shifts).map(mapApiTodayAttendanceShift),
    clockInAt: asString(raw.clockInAt || raw.clock_in_at),
    clockOutAt: asString(raw.clockOutAt || raw.clock_out_at),
    punchSource: asString(raw.punchSource || raw.punch_source),
  };
}

function mapApiTodayAttendance(input: unknown): MerchantTodayAttendance {
  const raw = asRecord(input);
  const summaryRaw = asRecord(raw.summary);
  return {
    storeId: (raw.storeId ?? raw.store_id) as number | string | null | undefined,
    date: asString(raw.date),
    timeZone: asString(raw.timeZone || raw.time_zone),
    summary: {
      scheduled: asNumber(summaryRaw.scheduled),
      punched: asNumber(summaryRaw.punched),
      notPunched: asNumber(summaryRaw.notPunched ?? summaryRaw.not_punched),
      onLeave: asNumber(summaryRaw.onLeave ?? summaryRaw.on_leave),
    },
    items: asArray(raw.items).map(mapApiTodayAttendanceItem),
  };
}

function mapPageMeta(input: unknown): MerchantPageMeta {
  const raw = asRecord(input);
  const total =
    raw.total ??
    raw.totalElements ??
    raw.totalCount ??
    raw.count ??
    raw.records;
  const page =
    raw.page ??
    raw.pageNumber ??
    raw.current ??
    raw.currentPage;
  const size =
    raw.size ??
    raw.pageSize ??
    raw.limit;
  const totalPages =
    raw.totalPages ??
    raw.pages ??
    raw.pageCount;

  return compactDeep({
    page: page === undefined ? undefined : asNumber(page),
    size: size === undefined ? undefined : asNumber(size),
    total: total === undefined ? undefined : asNumber(total),
    totalPages: totalPages === undefined ? undefined : asNumber(totalPages),
    pages: totalPages === undefined ? undefined : asNumber(totalPages),
    hasNext: typeof raw.hasNext === "boolean" ? raw.hasNext : undefined,
    hasPrevious: typeof raw.hasPrevious === "boolean" ? raw.hasPrevious : undefined,
  });
}

function mapEmployeeBrief(input: unknown): MerchantEmployeeBrief {
  const raw = asRecord(input);
  const firstName = asString(raw.firstName);
  const lastName = asString(raw.lastName);
  const displayName =
    asString(raw.displayName || raw.name || raw.fullName || raw.adminName) ||
    [firstName, lastName].filter(Boolean).join(" ");

  return compactDeep({
    merchantAdminId: raw.merchantAdminId as number | string | null | undefined ?? raw.id as number | string | null | undefined,
    id: raw.id as number | string | null | undefined ?? raw.merchantAdminId as number | string | null | undefined,
    firstName,
    lastName,
    displayName,
    name: displayName,
    employeeCode: asString(raw.employeeCode || raw.employeeId),
    email: asString(raw.email),
    role: asString(raw.role || raw.position),
  });
}

function mapScheduleSubstitutionBrief(input: unknown): ScheduleSubstitutionBrief | undefined {
  if (!input) return undefined;
  const raw = asRecord(input);
  if (!raw.substitutionId && !raw.substituteMerchantAdminId) return undefined;
  return compactDeep({
    substitutionId: raw.substitutionId as number | string | null | undefined,
    substituteMerchantAdminId: raw.substituteMerchantAdminId as number | string | null | undefined,
    substituteDisplayName: asString(raw.substituteDisplayName),
    substituteStartTime: normalizeTime(raw.substituteStartTime) || asString(raw.substituteStartTime),
    substituteEndTime: normalizeTime(raw.substituteEndTime) || asString(raw.substituteEndTime),
    substitutionStatus: asString(raw.substitutionStatus),
  });
}

function resolveAttendanceLeaveMode(
  requestType: string,
  leaveModeRaw: unknown,
  leaveDateFrom: string,
  leaveDateTo: string,
): "shift" | "date_range" | "field_job" {
  if (requestType !== "leave") return "shift";
  const raw = asString(leaveModeRaw).trim().toLowerCase().replace(/-/g, "_");
  if (raw === "date_range" || raw === "daterange") return "date_range";
  if (raw === "shift") return "shift";
  if (raw === "field_job" || raw === "fieldjob") return "field_job";
  if (leaveDateFrom && leaveDateTo) return "date_range";
  return "shift";
}

function mapAttendanceLeaveItem(input: unknown): MerchantAttendanceLeaveItem {
  const raw = asRecord(input);
  return compactDeep({
    id: raw.id as number | string | null | undefined,
    publishedCellId: raw.publishedCellId as number | string | null | undefined,
    leaveScope: asString(raw.leaveScope),
    leaveEffect: asString(raw.leaveEffect) as MerchantAttendanceLeaveItem["leaveEffect"],
    partialStartTime: normalizeTime(raw.partialStartTime) || asString(raw.partialStartTime),
    partialEndTime: normalizeTime(raw.partialEndTime) || asString(raw.partialEndTime),
    scheduleDate: normalizeApiLocalDate(raw.scheduleDate || raw.shiftDate || raw.schedule_date || raw.shift_date),
    shiftStartTime: normalizeTime(raw.shiftStartTime),
    shiftEndTime: normalizeTime(raw.shiftEndTime),
    substitution: mapScheduleSubstitutionBrief(raw.substitution),
  });
}

function mapAttendanceRequest(input: unknown): MerchantAttendanceRequest {
  const raw = asRecord(input);
  const store = asRecord(raw.store);
  const requestType = asString(raw.requestType) as MerchantAttendanceRequestType;
  const leaveDateFrom = normalizeApiLocalDate(raw.leaveDateFrom ?? raw.leave_date_from);
  const leaveDateTo = normalizeApiLocalDate(raw.leaveDateTo ?? raw.leave_date_to);
  const leaveMode = resolveAttendanceLeaveMode(
    requestType,
    raw.leaveMode ?? raw.leave_mode,
    leaveDateFrom,
    leaveDateTo,
  );
  const fieldImpacts = asArray(raw.fieldImpacts).map((row) => {
    const it = asRecord(row);
    // NOTE: 不用 compactDeep，否则会把结果推成 Partial<>，导致 TS 无法满足必填 fieldJobId。
    return {
      id: (it.id as number | string | null | undefined) ?? null,
      leaveItemId: (it.leaveItemId as number | string | null | undefined) ?? null,
      fieldJobId: asNumber(it.fieldJobId),
      linkedStoreShiftId: (it.linkedStoreShiftId as number | string | null | undefined) ?? null,
      overlapType: asString(it.overlapType) || null,
      requiredAction: asString(it.requiredAction) || null,
      customerName: asString(it.customerName) || null,
      serviceType: asString(it.serviceType) || null,
      scheduledStart: asString(it.scheduledStart) || null,
      scheduledEnd: asString(it.scheduledEnd) || null,
      syncStoreClockIn: asBoolean(it.syncStoreClockIn),
      syncStoreClockOut: asBoolean(it.syncStoreClockOut),
    } satisfies MerchantAttendanceFieldImpact;
  });

  const fieldDispositions = asArray(raw.fieldDispositions).map((row) => {
    const it = asRecord(row);
    return {
      id: (it.id as number | string | null | undefined) ?? null,
      fieldJobId: asNumber(it.fieldJobId),
      action: asString(it.action) || null,
      assigneeMerchantAdminId: (it.assigneeMerchantAdminId as number | string | null | undefined) ?? null,
      source: asString(it.source) || null,
    } satisfies MerchantAttendanceFieldDisposition;
  });

  return compactDeep({
    id: raw.id as number | string | null | undefined,
    storeId: raw.storeId as number | string | null | undefined,
    storeName: asString(raw.storeName || store.name),
    requestType,
    leaveMode,
    leaveDateFrom,
    leaveDateTo,
    status: asString(raw.status) as MerchantAttendanceRequestStatus,
    reason: asString(raw.reason),
    approverMerchantAdminId: raw.approverMerchantAdminId as number | string | null | undefined,
    approverKind: asString(raw.approverKind),
    submittedAt: asString(raw.submittedAt || raw.createdAt),
    reviewedAt: asString(raw.reviewedAt),
    reviewComment: asString(raw.reviewComment),
    publishedCellId: raw.publishedCellId as number | string | null | undefined,
    fieldJobId: raw.fieldJobId as number | string | null | undefined,
    linkedStoreShiftId: raw.linkedStoreShiftId as number | string | null | undefined,
    syncStoreClockIn: asBoolean(raw.syncStoreClockIn),
    syncStoreClockOut: asBoolean(raw.syncStoreClockOut),
    serviceAddress: asString(raw.serviceAddress),
    areaId: raw.areaId as number | string | null | undefined,
    areaName: asString(raw.areaName),
    punchType: asString(raw.punchType) as MerchantClockPunchType,
    actualPunchedAt: asString(raw.actualPunchedAt),
    scheduleDate: normalizeApiLocalDate(raw.scheduleDate ?? raw.schedule_date),
    shiftStartTime: normalizeTime(raw.shiftStartTime),
    shiftEndTime: normalizeTime(raw.shiftEndTime),
    applicant: raw.applicant ? mapEmployeeBrief(raw.applicant) : undefined,
    approver: raw.approver ? mapEmployeeBrief(raw.approver) : undefined,
    reviewerMerchantAdminId: raw.reviewerMerchantAdminId as number | string | null | undefined,
    reviewer: raw.reviewer ? mapEmployeeBrief(raw.reviewer) : undefined,
    proxyReviewer: raw.proxyReviewer ? mapEmployeeBrief(raw.proxyReviewer) : undefined,
    proxyReview: typeof raw.proxyReview === "boolean" ? raw.proxyReview : undefined,
    leaveItems: asArray(raw.leaveItems).map(mapAttendanceLeaveItem),
    fieldImpacts,
    fieldDispositions,
  });
}

function mapAttendanceSummary(input: unknown): MerchantAttendanceRequestSummary {
  const raw = asRecord(input);
  return {
    storeId: raw.storeId as number | string | null | undefined,
    pending: asNumber(raw.pending),
    approved: asNumber(raw.approved),
    rejected: asNumber(raw.rejected),
    reviewed: asNumber(raw.reviewed),
    total: asNumber(raw.total),
    leave: asNumber(raw.leave),
    missedPunch: asNumber(raw.missedPunch),
    pendingAssignedToMe: asNumber(raw.pendingAssignedToMe),
  };
}

function mapAttendancePage(input: unknown): MerchantAttendanceRequestPage {
  const raw = asRecord(input);
  return {
    storeIds: asArray(raw.storeIds).map((id) => toNumberOrString(asString(id))),
    items: asArray(raw.items).map(mapAttendanceRequest),
    page: mapPageMeta(raw.page),
  };
}

function attendancePagePayload(params: MerchantAttendanceRequestPageParams = {}) {
  return compactDeep({
    page: params.page || 1,
    size: params.size || 20,
    storeIds: toNumberOrStringArray(params.storeIds),
    merchantAdminIds: toNumberOrStringArray(params.merchantAdminIds),
    status: params.status,
    requestType: params.requestType,
    from: params.from,
    to: params.to,
  });
}

function mapClockSummary(input: unknown): MerchantClockSummary {
  const raw = asRecord(input);
  return {
    storeId: raw.storeId as number | string | null | undefined,
    date: asString(raw.date),
    totalPunches: asNumber(raw.totalPunches),
    clockInCount: asNumber(raw.clockInCount),
    clockOutCount: asNumber(raw.clockOutCount),
    employeesPunched: asNumber(raw.employeesPunched),
    suspectedProxyCount: asNumber(raw.suspectedProxyCount),
    normalPunchCount: asNumber(raw.normalPunchCount),
    missedPunchBackfillCount: asNumber(raw.missedPunchBackfillCount),
    leavePunchCount: asNumber(raw.leavePunchCount),
    pendingMissedPunchRequests: asNumber(raw.pendingMissedPunchRequests),
  };
}

function mapClockPunch(input: unknown): MerchantClockPunch {
  const raw = asRecord(input);
  return compactDeep({
    id: raw.id as number | string | null | undefined,
    storeId: raw.storeId as number | string | null | undefined,
    storeName: asString(raw.storeName),
    storeCode: asString(raw.storeCode),
    merchantAdminId: raw.merchantAdminId as number | string | null | undefined,
    employee: raw.employee ? mapEmployeeBrief(raw.employee) : undefined,
    publishedCellId: raw.publishedCellId as number | string | null | undefined,
    punchType: asString(raw.punchType) as MerchantClockPunchType,
    punchSource: asString(raw.punchSource) as MerchantClockPunchSource,
    punchedAt: asString(raw.punchedAt),
    createdAt: asString(raw.createdAt),
    deviceType: asString(raw.deviceType),
    deviceId: asString(raw.deviceId),
    latitude: raw.latitude === undefined || raw.latitude === null ? undefined : asNumber(raw.latitude),
    longitude: raw.longitude === undefined || raw.longitude === null ? undefined : asNumber(raw.longitude),
    distanceMeters: raw.distanceMeters === undefined || raw.distanceMeters === null ? undefined : asNumber(raw.distanceMeters),
    withinGeofence: typeof raw.withinGeofence === "boolean" ? raw.withinGeofence : undefined,
    suspectedProxyPunch: typeof raw.suspectedProxyPunch === "boolean" ? raw.suspectedProxyPunch : undefined,
    proxyPunchReason: asString(raw.proxyPunchReason),
    proxyPunchReasons: asArray(raw.proxyPunchReasons).map((item) => asString(item)).filter(Boolean),
    proxySharedDeviceOtherMerchantAdminIds: asArray(raw.proxySharedDeviceOtherMerchantAdminIds)
      .map((id) => {
        const rawId = asString(id).trim();
        return rawId ? toNumberOrString(rawId) : null;
      })
      .filter((id): id is number | string => id !== null),
    proxySharedDeviceEmployees: asArray(raw.proxySharedDeviceEmployees).map(mapEmployeeBrief),
    attendanceRequestId: raw.attendanceRequestId as number | string | null | undefined,
    attendanceLeaveItemId: raw.attendanceLeaveItemId as number | string | null | undefined,
    refType: asString(raw.refType),
    refId: raw.refId as number | string | null | undefined,
    syncEffect: asString(raw.syncEffect),
    customerName: asString(raw.customerName),
  });
}

function clockQueryPayload(params: MerchantClockPunchQueryParams | MerchantClockAnomalyPageParams) {
  return compactDeep({
    from: params.from,
    to: params.to,
    storeIds: toNumberOrStringArray(params.storeIds),
    merchantAdminIds: toNumberOrStringArray(params.merchantAdminIds),
    merchantAdminId: params.merchantAdminId === undefined ? undefined : toNumberOrString(asString(params.merchantAdminId)),
    punchType: params.punchType,
    punchSource: params.punchSource,
    proxyPunchSuspected: params.proxyPunchSuspected,
    page: "page" in params ? params.page : undefined,
    size: "size" in params ? params.size : undefined,
  });
}

function mapAnomalySummary(input: unknown): MerchantClockAnomalySummary {
  const raw = asRecord(input);
  return {
    totalCount: asNumber(raw.totalCount),
    newDeviceIdCount: asNumber(raw.newDeviceIdCount),
    sharedMerchantDeviceCount: asNumber(raw.sharedMerchantDeviceCount),
  };
}

function mapAnomalyPage(input: unknown): MerchantClockAnomalyPage {
  const raw = asRecord(input);
  return {
    storeIds: asArray(raw.storeIds).map((id) => toNumberOrString(asString(id))),
    from: asString(raw.from),
    to: asString(raw.to),
    summary: mapAnomalySummary(raw.summary),
    items: asArray(raw.items).map(mapClockPunch),
    page: mapPageMeta(raw.page),
  };
}

function mapClockPunchesDay(input: unknown): MerchantClockPunchesDay {
  const raw = asRecord(input);
  return {
    storeIds: asArray(raw.storeIds).map((id) => toNumberOrString(asString(id))),
    from: asString(raw.from),
    to: asString(raw.to),
    punches: asArray(raw.punches).map(mapClockPunch),
  };
}

function employeeStatisticsPayload(params: MerchantEmployeeStatisticsParams = {}) {
  return compactDeep({
    from: params.from,
    to: params.to,
    merchantAdminIds: toNumberOrStringArray(params.merchantAdminIds),
    storeIds: toNumberOrStringArray(params.storeIds),
  });
}

function mapEmployeeStatisticsItem(input: unknown): MerchantEmployeeStatisticsItem {
  const raw = asRecord(input);
  return compactDeep({
    merchantAdminId: raw.merchantAdminId as number | string | null | undefined,
    displayName: asString(raw.displayName || raw.name || raw.adminName),
    plannedWorkHours: asNumber(raw.plannedWorkHours),
    actualWorkHours: asNumber(raw.actualWorkHours),
    leaveRequestCount: asNumber(raw.leaveRequestCount),
    leaveApprovedCount: asNumber(raw.leaveApprovedCount),
    leaveRejectedCount: asNumber(raw.leaveRejectedCount),
    missedPunchRequestCount: asNumber(raw.missedPunchRequestCount),
    missedPunchApprovedCount: asNumber(raw.missedPunchApprovedCount),
    missedPunchRejectedCount: asNumber(raw.missedPunchRejectedCount),
    clockAnomalyCount: asNumber(raw.clockAnomalyCount),
  });
}

function mapEmployeeStatisticsPayload(input: unknown): MerchantEmployeeStatisticsPayload {
  const raw = asRecord(input);
  return {
    storeIds: asArray(raw.storeIds).map((id) => toNumberOrString(asString(id))),
    from: asString(raw.from),
    to: asString(raw.to),
    items: asArray(raw.items).map(mapEmployeeStatisticsItem),
  };
}

function toPositiveMerchantAdminId(value: string | number): number {
  const numeric = Number(String(value).trim());
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new ApiError("Invalid employee id", 400);
  }
  return numeric;
}

function toNumberOrString(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && value.trim() !== "" ? numeric : value;
}

function toOptionalNumberOrString(value: string | undefined | null) {
  const raw = asString(value).trim();
  if (!raw) return null;
  return toNumberOrString(raw);
}

function toNumberOrStringArray(values: Array<number | string> | undefined | null) {
  return (values || [])
    .map((value) => {
      const raw = asString(value).trim();
      return raw ? toNumberOrString(raw) : null;
    })
    .filter((value) => value !== null);
}

function compact<T extends Record<string, unknown>>(payload: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

function compactDeep<T extends Record<string, unknown>>(payload: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => {
      if (value === undefined || value === null || value === "") return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    })
  ) as Partial<T>;
}

function hasStoreIds(params?: { storeIds?: Array<number | string> }) {
  return !!params?.storeIds?.length;
}

function optionalStoreHeader(storeId: string | undefined, params?: { storeIds?: Array<number | string> }) {
  return hasStoreIds(params) ? null : storeId;
}

function employeeStatisticsStoreHeader(storeId: string | undefined, params?: { storeIds?: Array<number | string> }) {
  return hasStoreIds(params) ? "all" : storeId;
}

function employeeDocumentPayload(employee: Employee) {
  if (employee.identityDocumentType === "id") {
    return {
      idDocumentFrontKey: employee.idDocumentFrontKey,
      idDocumentBackKey: employee.idDocumentBackKey,
      visaDocumentKey: undefined,
      passportDocumentKey: undefined,
    };
  }
  if (employee.identityDocumentType === "passport") {
    return {
      idDocumentFrontKey: undefined,
      idDocumentBackKey: undefined,
      visaDocumentKey: employee.visaDocumentKey,
      passportDocumentKey: employee.passportDocumentKey,
    };
  }
  return {
    idDocumentFrontKey: undefined,
    idDocumentBackKey: undefined,
    visaDocumentKey: undefined,
    passportDocumentKey: undefined,
  };
}

function uploadMerchantFile(path: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiRequest<MerchantUploadResult>(path, {
    method: "POST",
    body: formData,
  });
}

function normalizeWorkDayState(state: unknown): WorkDayPattern["state"] {
  if (state === true || state === "true" || state === "on" || state === 1 || state === "1") return "on";
  if (state === false || state === "false" || state === "off" || state === 0 || state === "0") return "off";
  return "none";
}

function normalizeWeeklyWorkDayState(state: unknown): "on" | "off" {
  return normalizeWorkDayState(state) === "on" ? "on" : "off";
}

function normalizeTime(value: unknown) {
  const raw = asString(value).trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "";
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return "";
  if (hours < 0 || hours > 24 || minutes < 0 || minutes > 59 || (hours === 24 && minutes > 0)) return "";
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function timeToMinutes(value: unknown) {
  const normalized = normalizeTime(value);
  if (!normalized) return 0;
  const [hours, minutes] = normalized.split(":").map(Number);
  return hours * 60 + minutes;
}

function calcHoursFromSlots(slots: TimeSlot[]) {
  return slots.reduce((total, slot) => {
    const diff = timeToMinutes(slot.end) - timeToMinutes(slot.start);
    return total + (diff > 0 ? diff / 60 : 0);
  }, 0);
}

function mapWorkDayPattern(pattern: unknown): WorkDayPattern[] | undefined {
  if (!Array.isArray(pattern)) return undefined;
  return pattern.map((item) => {
    const row = asRecord(item);
    const timeSlots = asArray(row.timeSlots || row.slots || row.weeklyWorkSlots)
      .map((slot) => {
        const slotRow = asRecord(slot);
        return {
          id: slotRow.id as string | number | null | undefined,
          start: normalizeTime(slotRow.start || slotRow.startTime),
          end: normalizeTime(slotRow.end || slotRow.endTime),
        };
      })
      .filter((slot) => slot.start && slot.end && timeToMinutes(slot.end) > timeToMinutes(slot.start));
    return {
      dayIndex: asNumber(row.dayIndex),
      state: normalizeWorkDayState(row.state),
      hours: row.hours === undefined ? calcHoursFromSlots(timeSlots) : asNumber(row.hours),
      timeSlots,
    };
  });
}

function serializeWorkDayPattern(pattern: WorkDayPattern[] | undefined) {
  return pattern?.map((item) => ({
    dayIndex: item.dayIndex,
    state: item.state === "on" ? true : item.state === "off" ? false : "none",
    hours: item.hours,
  }));
}

function mapEmployeeWeeklyWorkSlots(input: unknown) {
  return asArray(input)
    .map((item) => {
      const row = asRecord(item);
      return {
        id: row.id as string | number | null | undefined,
        weekday: asNumber(row.weekday),
        startTime: normalizeTime(row.startTime),
        endTime: normalizeTime(row.endTime),
      };
    })
    .filter((item) =>
      item.weekday >= 0 &&
      item.weekday <= 6 &&
      item.startTime &&
      item.endTime &&
      timeToMinutes(item.endTime) > timeToMinutes(item.startTime)
    );
}

function mapEmployeeWeeklyWorkDays(input: unknown) {
  return asArray(input)
    .map((item) => {
      const row = asRecord(item);
      return {
        weekday: asNumber(row.weekday),
        state: normalizeWeeklyWorkDayState(row.state),
      };
    })
    .filter((item) => item.weekday >= 0 && item.weekday <= 6);
}

function buildWorkDayPatternFromWeekly(inputDays: unknown, inputSlots: unknown): WorkDayPattern[] | undefined {
  const days = mapEmployeeWeeklyWorkDays(inputDays);
  const slots = mapEmployeeWeeklyWorkSlots(inputSlots);
  if (days.length === 0 && slots.length === 0) return undefined;

  return Array.from({ length: 7 }, (_, dayIndex) => {
    const matchingSlots = slots
      .filter((slot) => slot.weekday === dayIndex)
      .map((slot) => ({
        id: slot.id,
        start: slot.startTime,
        end: slot.endTime,
      }));
    const day = days.find((item) => item.weekday === dayIndex);
    const hasSlots = matchingSlots.length > 0;
    const state = day?.state ?? (hasSlots ? "on" : "off");

    return {
      dayIndex,
      state,
      hours: state === "on" ? calcHoursFromSlots(matchingSlots) : 0,
      timeSlots: state === "on" ? matchingSlots : [],
    };
  });
}

function serializeEmployeeWeeklyWorkDays(pattern: WorkDayPattern[] | undefined) {
  return pattern?.map((item) => ({
    weekday: item.dayIndex,
    state: item.state === "on" ? "on" : "off",
  }));
}

function serializeEmployeeWeeklyWorkSlots(pattern: WorkDayPattern[] | undefined) {
  return pattern
    ?.flatMap((item) =>
      item.state === "on"
        ? (item.timeSlots || []).map((slot) =>
            compact({
              id: slot.id === "" ? undefined : slot.id,
              weekday: item.dayIndex,
              startTime: normalizeTime(slot.start),
              endTime: normalizeTime(slot.end),
            })
          )
        : []
    )
    .filter((slot) => {
      const row = asRecord(slot);
      return row.startTime && row.endTime && timeToMinutes(row.endTime) > timeToMinutes(row.startTime);
    });
}

function normalizeCountry(country: unknown) {
  return asString(country, "nz").trim().toLowerCase() || "nz";
}

function mapStoreWeekdayHours(input: unknown): StoreWeekdayHours[] | undefined {
  const weeklyHours = asArray(input)
    .map((item) => {
      const row = asRecord(item);
      const weekday = asNumber(row.weekday);
      if (weekday < 1 || weekday > 7) return null;

      const openTime = asString(row.openTime).trim();
      const closeTime = asString(row.closeTime).trim();
      const closed = asBoolean(row.closed ?? row.close, false);

      return compact({
        weekday,
        closed,
        openTime: openTime || undefined,
        closeTime: closeTime || undefined,
      }) as StoreWeekdayHours;
    })
    .filter((item): item is StoreWeekdayHours => !!item)
    .sort((a, b) => a.weekday - b.weekday);

  return weeklyHours.length > 0 ? weeklyHours : undefined;
}

function serializeStoreWeekdayHours(weeklyHours: StoreWeekdayHours[] | undefined) {
  return weeklyHours
    ?.map((item) => {
      const closed = item.closed === true;
      return compact({
        weekday: item.weekday,
        closed,
        openTime: closed ? undefined : item.openTime,
        closeTime: closed ? undefined : item.closeTime,
      });
    })
    .filter((item) => typeof item.weekday === "number");
}

function normalizeDateString(value: unknown) {
  const raw = asString(value).trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] || "";
}

function mapPublicHolidays(input: unknown): PublicHoliday[] | undefined {
  const holidays = asArray(input)
    .map((item) => {
      if (typeof item === "string") {
        const date = normalizeDateString(item);
        return date ? { date, name: "" } : null;
      }

      const row = asRecord(item);
      const date = normalizeDateString(
        row.date ||
        row.holidayDate ||
        row.publicHolidayDate ||
        row.day
      );
      if (!date) return null;

      return compact({
        id: row.id as string | number | null | undefined,
        date,
        name: asString(row.name || row.holidayName || row.title),
      }) as PublicHoliday;
    })
    .filter((item): item is PublicHoliday => !!item)
    .sort((a, b) => a.date.localeCompare(b.date));

  return holidays.length > 0 ? holidays : undefined;
}

function serializePublicHolidays(publicHolidays: PublicHoliday[] | undefined) {
  return publicHolidays
    ?.map((item) => {
      const date = normalizeDateString(item.date);
      if (!date) return null;
      const name = item.name?.trim() || date;

      return compact({
        holidayDate: date,
        name,
      });
    })
    .filter((item): item is NonNullable<typeof item> => !!item);
}

function asBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  const normalized = asString(value).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return fallback;
}

function extractAvailableFlag(payload: unknown, fallback = true) {
  const raw = asRecord(payload);
  if ("available" in raw) return asBoolean(raw.available, fallback);
  const nested = asRecord(raw.data);
  if ("available" in nested) return asBoolean(nested.available, fallback);
  return fallback;
}

function normalizeEmployeeContractType(value: unknown) {
  const raw = asString(value).trim().toLowerCase();
  if (raw === "fixed-term") return "fixed_term";
  if (raw === "part-time") return "part_time";
  return raw;
}

function normalizeStatus<T extends string>(status: unknown, enabled: T, disabled: T): T {
  const value = asString(status, enabled).trim().toLowerCase();
  if (["0", "false", disabled.toLowerCase()].includes(value)) return disabled;
  return enabled;
}

function mapStoreOfficerBrief(input: unknown): StoreOfficerBrief | null {
  const raw = asRecord(input);
  const id = asString(raw.id);
  if (!id) return null;
  return {
    id,
    name: asString(raw.name || raw.fullName || raw.displayName),
  };
}

function getStoreOfficerIds(store: Store) {
  const managerId =
    store.managerId ||
    store.storeOfficers?.storeManager?.id ||
    "";
  const assistantManagerIds =
    store.assistantManagerIds?.length
      ? store.assistantManagerIds
      : (store.storeOfficers?.deputyManagers || []).map((item) => item.id).filter(Boolean);

  return {
    managerId,
    assistantManagerIds: Array.from(new Set(assistantManagerIds.filter((id) => id && id !== managerId))),
  };
}

export function isBackendId(id: string | undefined | null) {
  return !!id && /^\d+$/.test(String(id));
}

export function mapApiStore(input: unknown): Store {
  const raw = asRecord(input);
  const weeklyHours = mapStoreWeekdayHours(raw.weeklyHours);
  const publicHolidays = mapPublicHolidays(
    raw.publicHolidays ||
    raw.holidays ||
    raw.storePublicHolidays ||
    raw.publicHolidayDates
  );
  const firstBusinessDay = weeklyHours?.find((item) => !item.closed && item.openTime && item.closeTime);
  const rawStoreOfficers = asRecord(raw.storeOfficers);
  const storeManager = mapStoreOfficerBrief(rawStoreOfficers.storeManager);
  const deputyManagers = asArray(rawStoreOfficers.deputyManagers)
    .map(mapStoreOfficerBrief)
    .filter((item): item is StoreOfficerBrief => !!item);
  const managerId = asString(raw.managerId || raw.storeManagerEmployeeId || storeManager?.id);
  const assistantManagerIds = asArray(raw.assistantManagerIds || raw.deputyManagerEmployeeIds)
    .map((id) => asString(id))
    .filter(Boolean);
  const normalizedAssistantManagerIds = assistantManagerIds.length > 0
    ? assistantManagerIds
    : deputyManagers.map((item) => item.id);

  return {
    id: asString(raw.id),
    name: asString(raw.name),
    code: asString(raw.code),
    address: asString(raw.address),
    city: asString(raw.city),
    country: normalizeCountry(raw.country),
    phone: asString(raw.phone),
    email: asString(raw.email),
    manager: asString(raw.manager),
    openTime: asString(raw.openTime, firstBusinessDay?.openTime || "09:00"),
    closeTime: asString(raw.closeTime, firstBusinessDay?.closeTime || "22:00"),
    timezone: asString(raw.timezone, "Pacific/Auckland"),
    status: normalizeStatus(raw.status, "enabled", "disabled"),
    weeklyHours,
    managerId,
    assistantManagerIds: Array.from(new Set(normalizedAssistantManagerIds.filter((id) => id && id !== managerId))),
    storeOfficers: {
      storeManager: storeManager || (managerId ? { id: managerId, name: "" } : null),
      deputyManagers,
    },
    publicHolidays,
    publicHolidayPayRate:
      raw.publicHolidayPayRate === undefined || raw.publicHolidayPayRate === null
        ? undefined
        : asNumber(raw.publicHolidayPayRate),
    syncPublicHolidaysFromSameCountry:
      raw.syncPublicHolidaysFromSameCountry === undefined || raw.syncPublicHolidaysFromSameCountry === null
        ? undefined
        : asBoolean(raw.syncPublicHolidaysFromSameCountry),
    holidayPayMultiplier:
      raw.publicHolidayPayRate === undefined || raw.publicHolidayPayRate === null
        ? raw.holidayPayMultiplier === undefined || raw.holidayPayMultiplier === null
          ? undefined
          : asNumber(raw.holidayPayMultiplier)
        : asNumber(raw.publicHolidayPayRate),
    clockPunchEnabled:
      raw.clockPunchEnabled === undefined || raw.clockPunchEnabled === null
        ? true
        : asBoolean(raw.clockPunchEnabled),
    clockPunchHoursBasis:
      String(raw.clockPunchHoursBasis ?? raw.clock_punch_hours_basis ?? "punch").toLowerCase() === "schedule"
        ? "schedule"
        : "punch",
    blockPublicHolidays:
      raw.blockPublicHolidays === undefined || raw.blockPublicHolidays === null
        ? false
        : asBoolean(raw.blockPublicHolidays),
    latitude: raw.latitude === undefined || raw.latitude === null ? undefined : asNumber(raw.latitude),
    longitude: raw.longitude === undefined || raw.longitude === null ? undefined : asNumber(raw.longitude),
    geofenceRadius: raw.geofenceRadius === undefined || raw.geofenceRadius === null ? undefined : asNumber(raw.geofenceRadius),
  };
}

export function storeToApiPayload(store: Store) {
  const { managerId, assistantManagerIds } = getStoreOfficerIds(store);
  return compact({
    name: store.name,
    code: store.code,
    address: store.address,
    city: store.city,
    country: store.country.toUpperCase(),
    phone: store.phone,
    email: store.email,
    manager: store.manager,
    openTime: store.openTime,
    closeTime: store.closeTime,
    status: store.status,
    weeklyHours: serializeStoreWeekdayHours(store.weeklyHours),
    publicHolidays: serializePublicHolidays(store.publicHolidays),
    publicHolidayPayRate: store.publicHolidayPayRate ?? store.holidayPayMultiplier,
    clockPunchEnabled: store.clockPunchEnabled ?? true,
    clockPunchHoursBasis: store.clockPunchHoursBasis === "schedule" ? "schedule" : "punch",
    blockPublicHolidays: store.blockPublicHolidays ?? false,
    latitude: store.latitude,
    longitude: store.longitude,
    geofenceRadius: store.geofenceRadius,
    storeOfficers: {
      storeManagerEmployeeId: toOptionalNumberOrString(managerId),
      deputyManagerEmployeeIds: assistantManagerIds.map(toNumberOrString),
    },
  });
}

function storeCreateToApiPayload(store: Store) {
  return compact({
    ...storeToApiPayload(store),
    syncPublicHolidaysFromSameCountry: store.syncPublicHolidaysFromSameCountry,
  });
}

function storePatchToApiPayload(store: Store) {
  return compact({
    ...storeToApiPayload(store),
    syncToSameCountryStores: store.syncToSameCountryStores,
  });
}

export function mapApiCountry(input: unknown): CountryOption {
  const raw = asRecord(input);
  return {
    code: asString(raw.code).toLowerCase(),
    nameZh: asString(raw.nameZh),
    nameEn: asString(raw.nameEn),
    dialCode: asString(raw.dialCode),
  };
}

export function mapApiEmployee(input: unknown): Employee {
  const raw = asRecord(input);
  const rawAvatar = asString(raw.avatar);
  const avatarKey = extractUploadKey(
    raw.avatarKey ||
    raw.avatarObjectKey ||
    raw.avatarFileKey ||
    raw.avatarStorageKey ||
    rawAvatar
  );
  const avatarPreviewUrl =
    [
      raw.avatarPreviewUrl,
      raw.avatarUrl,
      raw.avatarDownloadUrl,
      raw.avatarFileUrl,
      rawAvatar,
    ]
      .map((value) => asString(value))
      .find((value) => isHttpUrl(value)) || "";
  const rawStoreIds = asArray(raw.storeIds).map((id) => asString(id));
  const storeDetails = asArray(raw.storeDetails)
    .map((item) => {
      const record = asRecord(item);
      const merchantName = asString(record.merchantName || record.merchant_name);
      const storeName = asString(record.name || record.storeName);
      return {
        id: asString(record.id),
        name: merchantName ? `${merchantName} / ${storeName}` : storeName,
      };
    })
    .filter((item) => item.id);
  const storeIds = rawStoreIds.length > 0 ? rawStoreIds : storeDetails.map((item) => item.id);
  const assignedStores = asArray(raw.assignedStores)
    .map((item) => {
      const record = asRecord(item);
      return asString(record.id || record.storeId || item);
    })
    .filter(Boolean);
  const weeklyWorkDays = mapEmployeeWeeklyWorkDays(raw.weeklyWorkDays);
  const weeklyWorkSlots = mapEmployeeWeeklyWorkSlots(raw.weeklyWorkSlots);
  const workDayPattern =
    buildWorkDayPatternFromWeekly(raw.weeklyWorkDays, raw.weeklyWorkSlots) ??
    mapWorkDayPattern(raw.workDayPattern);

  return {
    id: asString(raw.id),
    firstName: asString(raw.firstName),
    lastName: asString(raw.lastName),
    employeeId: asString(raw.employeeId),
    role: asString(raw.role, "staff"),
    phone: asString(raw.phone),
    email: asString(raw.email),
    status: normalizeStatus(raw.status, "active", "inactive"),
    startDate: asString(raw.startDate),
    storeIds,
    storeDetails,
    assignedStores: assignedStores.length > 0
      ? assignedStores
      : storeDetails.length > 0
      ? storeDetails.map((item) => item.id)
      : storeIds,
    hourlyRate: asNumber(raw.hourlyRate),
    notes: asString(raw.notes),
    avatar: avatarKey,
    avatarPreviewUrl,
    employeeColor: asString(raw.employeeColor, "#60a5fa"),
    address: asString(raw.address),
    dateOfBirth: asString(raw.dateOfBirth),
    emergencyContact: asString(raw.emergencyContact),
    emergencyContactPhone: asString(raw.emergencyContactPhone),
    gender: asString(raw.gender),
    maritalStatus: asString(raw.maritalStatus),
    identityDocumentType: asString(raw.identityDocumentType),
    identityDocumentNumber: asString(raw.identityDocumentNumber),
    idDocumentFrontKey: asString(raw.idDocumentFrontKey),
    idDocumentFrontUrl: asString(raw.idDocumentFrontUrl),
    idDocumentBackKey: asString(raw.idDocumentBackKey),
    idDocumentBackUrl: asString(raw.idDocumentBackUrl),
    visaDocumentKey: asString(raw.visaDocumentKey),
    visaDocumentUrl: asString(raw.visaDocumentUrl),
    passportDocumentKey: asString(raw.passportDocumentKey),
    passportDocumentUrl: asString(raw.passportDocumentUrl),
    visaType: asString(raw.visaType),
    visaExpiryDate: asString(raw.visaExpiryDate),
    irdNumber: asString(raw.irdNumber),
    taxCode: asString(raw.taxCode),
    kiwiSaverStatus: asString(raw.kiwiSaverStatus),
    employeeContributionRate: asString(raw.employeeContributionRate),
    employerContributionRate: asString(raw.employerContributionRate),
    esctRate: asString(raw.esctRate),
    bankAccountNumber: asString(raw.bankAccountNumber),
    payrollEmployeeId: asString(raw.payrollEmployeeId),
    ks1DocumentKey: asString(raw.ks1DocumentKey),
    ks1DocumentUrl: asString(raw.ks1DocumentUrl),
    ir330DocumentKey: asString(raw.ir330DocumentKey),
    ir330DocumentUrl: asString(raw.ir330DocumentUrl),
    areaIds: asArray(raw.areaIds).map((id) => asString(id)),
    positionIds: asArray(raw.positionIds).map((id) => asString(id)),
    paidHoursPerDay: raw.paidHoursPerDay === undefined ? undefined : asNumber(raw.paidHoursPerDay),
    workDayPattern,
    weeklyWorkDays,
    weeklyWorkSlots,
    contractType: normalizeEmployeeContractType(raw.contractType),
    contractDocumentKey: asString(raw.contractDocumentKey),
    endDate: asString(raw.endDate),
    contractedHours: asString(raw.contractedHours),
    annualSalary: asString(raw.annualSalary),
    defaultHourlyRate: asString(raw.defaultHourlyRate),
    contractDocumentUrl: asString(raw.contractDocumentUrl),
  };
}

export function employeeToApiPayload(employee: Employee & { password?: string }, includePassword: boolean) {
  const documentPayload = employeeDocumentPayload(employee);

  return compact({
    firstName: employee.firstName,
    lastName: employee.lastName,
    employeeId: employee.employeeId,
    role: employee.role,
    phone: employee.phone,
    email: employee.email,
    password: includePassword ? employee.password : employee.password || undefined,
    status: employee.status,
    startDate: employee.startDate,
    storeIds: (employee.storeIds || []).map(toNumberOrString),
    hourlyRate: employee.hourlyRate,
    notes: employee.notes,
    avatar: extractUploadKey(employee.avatar),
    employeeColor: employee.employeeColor,
    address: employee.address,
    dateOfBirth: employee.dateOfBirth,
    emergencyContact: employee.emergencyContact,
    emergencyContactPhone: employee.emergencyContactPhone,
    gender: employee.gender,
    maritalStatus: employee.maritalStatus,
    identityDocumentType: employee.identityDocumentType,
    identityDocumentNumber: employee.identityDocumentNumber,
    idDocumentFrontKey: documentPayload.idDocumentFrontKey,
    idDocumentBackKey: documentPayload.idDocumentBackKey,
    visaDocumentKey: documentPayload.visaDocumentKey,
    passportDocumentKey: documentPayload.passportDocumentKey,
    visaType: employee.identityDocumentType === "passport" ? employee.visaType : undefined,
    visaExpiryDate: employee.identityDocumentType === "passport" ? employee.visaExpiryDate : undefined,
    irdNumber: employee.irdNumber,
    taxCode: employee.taxCode,
    kiwiSaverStatus: employee.kiwiSaverStatus,
    employeeContributionRate: employee.employeeContributionRate,
    employerContributionRate: employee.employerContributionRate,
    esctRate: employee.esctRate,
    bankAccountNumber: employee.bankAccountNumber,
    payrollEmployeeId: employee.payrollEmployeeId,
    ks1DocumentKey: employee.ks1DocumentKey,
    ir330DocumentKey: employee.ir330DocumentKey,
    areaIds: employee.areaIds,
    positionIds: employee.positionIds,
    paidHoursPerDay: employee.paidHoursPerDay,
    workDayPattern: serializeWorkDayPattern(employee.workDayPattern),
    weeklyWorkDays: serializeEmployeeWeeklyWorkDays(employee.workDayPattern),
    weeklyWorkSlots: serializeEmployeeWeeklyWorkSlots(employee.workDayPattern),
    contractType: normalizeEmployeeContractType(employee.contractType),
    contractDocumentKey: employee.contractDocumentKey,
    endDate: employee.endDate,
    contractedHours: employee.contractedHours,
    annualSalary: employee.annualSalary,
    defaultHourlyRate: employee.defaultHourlyRate,
  });
}

export function mapApiArea(input: unknown): Area {
  const raw = asRecord(input);
  const storeId = asString(raw.storeId);
  const areaType = raw.scope === 0 || storeId === "all" ? "general" : "store";
  return {
    id: asString(raw.id),
    name: asString(raw.name),
    color: asString(raw.color, "blue"),
    storeId: areaType === "general" ? "" : storeId,
    areaType,
    order: asNumber(raw.order),
  };
}

export function areaToApiPayload(area: Area) {
  return compact({
    name: area.name,
    color: area.color,
    order: area.order,
    storeId: (area.areaType || "store") === "general" ? "all" : area.storeId,
  });
}

export function mapApiGlobalShift(raw: RawGlobalShift): ScheduleShift {
  const storeId = asString(raw?.storeId);
  const isGeneral = raw?.scope === 0 || storeId === "all";
  return {
    id: `global-${asString(raw?.id)}`,
    shiftId: asString(raw?.id),
    isGlobalPreset: true,
    employeeId: "",
    employeeIds: [],
    areaId: "",
    storeId: isGeneral ? "" : storeId,
    shiftType: isGeneral ? "general" : "store",
    date: "",
    startTime: asString(raw?.startTime, "09:00"),
    endTime: asString(raw?.endTime, "17:00"),
    breakMinutes: asNumber(raw?.breakMinutes, 0),
    shiftName: asString(raw?.name),
    color: asString(raw?.color, "blue"),
    note: "",
    status: "published",
  };
}

export function globalShiftPayloadFromScheduleShift(shift: Pick<ScheduleShift, "shiftName" | "startTime" | "endTime" | "breakMinutes" | "color" | "storeId" | "shiftType">) {
  return compact({
    name: shift.shiftName,
    startTime: shift.startTime,
    endTime: shift.endTime,
    breakMinutes: shift.breakMinutes,
    color: shift.color,
    storeId: shift.shiftType === "general" ? "all" : shift.storeId,
  });
}

export function mapApiScheduleCell(input: unknown, storeId: string): ScheduleShift {
  const raw = asRecord(input);
  const employeeIds = asArray(raw.employees).map((employee) => asString(asRecord(employee).id));
  const areaId = asString(raw.areaId);
  const date = asString(raw.date_str || raw.dateStr);
  const shiftIdRaw = raw.shiftId ?? raw.shiftsId;
  const shiftId = shiftIdRaw != null && String(shiftIdRaw).trim() !== ""
    ? asString(shiftIdRaw)
    : undefined;

  return {
    id: raw.id
      ? `schedule-${raw.id}`
      : `schedule-${storeId}-${areaId}-${date}-${shiftId || `${asString(raw.startTime)}-${asString(raw.endTime)}`}`,
    shiftId,
    employeeId: employeeIds[0] || "",
    employeeIds,
    areaId,
    storeId,
    shiftType: "store",
    date,
    startTime: asString(raw.startTime, "09:00"),
    endTime: asString(raw.endTime, "17:00"),
    breakMinutes: asNumber(raw.breakMinutes, 0),
    shiftName: asString(raw.shiftsName || raw.shiftsname || raw.shiftName),
    color: asString(raw.color, "blue"),
    note: asString(raw.note),
    status: "draft",
    originType: asString(raw.originType, "draft"),
    substitutionId: raw.substitutionId as number | string | null | undefined,
    isSubstitution: raw.isSubstitution === true || asString(raw.originType) === "substitution",
    substitutionStatus: asString(raw.substitutionStatus),
    originalMerchantAdminId: raw.originalMerchantAdminId as number | string | null | undefined,
    originalDisplayName: asString(raw.originalDisplayName),
  };
}

function mapSchedulePublishResult(input: unknown): MerchantSchedulePublishResult {
  const raw = asRecord(input);
  return {
    conflicts: asArray(raw.conflicts).map((item) => {
      const c = asRecord(item);
      return {
        substitutionId: c.substitutionId as number | string | null | undefined,
        leaveItemId: c.leaveItemId as number | string | null | undefined,
        conflictCode: asString(c.conflictCode),
        message: asString(c.message),
      };
    }),
    orphanedSubstitutions: asArray(raw.orphanedSubstitutions).map((item) => {
      const o = asRecord(item);
      return {
        substitutionId: o.substitutionId as number | string | null | undefined,
        leaveItemId: o.leaveItemId as number | string | null | undefined,
        substituteMerchantAdminId: o.substituteMerchantAdminId as number | string | null | undefined,
      };
    }),
  };
}

export type AttendanceConfirmItem = {
  id?: number | string;
  merchantAdminId: number | string;
  employeeName: string;
  publishedCellId: number | string;
  scheduleDate: string;
  areaId?: number | string;
  areaName: string;
  shiftName: string;
  plannedStartTime: string;
  plannedEndTime: string;
  plannedBreakMinutes: number;
  plannedNetMinutes: number;
  attended: number;
  confirmedStartTime: string;
  confirmedEndTime: string;
  confirmedBreakMinutes: number;
  confirmedNetMinutes: number;
  status: string;
  note?: string;
};

export type AttendanceConfirmWeek = {
  storeId?: number | string;
  clockPunchEnabled: boolean;
  weekStart: string;
  weekEnd: string;
  editable: boolean;
  allConfirmed: boolean;
  items: AttendanceConfirmItem[];
};

function mapAttendanceConfirmItem(input: unknown): AttendanceConfirmItem {
  const raw = asRecord(input);
  return {
    id: raw.id as number | string | undefined,
    merchantAdminId: (raw.merchantAdminId ?? raw.merchant_admin_id) as number | string,
    employeeName: asString(raw.employeeName || raw.employee_name),
    publishedCellId: (raw.publishedCellId ?? raw.published_cell_id) as number | string,
    scheduleDate: asString(raw.scheduleDate || raw.schedule_date).slice(0, 10),
    areaId: (raw.areaId ?? raw.area_id) as number | string | undefined,
    areaName: asString(raw.areaName || raw.area_name),
    shiftName: asString(raw.shiftName || raw.shift_name),
    plannedStartTime: asString(raw.plannedStartTime || raw.planned_start_time, "09:00"),
    plannedEndTime: asString(raw.plannedEndTime || raw.planned_end_time, "17:00"),
    plannedBreakMinutes: asNumber(raw.plannedBreakMinutes ?? raw.planned_break_minutes, 0),
    plannedNetMinutes: asNumber(raw.plannedNetMinutes ?? raw.planned_net_minutes, 0),
    attended: asNumber(raw.attended, 1),
    confirmedStartTime: asString(raw.confirmedStartTime || raw.confirmed_start_time, "09:00"),
    confirmedEndTime: asString(raw.confirmedEndTime || raw.confirmed_end_time, "17:00"),
    confirmedBreakMinutes: asNumber(raw.confirmedBreakMinutes ?? raw.confirmed_break_minutes, 0),
    confirmedNetMinutes: asNumber(raw.confirmedNetMinutes ?? raw.confirmed_net_minutes, 0),
    status: asString(raw.status, "draft"),
    note: asString(raw.note) || undefined,
  };
}

function mapAttendanceConfirmWeek(input: unknown): AttendanceConfirmWeek {
  const raw = asRecord(input);
  return {
    storeId: raw.storeId as number | string | undefined,
    clockPunchEnabled: asBoolean(raw.clockPunchEnabled ?? raw.clock_punch_enabled, true),
    weekStart: asString(raw.weekStart || raw.week_start).slice(0, 10),
    weekEnd: asString(raw.weekEnd || raw.week_end).slice(0, 10),
    editable: raw.editable === true,
    allConfirmed: raw.allConfirmed === true || raw.all_confirmed === true,
    items: asArray(raw.items).map(mapAttendanceConfirmItem),
  };
}

function mapTemplateCell(input: unknown): RosterTemplateCell {
  const raw = asRecord(input);
  const employeeIds = asArray(raw.employees).map((employee) => asString(asRecord(employee).id));
  const rawCycleWeek = raw.cycleWeek === undefined || raw.cycleWeek === null
    ? undefined
    : Math.max(1, asNumber(raw.cycleWeek, 1));
  const weekDayIndex = ((asNumber(raw.weekDay, 1) - 1) % 7 + 7) % 7;
  const rawDayIndex = raw.dayIndex === undefined || raw.dayIndex === null
    ? ((rawCycleWeek || 1) - 1) * 7 + weekDayIndex
    : asNumber(raw.dayIndex);
  const dayIndex = Math.max(0, rawDayIndex);
  const cycleWeek = rawCycleWeek || Math.floor(dayIndex / 7) + 1;

  return {
    id: asString(raw.id),
    shiftId: (() => {
      const rawId = raw.shiftsId ?? raw.shiftId;
      if (rawId == null || String(rawId).trim() === "") return undefined;
      return asString(rawId);
    })(),
    areaId: asString(raw.areaId),
    dayIndex,
    cycleWeek,
    startTime: asString(raw.startTime, "09:00"),
    endTime: asString(raw.endTime, "17:00"),
    breakMinutes: asNumber(
      raw.breakMinutes ?? raw.shiftBreakMinutes ?? raw.shift_break_minutes,
      0,
    ),
    employeeIds,
    color: asString(raw.color, "blue"),
    label: asString(raw.shiftsName || raw.shiftName),
  };
}

export function mapApiRosterTemplate(input: unknown): RosterTemplate {
  const raw = asRecord(input);
  const areas = asArray(raw.areas).map(asRecord);
  const cells = asArray(raw.cells).map(mapTemplateCell);
  const employeeIds = Array.from(
    new Set(cells.flatMap((cell) => cell.employeeIds || [])),
  );
  return {
    id: asString(raw.id),
    name: asString(raw.name),
    storeId: raw.storeId === null || raw.storeId === undefined ? "" : asString(raw.storeId),
    totalDays: asNumber(raw.totalDays, 7),
    status: raw.status === 0 ? "disabled" : "enabled",
    employeeIds,
    areaIds: areas
      .slice()
      .sort((a, b) => asNumber(a.orderSort) - asNumber(b.orderSort))
      .map((area) => asString(area.id))
      .filter(Boolean),
    cells,
  };
}

function mapApiFieldJobAssignment(input: unknown): FieldServiceJobAssignment | null {
  const raw = asRecord(input);
  if (!raw.id && !raw.jobId && !raw.merchantAdminId) return null;
  return {
    id: asString(raw.id) || undefined,
    jobId: asString(raw.jobId || raw.job_id),
    merchantAdminId: asString(raw.merchantAdminId || raw.merchant_admin_id),
    employeeName: asString(raw.employeeName || raw.employee_name) || undefined,
    linkedStoreShiftId: asString(raw.linkedStoreShiftId || raw.linked_store_shift_id) || null,
    syncStoreClockIn: raw.syncStoreClockIn === true || raw.sync_store_clock_in === true,
    syncStoreClockOut: raw.syncStoreClockOut === true || raw.sync_store_clock_out === true,
    assignedAt: asString(raw.assignedAt || raw.assigned_at) || undefined,
    assignedBy: asString(raw.assignedBy || raw.assigned_by) || undefined,
  };
}

function mapApiFieldJob(input: unknown): FieldServiceJob {
  const raw = asRecord(input);
  const assignments = Array.isArray(raw.assignments)
    ? raw.assignments.map(mapApiFieldJobAssignment).filter(Boolean) as FieldServiceJobAssignment[]
    : mapApiFieldJobAssignment(raw.assignment)
      ? [mapApiFieldJobAssignment(raw.assignment) as FieldServiceJobAssignment]
      : [];
  const assignment = assignments[0] ?? null;

  return {
    id: asString(raw.id),
    merchantId: asString(raw.merchantId || raw.merchant_id) || undefined,
    storeId: asString(raw.storeId || raw.store_id),
    storeName: asString(raw.storeName || raw.store_name) || undefined,
    customerName: asString(raw.customerName || raw.customer_name),
    customerPhone: asString(raw.customerPhone || raw.customer_phone),
    serviceAddress: asString(raw.serviceAddress || raw.service_address),
    latitude: asNumber(raw.latitude),
    longitude: asNumber(raw.longitude),
    geofenceRadius: asNumber(raw.geofenceRadius ?? raw.geofence_radius, 100),
    scheduledStart: asString(raw.scheduledStart || raw.scheduled_start),
    scheduledEnd: asString(raw.scheduledEnd || raw.scheduled_end),
    serviceType: asString(raw.serviceType || raw.service_type),
    status: (asString(raw.status, "pending") as FieldServiceJob["status"]),
    notes: asString(raw.notes) || undefined,
    assignment,
    assignments,
    createdAt: asString(raw.createdAt || raw.created_at) || undefined,
    updatedAt: asString(raw.updatedAt || raw.updated_at) || undefined,
  };
}

function mapApiFieldJobAssignPreview(input: unknown): FieldJobAssignPreview {
  const raw = asRecord(input);
  const shiftRaw = asRecord(raw.storeShift || raw.store_shift);
  const hasStoreShift = raw.hasStoreShift === true || raw.has_store_shift === true || !!shiftRaw.id;
  const storeShift = hasStoreShift && shiftRaw.id
    ? {
        id: asString(shiftRaw.id),
        storeId: asString(shiftRaw.storeId || shiftRaw.store_id),
        storeName: asString(shiftRaw.storeName || shiftRaw.store_name),
        date: asString(shiftRaw.date),
        start: asString(shiftRaw.start),
        end: asString(shiftRaw.end),
        startTime: asString(shiftRaw.startTime || shiftRaw.start_time),
        endTime: asString(shiftRaw.endTime || shiftRaw.end_time),
      }
    : null;

  return {
    hasStoreShift,
    storeShift,
    overlap: raw.overlap === true,
    suggestedSyncStoreClockIn:
      raw.suggestedSyncStoreClockIn === true || raw.suggested_sync_store_clock_in === true,
    suggestedSyncStoreClockOut:
      raw.suggestedSyncStoreClockOut === true || raw.suggested_sync_store_clock_out === true,
    validationWarnings: asArray(raw.validationWarnings || raw.validation_warnings).map((item) => asString(item)).filter(Boolean),
  };
}

function fieldJobToApiPayload(payload: Partial<FieldJobUpsertPayload>) {
  const scheduledStart = payload.scheduledStart;
  const scheduledEnd = payload.scheduledEnd;
  return compactDeep({
    storeId: payload.storeId,
    customerName: payload.customerName,
    customerPhone: payload.customerPhone,
    serviceAddress: payload.serviceAddress,
    latitude: payload.latitude,
    longitude: payload.longitude,
    geofenceRadius: payload.geofenceRadius,
    scheduledStart,
    scheduledEnd,
    scheduled_start: scheduledStart,
    scheduled_end: scheduledEnd,
    serviceType: payload.serviceType,
    service_type: payload.serviceType,
    notes: payload.notes,
  });
}

export const merchantApi = {
  login: (email: string, password: string) =>
    apiRequest<MerchantLoginResult>("/api/v1/merchant/auth/login", {
      method: "POST",
      auth: false,
      body: { email, password },
    }),
  activate: (token: string, newPassword: string) =>
    apiRequest<null>("/api/v1/merchant/auth/activate", {
      method: "POST",
      auth: false,
      body: { token, newPassword },
    }),
  getActivationEmail: (token: string) =>
    apiRequest<MerchantActivationEmail>("/api/v1/merchant/auth/activation-email", {
      auth: false,
      query: { token },
    }),
  logout: () =>
    apiRequest<null>("/api/v1/merchant/auth/logout", {
      method: "POST",
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiRequest<null>("/api/v1/merchant/auth/password", {
      method: "PUT",
      body: { currentPassword, newPassword },
    }),
  forgotPassword: (email: string) =>
    apiRequest<null>("/api/v1/merchant/auth/forgot-password", {
      method: "POST",
      auth: false,
      body: { email },
    }),
  getPasswordResetEmail: (token: string) =>
    apiRequest<MerchantActivationEmail>("/api/v1/merchant/auth/password-reset-email", {
      auth: false,
      query: { token },
    }),
  resetPassword: (token: string, newPassword: string) =>
    apiRequest<null>("/api/v1/merchant/auth/reset-password", {
      method: "POST",
      auth: false,
      body: { token, newPassword },
    }),
  merchantMe: async () => mapMerchantPrincipal(await apiRequest<unknown>("/api/v1/merchant/me")),
  authMe: async () => mapMerchantPrincipal(await apiRequest<unknown>("/api/v1/merchant/auth/me")),
  getDashboardStatistics: async (storeId: string) => {
    const data = await apiRequest<unknown>("/api/v1/merchant/dashboard/statistics", {
      storeId,
    });
    return mapApiDashboardStatistics(data);
  },
  getTodayAttendance: async (storeId: string, date?: string) => {
    const data = await apiRequest<unknown>("/api/v1/merchant/dashboard/today-attendance", {
      storeId,
      query: date ? { date } : undefined,
    });
    return mapApiTodayAttendance(data);
  },
  updateLastStore: (storeId: string) => {
    const numericStoreId = Number(storeId);
    return apiRequest<null>("/api/v1/merchant/auth/last-store", {
      method: "PUT",
      body: { storeId: Number.isFinite(numericStoreId) ? numericStoreId : storeId },
    });
  },
  permissionsTree: () =>
    apiRequest<MerchantFeatureTreeNode[]>("/api/v1/merchant/auth/permissions-tree"),
  listCountries: async () => {
    const data = await apiRequest<unknown[]>(getMerchantEndpoint("countries"));
    return (Array.isArray(data) ? data : []).map(mapApiCountry);
  },
  listStores: async () => {
    const data = await apiRequest<{ items?: unknown[] }>(getMerchantEndpoint("stores"));
    return (data?.items || []).map(mapApiStore);
  },
  createStore: async (store: Store) => {
    const data = await apiRequest<unknown>(getMerchantEndpoint("stores"), {
      method: "POST",
      body: storeCreateToApiPayload(store),
    });
    return mapApiStore(data);
  },
  updateStore: async (id: string, store: Store) => {
    const data = await apiRequest<unknown>(appendEndpointPath(getMerchantEndpoint("stores"), id), {
      method: "PATCH",
      body: storePatchToApiPayload(store),
    });
    return mapApiStore(data);
  },
  deleteStore: (id: string) =>
    apiRequest(appendEndpointPath(getMerchantEndpoint("stores"), id), {
      method: "DELETE",
    }),
  listEmployees: async (storeId: string, params: { page?: number; size?: number; status?: string; q?: string } = {}) => {
    const data = await apiRequest<{ items?: unknown[] }>(getMerchantEndpoint("employees"), {
      storeId,
      query: { page: params.page || 1, size: params.size || 100, status: params.status, q: params.q },
    });
    return (data?.items || []).map(mapApiEmployee);
  },
  listEmployeesByStore: async (storeId: string, params: { page?: number; size?: number; status?: string; q?: string } = {}) => {
    const data = await apiRequest<{ items?: unknown[] }>(appendEndpointPath(getMerchantEndpoint("employees"), "by-store"), {
      query: { storeId, page: params.page || 1, size: params.size || 100, status: params.status, q: params.q },
    });
    return (data?.items || []).map(mapApiEmployee);
  },
  listActiveEmployeeBriefs: async (storeIds: Array<number | string>, name?: string) => {
    const data = await apiRequest<unknown[]>(appendEndpointPath(getMerchantEndpoint("employees"), "active-brief"), {
      method: "POST",
      storeId: null,
      body: compactDeep({
        storeIds: toNumberOrStringArray(storeIds),
        name,
      }),
    });
    return (Array.isArray(data) ? data : []).map((item) => {
      const raw = mapEmployeeBrief(item);
      return {
        id: raw.id || raw.merchantAdminId,
        name: raw.name || raw.displayName || "",
      } satisfies MerchantEmployeeIdName;
    });
  },
  getEmployeeStatistics: async (
    storeId: string | undefined,
    params: MerchantEmployeeStatisticsParams = {},
  ) => {
    const data = await apiRequest<unknown>(appendEndpointPath(getMerchantEndpoint("employees"), "statistics"), {
      method: "POST",
      storeId: employeeStatisticsStoreHeader(storeId, params),
      body: employeeStatisticsPayload(params),
    });
    return mapEmployeeStatisticsPayload(data);
  },
  exportEmployeeStatistics: (
    storeId: string | undefined,
    params: MerchantEmployeeStatisticsParams = {},
  ) =>
    apiRequestBlob(appendEndpointPath(getMerchantEndpoint("employees"), "statistics", "export"), {
      method: "POST",
      storeId: employeeStatisticsStoreHeader(storeId, params),
      body: employeeStatisticsPayload(params),
    }),
  createEmployee: async (employee: Employee & { password?: string }) => {
    const data = await apiRequest<unknown>(getMerchantEndpoint("employees"), {
      method: "POST",
      body: employeeToApiPayload(employee, false),
    });
    return mapApiEmployee(data);
  },
  updateEmployee: async (id: string, employee: Employee & { password?: string }) => {
    const data = await apiRequest<unknown>(appendEndpointPath(getMerchantEndpoint("employees"), id), {
      method: "PATCH",
      body: employeeToApiPayload(employee, false),
    });
    return mapApiEmployee(data);
  },
  deleteEmployee: (id: string) =>
    apiRequest(appendEndpointPath(getMerchantEndpoint("employees"), id), {
      method: "DELETE",
    }),
  resetEmployeePassword: (id: string) =>
    apiRequest<null>(appendEndpointPath(getMerchantEndpoint("employees"), id, "reset-password"), {
      method: "POST",
    }),
  checkEmployeeEmailAvailable: async (email: string, excludeId?: string) => {
    const data = await apiRequest<unknown>(appendEndpointPath(getMerchantEndpoint("employees"), "email-available"), {
      query: {
        email,
        excludeId: excludeId && isBackendId(excludeId) ? Number(excludeId) : undefined,
      },
    });
    return extractAvailableFlag(data, true);
  },
  checkEmployeeIdAvailable: async (employeeId: string, excludeId?: string) => {
    const data = await apiRequest<unknown>(appendEndpointPath(getMerchantEndpoint("employees"), "employee-id-available"), {
      query: {
        employeeId,
        excludeId: excludeId && isBackendId(excludeId) ? Number(excludeId) : undefined,
      },
    });
    return extractAvailableFlag(data, true);
  },
  listAreas: async (storeId: string) => {
    const data = await apiRequest<{ items?: unknown[] }>(getMerchantEndpoint("areas"), { storeId });
    return (data?.items || []).map(mapApiArea);
  },
  createArea: async (area: Area, headerStoreId?: string) => {
    const data = await apiRequest<unknown>(getMerchantEndpoint("areas"), {
      method: "POST",
      storeId: headerStoreId,
      body: areaToApiPayload(area),
    });
    return mapApiArea(data);
  },
  updateArea: async (id: string, area: Area) => {
    const data = await apiRequest<unknown>(appendEndpointPath(getMerchantEndpoint("areas"), id), {
      method: "PATCH",
      body: areaToApiPayload(area),
    });
    return mapApiArea(data);
  },
  deleteArea: (id: string) =>
    apiRequest(appendEndpointPath(getMerchantEndpoint("areas"), id), {
      method: "DELETE",
    }),
  listGlobalShifts: async (storeId: string) => {
    const data = await apiRequest<{ items?: RawGlobalShift[] }>(getMerchantEndpoint("globalShifts"), { storeId });
    return (data?.items || []).map(mapApiGlobalShift);
  },
  createGlobalShift: async (shift: Pick<ScheduleShift, "shiftName" | "startTime" | "endTime" | "breakMinutes" | "color" | "storeId" | "shiftType">) => {
    const data = await apiRequest<RawGlobalShift>(getMerchantEndpoint("globalShifts"), {
      method: "POST",
      body: globalShiftPayloadFromScheduleShift(shift),
    });
    return mapApiGlobalShift(data);
  },
  updateGlobalShift: async (id: string, shift: ScheduleShift) => {
    const data = await apiRequest<RawGlobalShift>(appendEndpointPath(getMerchantEndpoint("globalShifts"), id), {
      method: "PATCH",
      body: globalShiftPayloadFromScheduleShift(shift),
    });
    return mapApiGlobalShift(data);
  },
  deleteGlobalShift: (id: string) =>
    apiRequest(appendEndpointPath(getMerchantEndpoint("globalShifts"), id), {
      method: "DELETE",
    }),
  listScheduleTemplates: async (storeId: string) => {
    const data = await apiRequest<{ items?: RawScheduleTemplateListItem[] }>(getMerchantEndpoint("scheduleTemplates"), { storeId });
    return data?.items || [];
  },
  getScheduleTemplate: async (id: string) => {
    const data = await apiRequest<unknown>(appendEndpointPath(getMerchantEndpoint("scheduleTemplates"), id));
    return mapApiRosterTemplate(data);
  },
  createScheduleTemplate: async (storeId: string, payload: unknown) => {
    const data = await apiRequest<unknown>(getMerchantEndpoint("scheduleTemplates"), {
      method: "POST",
      storeId,
      body: payload,
    });
    return mapApiRosterTemplate(data);
  },
  updateScheduleTemplate: async (id: string, payload: unknown) => {
    const data = await apiRequest<unknown>(appendEndpointPath(getMerchantEndpoint("scheduleTemplates"), id), {
      method: "PATCH",
      body: payload,
    });
    return mapApiRosterTemplate(data);
  },
  deleteScheduleTemplate: (id: string) =>
    apiRequest(appendEndpointPath(getMerchantEndpoint("scheduleTemplates"), id), {
      method: "DELETE",
    }),
  getSchedule: async (storeId: string) => {
    const data = await apiRequest<{
      cells?: unknown[];
      employeeDateLeaves?: unknown[];
      employeeShiftLeaves?: unknown[];
    }>(
      getMerchantEndpoint("schedule"),
      { storeId },
    );
    const cells = (data?.cells || []).map((cell) => mapApiScheduleCell(cell, storeId));
    const employeeDateLeaves = asArray(data?.employeeDateLeaves).map((row) => {
      const raw = asRecord(row);
      const leaveDateFrom = normalizeApiLocalDate(
        raw.leaveDateFrom ?? raw.leave_date_from,
      );
      const leaveDateTo = normalizeApiLocalDate(raw.leaveDateTo ?? raw.leave_date_to);
      return compactDeep({
        storeId,
        merchantAdminId:
          (raw.merchantAdminId ?? raw.merchant_admin_id) as number | string | null | undefined,
        displayName: asString(raw.displayName ?? raw.display_name),
        leaveDateFrom,
        leaveDateTo,
        status: asString(raw.status),
        requestId: (raw.requestId ?? raw.request_id) as number | string | null | undefined,
      }) as EmployeeDateLeave & { storeId: string };
    });
    const employeeShiftLeaves = asArray(data?.employeeShiftLeaves).map((row) => {
      const raw = asRecord(row);
      const scheduleDate = normalizeApiLocalDate(raw.scheduleDate ?? raw.schedule_date);
      return compactDeep({
        storeId,
        merchantAdminId:
          (raw.merchantAdminId ?? raw.merchant_admin_id) as number | string | null | undefined,
        displayName: asString(raw.displayName ?? raw.display_name),
        scheduleDate,
        shiftStartTime: asString(raw.shiftStartTime ?? raw.shift_start_time),
        shiftEndTime: asString(raw.shiftEndTime ?? raw.shift_end_time),
        leaveScope: asString(raw.leaveScope ?? raw.leave_scope),
        leaveEffect: asString(raw.leaveEffect ?? raw.leave_effect),
        partialStartTime: asString(raw.partialStartTime ?? raw.partial_start_time),
        partialEndTime: asString(raw.partialEndTime ?? raw.partial_end_time),
        requestId: (raw.requestId ?? raw.request_id) as number | string | null | undefined,
        leaveItemId: (raw.leaveItemId ?? raw.leave_item_id) as number | string | null | undefined,
      }) as EmployeeShiftLeave & { storeId: string };
    });
    return { cells, employeeDateLeaves, employeeShiftLeaves };
  },
  saveScheduleDraft: (storeId: string, payload: unknown) =>
    apiRequest<null>(appendEndpointPath(getMerchantEndpoint("schedule"), "draft"), {
      method: "PUT",
      storeId,
      body: payload,
    }),
  getAttendanceConfirmWeek: async (storeId: string, weekStart: string) => {
    const data = await apiRequest<unknown>(
      appendEndpointPath(getMerchantEndpoint("schedule"), "attendance-confirm"),
      {
        storeId,
        query: { weekStart },
      },
    );
    return mapAttendanceConfirmWeek(data);
  },
  saveAttendanceConfirmWeek: async (
    storeId: string,
    payload: {
      weekStart: string;
      confirm: boolean;
      items: Array<{
        publishedCellId: number;
        merchantAdminId: number;
        attended?: number;
        confirmedStartTime?: string;
        confirmedEndTime?: string;
        confirmedBreakMinutes?: number;
        note?: string;
      }>;
    },
  ) => {
    const data = await apiRequest<unknown>(
      appendEndpointPath(getMerchantEndpoint("schedule"), "attendance-confirm"),
      {
        method: "PUT",
        storeId,
        body: payload,
      },
    );
    return mapAttendanceConfirmWeek(data);
  },
  publishSchedule: async (storeId: string) => {
    const data = await apiRequest<unknown>(appendEndpointPath(getMerchantEndpoint("schedule"), "publish"), {
      method: "POST",
      storeId,
    });
    return mapSchedulePublishResult(data);
  },
  subscribeBilling: (planId: number, quantity: number) =>
    apiRequest<MerchantCheckoutSession>(appendEndpointPath(getMerchantEndpoint("billing"), "subscribe"), {
      method: "POST",
      body: { planId, quantity },
    }),
  addBillingQuantity: (addQuantity: number) =>
    apiRequest<MerchantSubscription>(appendEndpointPath(getMerchantEndpoint("billing"), "add-quantity"), {
      method: "POST",
      body: { addQuantity },
    }),
  getBillingSubscription: () =>
    apiRequest<MerchantSubscription>(appendEndpointPath(getMerchantEndpoint("billing"), "subscription")),
  listBillingInvoices: (params: { limit?: number; startingAfter?: string; status?: string } = {}) =>
    apiRequest<MerchantInvoiceList>(appendEndpointPath(getMerchantEndpoint("billing"), "invoices"), {
      query: params,
    }),
  getAttendanceRequestSummary: async (
    storeId: string,
    params: { requestType?: MerchantAttendanceRequestType | ""; from?: string; to?: string } = {},
  ) => {
    const data = await apiRequest<unknown>(appendEndpointPath(getMerchantEndpoint("attendance"), "requests", "summary"), {
      storeId,
      query: {
        requestType: params.requestType,
        from: params.from,
        to: params.to,
      },
    });
    return mapAttendanceSummary(data);
  },
  listAttendanceRequests: async (
    storeId: string | undefined,
    params: MerchantAttendanceRequestPageParams = {},
  ) => {
    const data = await apiRequest<unknown>(appendEndpointPath(getMerchantEndpoint("attendance"), "requests"), {
      method: "POST",
      storeId: optionalStoreHeader(storeId, params),
      body: attendancePagePayload(params),
    });
    return mapAttendancePage(data);
  },
  getAttendanceRequest: async (id: string | number, storeId: string) => {
    const data = await apiRequest<unknown>(appendEndpointPath(getMerchantEndpoint("attendance"), "requests", id), {
      storeId,
    });
    return mapAttendanceRequest(data);
  },
  listSubstituteCandidates: async (
    storeId: string,
    params: {
      leaveItemId?: string | number;
      scheduleDate?: string;
      startTime?: string;
      endTime?: string;
      excludeMerchantAdminId?: string | number;
    },
  ) => {
    const query = new URLSearchParams();
    if (params.leaveItemId != null) query.set("leaveItemId", String(params.leaveItemId));
    if (params.scheduleDate) query.set("scheduleDate", params.scheduleDate);
    if (params.startTime) query.set("startTime", params.startTime);
    if (params.endTime) query.set("endTime", params.endTime);
    if (params.excludeMerchantAdminId != null) {
      query.set("excludeMerchantAdminId", String(params.excludeMerchantAdminId));
    }
    const qs = query.toString();
    const data = await apiRequest<{ storeId?: number | string; items?: unknown[] }>(
      appendEndpointPath(getMerchantEndpoint("attendance"), "substitute-candidates") + (qs ? `?${qs}` : ""),
      { storeId },
    );
    return (data?.items || []).map((item) => {
      const raw = asRecord(item);
      return {
        id: raw.id as number | string,
        name: asString(raw.name),
      } satisfies MerchantEmployeeIdName;
    });
  },
  reviewAttendanceRequest: async (
    id: string | number,
    storeId: string,
    payload: {
      approved: boolean;
      reviewComment?: string | null;
      substitutions?: LeaveSubstitutionReviewItem[];
      fieldDispositions?: Array<{
        fieldJobId: number;
        action: "cancel" | "reassign";
        assigneeMerchantAdminId?: number | string | null;
      }>;
    },
  ) => {
    const substitutions = (payload.substitutions || [])
      .filter((item) => item.leaveItemId && item.substituteMerchantAdminId)
      .map((item) => compactDeep({
        leaveItemId: toNumberOrString(asString(item.leaveItemId)),
        substituteMerchantAdminId: toNumberOrString(asString(item.substituteMerchantAdminId)),
        substituteStartTime: item.substituteStartTime || undefined,
        substituteEndTime: item.substituteEndTime || undefined,
      }));
    const data = await apiRequest<unknown>(appendEndpointPath(getMerchantEndpoint("attendance"), "requests", id, "review"), {
      method: "POST",
      storeId,
      body: compactDeep({
        approved: payload.approved,
        reviewComment: payload.reviewComment || null,
        substitutions: substitutions.length > 0 ? substitutions : undefined,
        fieldDispositions: (payload.fieldDispositions || []).length > 0 ? payload.fieldDispositions : undefined,
      }),
    });
    return mapAttendanceRequest(data);
  },
  getClockSummary: async (storeId: string, date: string) => {
    const data = await apiRequest<unknown>(appendEndpointPath(getMerchantEndpoint("clock"), "summary"), {
      storeId,
      query: { date },
    });
    return mapClockSummary(data);
  },
  getClockAnomalySummary: async (storeId: string | undefined, params: MerchantClockPunchQueryParams) => {
    const data = await apiRequest<unknown>(appendEndpointPath(getMerchantEndpoint("clock"), "anomalies", "summary"), {
      method: "POST",
      storeId: optionalStoreHeader(storeId, params),
      body: clockQueryPayload(params),
    });
    return mapAnomalySummary(data);
  },
  listClockAnomalies: async (storeId: string | undefined, params: MerchantClockAnomalyPageParams) => {
    const data = await apiRequest<unknown>(appendEndpointPath(getMerchantEndpoint("clock"), "anomalies"), {
      method: "POST",
      storeId: optionalStoreHeader(storeId, params),
      body: clockQueryPayload(params),
    });
    return mapAnomalyPage(data);
  },
  listClockPunches: async (storeId: string | undefined, params: MerchantClockPunchQueryParams) => {
    const data = await apiRequest<unknown>(appendEndpointPath(getMerchantEndpoint("clock"), "punches"), {
      method: "POST",
      storeId: optionalStoreHeader(storeId, params),
      body: clockQueryPayload(params),
    });
    return mapClockPunchesDay(data);
  },
  listFieldJobs: async (storeId: string | undefined, params: FieldJobListParams = {}) => {
    const data = await apiRequest<{ items?: unknown[] }>(getMerchantEndpoint("fieldJobs"), {
      storeId: storeId || undefined,
      query: compactDeep({
        storeId: params.storeId,
        status: params.status || undefined,
        from: params.from,
        to: params.to,
        q: params.q,
        page: params.page || 1,
        size: params.size || 50,
      }),
    });
    return (data?.items || []).map(mapApiFieldJob);
  },
  createFieldJob: async (storeId: string, payload: FieldJobUpsertPayload) => {
    const data = await apiRequest<unknown>(getMerchantEndpoint("fieldJobs"), {
      method: "POST",
      storeId,
      body: fieldJobToApiPayload(payload),
    });
    return mapApiFieldJob(data);
  },
  updateFieldJob: async (storeId: string, id: string, payload: Partial<FieldJobUpsertPayload>) => {
    const data = await apiRequest<unknown>(appendEndpointPath(getMerchantEndpoint("fieldJobs"), id), {
      method: "PATCH",
      storeId,
      body: fieldJobToApiPayload(payload),
    });
    return mapApiFieldJob(data);
  },
  cancelFieldJob: async (storeId: string, id: string) => {
    const data = await apiRequest<unknown>(appendEndpointPath(getMerchantEndpoint("fieldJobs"), id, "cancel"), {
      method: "POST",
      storeId,
    });
    return mapApiFieldJob(data);
  },
  getFieldJobAssignPreview: async (
    storeId: string,
    jobId: string,
    merchantAdminId: string,
  ) => {
    const data = await apiRequest<unknown>(
      appendEndpointPath(getMerchantEndpoint("fieldJobs"), "assign-preview"),
      {
        storeId,
        query: { jobId, merchantAdminId },
      },
    );
    return mapApiFieldJobAssignPreview(data);
  },
  assignFieldJob: async (storeId: string, jobId: string, payload: FieldJobAssignPayload) => {
    const data = await apiRequest<unknown>(appendEndpointPath(getMerchantEndpoint("fieldJobs"), jobId, "assign"), {
      method: "POST",
      storeId,
      body: {
        merchantAdminId: payload.merchantAdminId,
        syncStoreClockIn: payload.syncStoreClockIn,
        syncStoreClockOut: payload.syncStoreClockOut,
      },
    });
    return mapApiFieldJob(data);
  },
  reassignFieldJob: async (storeId: string, jobId: string, payload: FieldJobAssignmentsSyncPayload) => {
    const data = await apiRequest<unknown>(
      appendEndpointPath(getMerchantEndpoint("fieldJobs"), jobId, "reassign"),
      {
        method: "POST",
        storeId,
        body: {
          assignments: payload.assignments.map((item) => ({
            merchantAdminId: toPositiveMerchantAdminId(item.merchantAdminId),
            syncStoreClockIn: item.syncStoreClockIn,
            syncStoreClockOut: item.syncStoreClockOut,
          })),
        },
      },
    );
    return mapApiFieldJob(data);
  },
  syncFieldJobAssignments: async (
    storeId: string,
    jobId: string,
    payload: FieldJobAssignmentsSyncPayload,
  ) => {
    const data = await apiRequest<unknown>(
      appendEndpointPath(getMerchantEndpoint("fieldJobs"), jobId, "assignments", "sync"),
      {
        method: "POST",
        storeId,
        body: {
          assignments: payload.assignments.map((item) => ({
            merchantAdminId: toPositiveMerchantAdminId(item.merchantAdminId),
            syncStoreClockIn: item.syncStoreClockIn,
            syncStoreClockOut: item.syncStoreClockOut,
          })),
        },
      },
    );
    return mapApiFieldJob(data);
  },

  listDutyTemplates: async (storeId: string) => {
    const data = await apiRequest<{ items?: DutyTemplateApi[] }>(
      appendEndpointPath("/api/v1/merchant/stores", storeId, "duty-templates"),
      { storeId },
    );
    return data?.items || [];
  },
  createDutyTemplate: async (
    storeId: string,
    payload: {
      title: string;
      description?: string;
      triggerType: string;
      intervalMinutes?: number;
      required?: boolean;
      assignmentMode?: string;
      sortOrder?: number;
    },
  ) =>
    apiRequest<DutyTemplateApi>(appendEndpointPath("/api/v1/merchant/stores", storeId, "duty-templates"), {
      method: "POST",
      storeId,
      body: { storeId: Number(storeId), ...payload },
    }),
  patchDutyTemplate: async (id: string, payload: Record<string, unknown>) =>
    apiRequest<DutyTemplateApi>(`/api/v1/merchant/duty-templates/${id}`, {
      method: "PATCH",
      body: payload,
    }),
  deleteDutyTemplate: (id: string) =>
    apiRequest(`/api/v1/merchant/duty-templates/${id}`, { method: "DELETE" }),
  replaceDutyFixedAssignees: async (id: string, merchantAdminIds: Array<number | string>) =>
    apiRequest<DutyTemplateApi>(`/api/v1/merchant/duty-templates/${id}/fixed-assignees`, {
      method: "PUT",
      body: { merchantAdminIds: merchantAdminIds.map((x) => Number(x)).filter((n) => n > 0) },
    }),
  listDutyDailyAssignees: async (id: string, date: string) => {
    const data = await apiRequest<{ merchantAdminIds?: number[] }>(
      `/api/v1/merchant/duty-templates/${id}/daily-assignees`,
      { query: { date } },
    );
    return data?.merchantAdminIds || [];
  },
  replaceDutyDailyAssignees: async (id: string, date: string, merchantAdminIds: Array<number | string>) => {
    const data = await apiRequest<{ merchantAdminIds?: number[] }>(
      `/api/v1/merchant/duty-templates/${id}/daily-assignees`,
      {
        method: "PUT",
        query: { date },
        body: { merchantAdminIds: merchantAdminIds.map((x) => Number(x)).filter((n) => n > 0) },
      },
    );
    return data?.merchantAdminIds || [];
  },
  listDutyCompletions: async (storeId: string, date: string) => {
    const data = await apiRequest<{ date?: string; items?: DutyCompletionApi[] }>(
      appendEndpointPath("/api/v1/merchant/stores", storeId, "duties", "completions"),
      { storeId, query: { date } },
    );
    return data?.items || [];
  },

  uploadEmployeeContract: (file: File) =>
    uploadMerchantFile("/api/v1/merchant/uploads/employee-contract", file),
  uploadEmployeeAvatar: (file: File) =>
    uploadMerchantFile("/api/v1/merchant/uploads/employee-avatar", file),
  uploadEmployeeDocument: (kind: EmployeeUploadKind, file: File) =>
    uploadMerchantFile(EMPLOYEE_DOCUMENT_UPLOAD_PATHS[kind], file),
};

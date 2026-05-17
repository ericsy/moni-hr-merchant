import { appendEndpointPath, getMerchantEndpoint } from "../config/merchantEndpoints";
import type {
    Area,
    CountryOption,
    Employee,
    RosterTemplate,
    RosterTemplateCell,
    ScheduleShift,
    Store,
    StoreWeekdayHours,
    TimeSlot,
    WorkDayPattern,
} from "../context/DataContext";
import { apiRequest } from "./apiClient";

export interface MerchantLoginResult {
  accessToken?: string | null;
  expiresIn?: number | null;
  user?: {
    email?: string;
    name?: string;
  };
  status?: string | null;
}

export interface MerchantActivationEmail {
  email?: string | null;
  adminName?: string | null;
}

export interface MerchantPrincipal {
  merchantAdminId?: number;
  merchantId?: number;
  adminName?: string;
  lastStoreId?: number | null;
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

const EMPTY_PAGE = { items: [] as unknown[] };
type ApiRecord = Record<string, unknown>;
type EmployeeUploadKind = "id-front" | "id-back" | "visa" | "passport";

const EMPLOYEE_DOCUMENT_UPLOAD_PATHS: Record<EmployeeUploadKind, string> = {
  "id-front": "/api/v1/merchant/uploads/employee-id-document-front",
  "id-back": "/api/v1/merchant/uploads/employee-id-document-back",
  visa: "/api/v1/merchant/uploads/employee-visa-document",
  passport: "/api/v1/merchant/uploads/employee-passport-document",
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

function toNumberOrString(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && value.trim() !== "" ? numeric : value;
}

function compact<T extends Record<string, unknown>>(payload: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
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

export function isBackendId(id: string | undefined | null) {
  return !!id && /^\d+$/.test(String(id));
}

export function mapApiStore(input: unknown): Store {
  const raw = asRecord(input);
  const weeklyHours = mapStoreWeekdayHours(raw.weeklyHours);
  const firstBusinessDay = weeklyHours?.find((item) => !item.closed && item.openTime && item.closeTime);
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
    weeklyHours,
    latitude: raw.latitude === undefined || raw.latitude === null ? undefined : asNumber(raw.latitude),
    longitude: raw.longitude === undefined || raw.longitude === null ? undefined : asNumber(raw.longitude),
    geofenceRadius: raw.geofenceRadius === undefined || raw.geofenceRadius === null ? undefined : asNumber(raw.geofenceRadius),
  };
}

export function storeToApiPayload(store: Store) {
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
    weeklyHours: serializeStoreWeekdayHours(store.weeklyHours),
    latitude: store.latitude,
    longitude: store.longitude,
    geofenceRadius: store.geofenceRadius,
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
      return {
        id: asString(record.id),
        name: asString(record.name || record.storeName),
      };
    })
    .filter((item) => item.id);
  const storeIds = rawStoreIds.length > 0 ? rawStoreIds : storeDetails.map((item) => item.id);
  const assignedStores = asArray(raw.assignedStores).map((id) => asString(id));
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
  const shiftId = asString(raw.shiftId || raw.shiftsId);

  return {
    id: raw.id ? `schedule-${raw.id}` : `schedule-${storeId}-${areaId}-${date}-${shiftId}`,
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
    shiftId: asString(raw.shiftsId || raw.shiftId),
    areaId: asString(raw.areaId),
    dayIndex,
    cycleWeek,
    startTime: asString(raw.startTime, "09:00"),
    endTime: asString(raw.endTime, "17:00"),
    employeeIds,
    color: asString(raw.color, "blue"),
    label: asString(raw.shiftsName || raw.shiftName),
  };
}

export function mapApiRosterTemplate(input: unknown): RosterTemplate {
  const raw = asRecord(input);
  const areas = asArray(raw.areas).map(asRecord);
  return {
    id: asString(raw.id),
    name: asString(raw.name),
    storeId: raw.storeId === null || raw.storeId === undefined ? "" : asString(raw.storeId),
    totalDays: asNumber(raw.totalDays, 7),
    status: raw.status === 0 ? "disabled" : "enabled",
    areaIds: areas
      .slice()
      .sort((a, b) => asNumber(a.orderSort) - asNumber(b.orderSort))
      .map((area) => asString(area.id))
      .filter(Boolean),
    cells: asArray(raw.cells).map(mapTemplateCell),
  };
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
  merchantMe: () => apiRequest<MerchantPrincipal>("/api/v1/merchant/me"),
  authMe: () => apiRequest<MerchantPrincipal>("/api/v1/merchant/auth/me"),
  getDashboardStatistics: async (storeId: string) => {
    const data = await apiRequest<unknown>("/api/v1/merchant/dashboard/statistics", {
      storeId,
    });
    return mapApiDashboardStatistics(data);
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
      body: storeToApiPayload(store),
    });
    return mapApiStore(data);
  },
  updateStore: async (id: string, store: Store) => {
    const data = await apiRequest<unknown>(appendEndpointPath(getMerchantEndpoint("stores"), id), {
      method: "PATCH",
      body: storeToApiPayload(store),
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
  createEmployee: async (employee: Employee & { password?: string }) => {
    const data = await apiRequest<unknown>(getMerchantEndpoint("employees"), {
      method: "POST",
      body: employeeToApiPayload(employee, true),
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
    const data = await apiRequest<{ cells?: unknown[] }>(getMerchantEndpoint("schedule"), { storeId });
    return (data?.cells || []).map((cell) => mapApiScheduleCell(cell, storeId));
  },
  saveScheduleDraft: (storeId: string, payload: unknown) =>
    apiRequest<null>(appendEndpointPath(getMerchantEndpoint("schedule"), "draft"), {
      method: "PUT",
      storeId,
      body: payload,
    }),
  publishSchedule: (storeId: string) =>
    apiRequest<null>(appendEndpointPath(getMerchantEndpoint("schedule"), "publish"), {
      method: "POST",
      storeId,
    }),
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
  uploadEmployeeContract: (file: File) =>
    uploadMerchantFile("/api/v1/merchant/uploads/employee-contract", file),
  uploadEmployeeAvatar: (file: File) =>
    uploadMerchantFile("/api/v1/merchant/uploads/employee-avatar", file),
  uploadEmployeeDocument: (kind: EmployeeUploadKind, file: File) =>
    uploadMerchantFile(EMPLOYEE_DOCUMENT_UPLOAD_PATHS[kind], file),
};

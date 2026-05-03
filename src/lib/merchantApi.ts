import { appendEndpointPath, getMerchantEndpoint } from "../config/merchantEndpoints";
import { apiRequest } from "./apiClient";
import type {
  Area,
  CountryOption,
  Employee,
  EmployeeDictItem,
  RosterTemplate,
  RosterTemplateCell,
  ScheduleShift,
  Store,
  WorkDayPattern,
} from "../context/DataContext";

export interface MerchantLoginResult {
  accessToken?: string | null;
  expiresIn?: number | null;
  user?: {
    email?: string;
    name?: string;
  };
  status?: string | null;
}

export interface MerchantPrincipal {
  merchantAdminId?: number;
  merchantId?: number;
  adminName?: string;
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

const EMPTY_PAGE = { items: [] as unknown[] };
type ApiRecord = Record<string, unknown>;

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

function asNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
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

function normalizeWorkDayState(state: unknown): WorkDayPattern["state"] {
  if (state === true || state === "true" || state === "on") return "on";
  if (state === false || state === "false" || state === "off") return "off";
  return "none";
}

function mapWorkDayPattern(pattern: unknown): WorkDayPattern[] | undefined {
  if (!Array.isArray(pattern)) return undefined;
  return pattern.map((item) => {
    const row = asRecord(item);
    return {
      dayIndex: asNumber(row.dayIndex),
      state: normalizeWorkDayState(row.state),
      hours: asNumber(row.hours),
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

function normalizeCountry(country: unknown) {
  return asString(country, "nz").trim().toLowerCase() || "nz";
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
    openTime: asString(raw.openTime, "09:00"),
    closeTime: asString(raw.closeTime, "22:00"),
    timezone: asString(raw.timezone, "Pacific/Auckland"),
    status: normalizeStatus(raw.status, "enabled", "disabled"),
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

export function mapApiDictItem(input: unknown): EmployeeDictItem {
  const raw = asRecord(input);
  return {
    id: asString(raw.id),
    name: asString(raw.name),
  };
}

export function mapApiEmployee(input: unknown): Employee {
  const raw = asRecord(input);
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
    avatar: asString(raw.avatar),
    avatarPreviewUrl: asString(raw.avatar),
    employeeColor: asString(raw.employeeColor, "#60a5fa"),
    address: asString(raw.address),
    dateOfBirth: asString(raw.dateOfBirth),
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
    workDayPattern: mapWorkDayPattern(raw.workDayPattern),
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
    avatar: employee.avatar,
    employeeColor: employee.employeeColor,
    address: employee.address,
    dateOfBirth: employee.dateOfBirth,
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
    breakMinutes: 0,
    shiftName: asString(raw.shiftsName || raw.shiftsname || raw.shiftName),
    color: asString(raw.color, "blue"),
    note: "",
    status: "draft",
  };
}

function mapTemplateCell(input: unknown): RosterTemplateCell {
  const raw = asRecord(input);
  const employeeIds = asArray(raw.employees).map((employee) => asString(asRecord(employee).id));

  return {
    id: asString(raw.id),
    shiftId: asString(raw.shiftsId || raw.shiftId),
    areaId: asString(raw.areaId),
    dayIndex: Math.max(0, asNumber(raw.weekDay, 1) - 1),
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
  logout: () =>
    apiRequest<null>("/api/v1/merchant/auth/logout", {
      method: "POST",
    }),
  merchantMe: () => apiRequest<MerchantPrincipal>("/api/v1/merchant/me"),
  authMe: () => apiRequest<MerchantPrincipal>("/api/v1/merchant/auth/me"),
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
  listPositions: async () => {
    const data = await apiRequest<{ items?: unknown[] }>(getMerchantEndpoint("positions"));
    return ((data || EMPTY_PAGE).items || []).map(mapApiDictItem);
  },
  listWorkAreas: async () => {
    const data = await apiRequest<{ items?: unknown[] }>(getMerchantEndpoint("workAreas"));
    return ((data || EMPTY_PAGE).items || []).map(mapApiDictItem);
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
  uploadEmployeeContract: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest<MerchantUploadResult>("/api/v1/merchant/uploads/employee-contract", {
      method: "POST",
      body: formData,
    });
  },
  uploadEmployeeAvatar: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest<MerchantUploadResult>("/api/v1/merchant/uploads/employee-avatar", {
      method: "POST",
      body: formData,
    });
  },
};

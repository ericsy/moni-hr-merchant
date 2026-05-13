import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  isBackendId,
  merchantApi,
} from "../lib/merchantApi";
import { useAuth } from "./AuthContext";
import { usePermissions } from "./PermissionsContext";

export interface TimeSlot {
  id?: string | number | null;
  start: string;
  end: string;
}

export interface WorkDayPattern {
  dayIndex: number; // 0=Mon,1=Tue,...6=Sun
  state: "on" | "off" | "none"; // on=working, off=non-working, none=not set
  hours: number;
  timeSlots?: TimeSlot[];
}

export interface EmployeeWeeklyWorkDay {
  weekday: number; // 0=Mon,1=Tue,...6=Sun
  state: "on" | "off";
}

export interface EmployeeWeeklyWorkSlot {
  id?: string | number | null;
  weekday: number; // 0=Mon,1=Tue,...6=Sun
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  role: string;
  phone: string;
  email: string;
  status: "active" | "inactive";
  startDate: string;
  storeIds: string[];
  assignedStores?: string[];
  storeDetails?: { id: string; name: string }[];
  hourlyRate: number;
  notes: string;
  avatar?: string;
  avatarPreviewUrl?: string;
  employeeColor?: string;
  address?: string;
  dateOfBirth?: string;
  emergencyContact?: string;
  emergencyContactPhone?: string;
  gender?: "male" | "female" | string;
  maritalStatus?: "single" | "married" | string;
  identityDocumentType?: "id" | "passport" | string;
  identityDocumentNumber?: string;
  idDocumentFrontKey?: string;
  idDocumentFrontUrl?: string;
  idDocumentBackKey?: string;
  idDocumentBackUrl?: string;
  visaDocumentKey?: string;
  visaDocumentUrl?: string;
  passportDocumentKey?: string;
  passportDocumentUrl?: string;
  visaType?: string;
  visaExpiryDate?: string;
  // Payroll & Tax
  irdNumber?: string;
  taxCode?: string;
  kiwiSaverStatus?: string;
  employeeContributionRate?: string;
  employerContributionRate?: string;
  esctRate?: string;
  bankAccountNumber?: string;
  payrollEmployeeId?: string;
  // Assignments
  areaIds?: string[];
  positionIds?: string[];
  // Work Days
  paidHoursPerDay?: number;
  workDayPattern?: WorkDayPattern[];
  weeklyWorkDays?: EmployeeWeeklyWorkDay[];
  weeklyWorkSlots?: EmployeeWeeklyWorkSlot[];
  // Employment
  contractType?: string;
  contractDocumentKey?: string;
  contractDocumentUrl?: string;
  endDate?: string;
  contractedHours?: string;
  annualSalary?: string;
  defaultHourlyRate?: string;
}

export interface Store {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  manager: string;
  openTime: string;
  closeTime: string;
  timezone: string;
  weeklyHours?: StoreWeekdayHours[];
  // Geofence
  latitude?: number;
  longitude?: number;
  geofenceRadius?: number; // meters
}

export interface StoreWeekdayHours {
  weekday: number; // 1=Mon,...7=Sun
  closed?: boolean;
  openTime?: string;
  closeTime?: string;
}

export interface CountryOption {
  code: string;
  nameZh: string;
  nameEn: string;
  dialCode: string;
}

export interface EmployeeDictItem {
  id: string;
  name: string;
}

export interface ScheduleShift {
  id: string;
  shiftId?: string;
  isGlobalPreset?: boolean;
  /** @deprecated use employeeIds */
  employeeId: string;
  employeeIds: string[];
  areaId: string;
  storeId: string;
  shiftType?: "store" | "general";
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  shiftName: string;
  color: string;
  note: string;
  status: "draft" | "published";
}

export interface Area {
  id: string;
  name: string;
  color: string;
  storeId: string;
  areaType?: "store" | "general";
  order: number;
}

export type ScheduleArea = Area;

export interface RosterTemplateCell {
  id: string;
  shiftId?: string;
  areaId: string;
  dayIndex: number;
  cycleWeek?: number;
  startTime: string;
  endTime: string;
  employeeIds: string[];
  color: string;
  label: string;
}

export interface RosterTemplateShift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  color: string;
  days: number[];
}

export interface RosterTemplate {
  id: string;
  name: string;
  storeId: string;
  totalDays: number;
  status?: "enabled" | "disabled";
  cells: RosterTemplateCell[];
  shifts?: RosterTemplateShift[];
  areaIds: string[];
}

interface DataContextType {
  loading: boolean;
  storesLoaded: boolean;
  error: string;
  lastStoreId: string;
  refreshData: () => Promise<void>;
  reloadForStore: (storeId: string) => Promise<void>;
  employees: Employee[];
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  saveEmployee: (employee: Employee, existingId?: string) => Promise<Employee>;
  deleteEmployee: (id: string) => Promise<void>;
  stores: Store[];
  setStores: React.Dispatch<React.SetStateAction<Store[]>>;
  saveStore: (store: Store, existingId?: string) => Promise<Store>;
  deleteStore: (id: string) => Promise<void>;
  countries: CountryOption[];
  setCountries: React.Dispatch<React.SetStateAction<CountryOption[]>>;
  positions: EmployeeDictItem[];
  setPositions: React.Dispatch<React.SetStateAction<EmployeeDictItem[]>>;
  workAreas: EmployeeDictItem[];
  setWorkAreas: React.Dispatch<React.SetStateAction<EmployeeDictItem[]>>;
  scheduleShifts: ScheduleShift[];
  setScheduleShifts: React.Dispatch<React.SetStateAction<ScheduleShift[]>>;
  saveGlobalShift: (shift: ScheduleShift, existingShiftId?: string) => Promise<ScheduleShift>;
  deleteGlobalShift: (shiftId: string) => Promise<void>;
  saveScheduleDraft: (nextShifts?: ScheduleShift[], targetStoreId?: string) => Promise<void>;
  publishSchedule: (targetStoreId?: string) => Promise<void>;
  areas: Area[];
  setAreas: React.Dispatch<React.SetStateAction<Area[]>>;
  saveArea: (area: Area, existingId?: string) => Promise<Area>;
  deleteArea: (id: string) => Promise<void>;
  scheduleAreas: Area[];
  setScheduleAreas: React.Dispatch<React.SetStateAction<Area[]>>;
  rosterTemplates: RosterTemplate[];
  setRosterTemplates: React.Dispatch<React.SetStateAction<RosterTemplate[]>>;
  saveRosterTemplate: (template: RosterTemplate) => Promise<RosterTemplate>;
  deleteRosterTemplate: (id: string) => Promise<void>;
  templates: RosterTemplate[];
}

const defaultCountries: CountryOption[] = [
  { code: "nz", nameZh: "新西兰", nameEn: "New Zealand", dialCode: "64" },
  { code: "au", nameZh: "澳大利亚", nameEn: "Australia", dialCode: "61" },
];

interface PersistedDataSnapshot {
  employees: Employee[];
  stores: Store[];
  countries: CountryOption[];
  positions: EmployeeDictItem[];
  workAreas: EmployeeDictItem[];
  scheduleShifts: ScheduleShift[];
  areas: Area[];
  rosterTemplates: RosterTemplate[];
}

const getDefaultDataSnapshot = (): PersistedDataSnapshot => ({
  employees: [],
  stores: [],
  countries: defaultCountries,
  positions: [],
  workAreas: [],
  scheduleShifts: [],
  areas: [],
  rosterTemplates: [],
});

const dedupeById = <T extends { id: string }>(items: T[]) => {
  const map = new Map<string, T>();
  items.forEach((item) => {
    if (item.id) map.set(item.id, item);
  });
  return Array.from(map.values());
};

const getShiftDefinitionKey = (
  shift: Pick<ScheduleShift, "shiftId" | "shiftName" | "startTime" | "endTime" | "breakMinutes" | "color" | "storeId" | "shiftType">
) => {
  const scope = (shift.shiftType || "store") === "general" ? "general" : `store:${shift.storeId || ""}`;
  return [
    scope,
    (shift.shiftName || "").trim().toLowerCase(),
    shift.startTime || "",
    shift.endTime || "",
    String(shift.breakMinutes ?? 0),
    shift.color || "",
  ].join("|");
};

const getShiftIdentityKey = (
  shift: Pick<ScheduleShift, "shiftId" | "shiftName" | "startTime" | "endTime" | "breakMinutes" | "color" | "storeId" | "shiftType">
) => shift.shiftId ? `id:${shift.shiftId}` : getShiftDefinitionKey(shift);

const dedupeScheduleShifts = (items: ScheduleShift[]) => {
  const map = new Map<string, ScheduleShift>();

  items.forEach((item) => {
    const key = item.isGlobalPreset
      ? `global:${getShiftDefinitionKey(item)}`
      : `schedule:${item.id || getShiftIdentityKey(item)}`;
    if (!key) return;
    const existing = map.get(key);
    if (!existing || (!existing.shiftId && item.shiftId)) {
      map.set(key, item);
    }
  });

  return Array.from(map.values());
};

const mergeFetchedRosterTemplates = (fetched: RosterTemplate[], current: RosterTemplate[]) => {
  const localDrafts = current.filter((template) => !isBackendId(template.id));
  return dedupeById([...fetched, ...localDrafts]);
};

const getContextStoreIds = (selectedStoreId: string, storeItems: Store[]) => {
  if (selectedStoreId && selectedStoreId !== "all") return [selectedStoreId];
  return storeItems.map((store) => store.id).filter(Boolean);
};

const resolveStoreContext = (requestedStoreId: string, storeItems: Store[], lastStoreId?: string) => {
  const candidateIds = [requestedStoreId, lastStoreId].filter((id) => id && id !== "all");
  const storeIds = new Set(storeItems.map((store) => store.id).filter(Boolean));
  const matched = candidateIds.find((id) => storeIds.has(id));
  if (matched) return matched;

  return storeItems[0]?.id || "";
};

async function loadByStoreContext<T extends { id: string }>(
  selectedStoreId: string,
  storeItems: Store[],
  loader: (storeId: string) => Promise<T[]>
) {
  const scopedStoreId = selectedStoreId || "all";
  if (scopedStoreId !== "all") return loader(scopedStoreId);

  try {
    return await loader("all");
  } catch (error) {
    if (storeItems.length === 0) throw error;
    console.warn("[DataContext] failed to load all-store data, falling back to each store:", error);
  }

  const groups = await Promise.all(getContextStoreIds("all", storeItems).map((storeId) => loader(storeId)));
  return dedupeById(groups.flat());
}

async function loadDataPart<T>(label: string, loader: () => Promise<T>) {
  try {
    return { ok: true as const, value: await loader() };
  } catch (error) {
    console.warn(`[DataContext] failed to load ${label}:`, error);
    return { ok: false as const, error };
  }
}

const requireNumericId = (id: string, label: string) => {
  if (!isBackendId(id)) {
    throw new Error(`${label} 尚未同步到后端，无法保存排班`);
  }
  return Number(id);
};

const getOperationMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const buildEmptyScheduleDraft = () => ({
  areas: [] as { id: number; orderSort: number }[],
  cells: [] as {
    areaId: number;
    shiftId: number;
    date_str: string;
    startTime: string;
    endTime: string;
    employeesIds: number[];
    shiftsName?: string;
    breakMinutes?: number;
    color?: string;
  }[],
});

const DataContext = createContext<DataContextType>({
  loading: false,
  storesLoaded: false,
  error: "",
  lastStoreId: "",
  refreshData: async () => {},
  reloadForStore: async () => {},
  employees: [],
  setEmployees: () => {},
  saveEmployee: async (employee) => employee,
  deleteEmployee: async () => {},
  stores: [],
  setStores: () => {},
  saveStore: async (store) => store,
  deleteStore: async () => {},
  countries: defaultCountries,
  setCountries: () => {},
  positions: [],
  setPositions: () => {},
  workAreas: [],
  setWorkAreas: () => {},
  scheduleShifts: [],
  setScheduleShifts: () => {},
  saveGlobalShift: async (shift) => shift,
  deleteGlobalShift: async () => {},
  saveScheduleDraft: async () => {},
  publishSchedule: async () => {},
  areas: [],
  setAreas: () => {},
  saveArea: async (area) => area,
  deleteArea: async () => {},
  scheduleAreas: [],
  setScheduleAreas: () => {},
  rosterTemplates: [],
  setRosterTemplates: () => {},
  saveRosterTemplate: async (template) => template,
  deleteRosterTemplate: async () => {},
  templates: [],
});

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const { loading: permissionsLoading } = usePermissions();
  const [initialData] = useState<PersistedDataSnapshot>(() => getDefaultDataSnapshot());
  const [employees, setEmployees] = useState<Employee[]>(initialData.employees);
  const [stores, setStores] = useState<Store[]>(initialData.stores);
  const [countries, setCountries] = useState<CountryOption[]>(initialData.countries);
  const [positions, setPositions] = useState<EmployeeDictItem[]>(initialData.positions);
  const [workAreas, setWorkAreas] = useState<EmployeeDictItem[]>(initialData.workAreas);
  const [scheduleShifts, setScheduleShifts] = useState<ScheduleShift[]>(initialData.scheduleShifts);
  const [areas, setAreas] = useState<Area[]>(initialData.areas);
  const [rosterTemplates, setRosterTemplates] = useState<RosterTemplate[]>(initialData.rosterTemplates);
  const [loading, setLoading] = useState(false);
  const [storesLoaded, setStoresLoaded] = useState(false);
  const [error, setError] = useState("");
  const [lastStoreId, setLastStoreIdState] = useState("");
  const lastStoreIdRef = useRef("");
  const currentStoreContextRef = useRef("");
  const loadSeqRef = useRef(0);
  const inFlightLoadRef = useRef<{ key: string; promise: Promise<void> } | null>(null);
  const inFlightGlobalShiftSaveRef = useRef<Map<string, Promise<ScheduleShift>>>(new Map());

  const setLastStoreId = useCallback((nextLastStoreId: string) => {
    if (lastStoreIdRef.current === nextLastStoreId) return;
    lastStoreIdRef.current = nextLastStoreId;
    setLastStoreIdState(nextLastStoreId);
  }, []);

  const loadTemplatesForStore = useCallback(async (storeId: string) => {
    const list = await merchantApi.listScheduleTemplates(storeId);
    const details = await Promise.all(
      list
        .map((item) => item.id)
        .filter(Boolean)
        .map((id) => merchantApi.getScheduleTemplate(String(id)))
    );
    return details.map((template) => ({
      ...template,
      storeId: template.storeId || storeId,
    }));
  }, []);

  const loadData = useCallback((storeContext = currentStoreContextRef.current) => {
    if (permissionsLoading) return Promise.resolve();

    if (status !== "authenticated") {
      setEmployees([]);
      setStores([]);
      setCountries(defaultCountries);
      setPositions([]);
      setWorkAreas([]);
      setScheduleShifts([]);
      setAreas([]);
      setRosterTemplates([]);
      setLastStoreId("");
      setStoresLoaded(false);
      currentStoreContextRef.current = "";
      inFlightLoadRef.current = null;
      return Promise.resolve();
    }

    const requestedStoreContext = storeContext || "";
    const inFlightLoad = inFlightLoadRef.current;
    if (inFlightLoad?.key === requestedStoreContext) {
      return inFlightLoad.promise;
    }

    const seq = loadSeqRef.current + 1;
    loadSeqRef.current = seq;
    setLoading(true);
    setError("");

    const promise = (async () => {
    try {
      const [
        nextCountries,
        nextStores,
      ] = await Promise.all([
        merchantApi.listCountries().catch((countryError) => {
          console.warn("[DataContext] failed to load country options:", countryError);
          return defaultCountries;
        }),
        merchantApi.listStores(),
      ]);
      const principal = await merchantApi.merchantMe().catch((meError) => {
        console.warn("[DataContext] failed to load merchant me:", meError);
        return null;
      });
      const nextLastStoreId = principal?.lastStoreId === null || principal?.lastStoreId === undefined
        ? ""
        : String(principal.lastStoreId);

      const resolvedStoreContext = resolveStoreContext(storeContext, nextStores, nextLastStoreId);
      if (currentStoreContextRef.current !== resolvedStoreContext) {
        currentStoreContextRef.current = resolvedStoreContext;
      }
      if (nextLastStoreId) {
        setLastStoreId(nextLastStoreId);
      }

      if (nextStores.length === 0) {
        if (loadSeqRef.current !== seq) return;

        setStores([]);
        setCountries(nextCountries.length > 0 ? nextCountries : defaultCountries);
        setStoresLoaded(true);
        setEmployees([]);
        setAreas([]);
        setScheduleShifts([]);
        setRosterTemplates([]);
        setLastStoreId("");
        currentStoreContextRef.current = "";
        return;
      }

      const scheduleStoreIds = getContextStoreIds(resolvedStoreContext, nextStores);

      const [
        employeeResult,
        areaResult,
        globalShiftResult,
        scheduleResult,
        templateResult,
      ] = await Promise.all([
        loadDataPart("employees", () => loadByStoreContext(resolvedStoreContext, nextStores, (storeId) => merchantApi.listEmployees(storeId))),
        loadDataPart("areas", () => loadByStoreContext(resolvedStoreContext, nextStores, (storeId) => merchantApi.listAreas(storeId))),
        loadDataPart("global shifts", () => loadByStoreContext(resolvedStoreContext, nextStores, (storeId) => merchantApi.listGlobalShifts(storeId))),
        loadDataPart("schedule", () => Promise.all(scheduleStoreIds.map((storeId) => merchantApi.getSchedule(storeId)))),
        loadDataPart("schedule templates", () => loadByStoreContext(resolvedStoreContext, nextStores, loadTemplatesForStore)),
      ]);

      if (loadSeqRef.current !== seq) return;

      setStores(nextStores);
      setCountries(nextCountries.length > 0 ? nextCountries : defaultCountries);
      setStoresLoaded(true);
      if (employeeResult.ok) setEmployees(dedupeById(employeeResult.value));
      if (areaResult.ok) setAreas(dedupeById(areaResult.value));
      if (templateResult.ok) {
        setRosterTemplates((prev) => mergeFetchedRosterTemplates(dedupeById(templateResult.value), prev));
      }

      if (globalShiftResult.ok || scheduleResult.ok) {
        setScheduleShifts(dedupeScheduleShifts(dedupeById([
          ...(globalShiftResult.ok ? globalShiftResult.value : []),
          ...(scheduleResult.ok ? scheduleResult.value.flat() : []),
        ])));
      }
    } catch (loadError) {
      const message = getOperationMessage(loadError, "加载数据失败");
      console.warn("[DataContext] failed to load backend data:", loadError);
      if (loadSeqRef.current === seq) setError(message);
    } finally {
      if (loadSeqRef.current === seq) setLoading(false);
      if (inFlightLoadRef.current?.promise === promise) {
        inFlightLoadRef.current = null;
      }
    }
    })();

    inFlightLoadRef.current = { key: requestedStoreContext, promise };
    return promise;
  }, [loadTemplatesForStore, permissionsLoading, setLastStoreId, status]);

  const refreshData = useCallback(() => loadData(currentStoreContextRef.current), [loadData]);

  const reloadForStore = useCallback((storeId: string) => {
    currentStoreContextRef.current = storeId || "";
    return loadData(currentStoreContextRef.current);
  }, [loadData]);

  useEffect(() => {
    if (status === "authenticated" && !permissionsLoading) {
      refreshData();
    } else {
      queueMicrotask(() => {
        setEmployees([]);
        setStores([]);
        setCountries(defaultCountries);
        setPositions([]);
        setWorkAreas([]);
        setScheduleShifts([]);
        setAreas([]);
        setRosterTemplates([]);
        setLastStoreId("");
        setStoresLoaded(false);
        currentStoreContextRef.current = "";
      });
    }
  }, [permissionsLoading, refreshData, status]);

  const saveStore = useCallback(async (store: Store, existingId?: string) => {
    const saved = existingId
      ? await merchantApi.updateStore(existingId, store)
      : await merchantApi.createStore(store);
    setStores((prev) => existingId
      ? prev.map((item) => item.id === existingId ? saved : item)
      : [...prev, saved]);
    return saved;
  }, []);

  const deleteStore = useCallback(async (id: string) => {
    await merchantApi.deleteStore(id);
    setStores((prev) => prev.filter((store) => store.id !== id));
  }, []);

  const saveEmployee = useCallback(async (employee: Employee, existingId?: string) => {
    if (employee.email) {
      const isEmailAvailable = await merchantApi.checkEmployeeEmailAvailable(employee.email, existingId);
      if (!isEmailAvailable) {
        throw new Error("该邮箱已被占用，请使用其他邮箱");
      }
    }

    if (employee.employeeId) {
      const isEmployeeIdAvailable = await merchantApi.checkEmployeeIdAvailable(employee.employeeId, existingId);
      if (!isEmployeeIdAvailable) {
        throw new Error("该员工工号已存在，请使用其他工号");
      }
    }

    const saved = existingId
      ? await merchantApi.updateEmployee(existingId, employee)
      : await merchantApi.createEmployee(employee);
    const normalizedSaved: Employee = {
      ...saved,
      areaIds: saved.areaIds?.length ? saved.areaIds : employee.areaIds || [],
      positionIds: saved.positionIds?.length ? saved.positionIds : employee.positionIds || [],
      workDayPattern: saved.workDayPattern?.length ? saved.workDayPattern : employee.workDayPattern || [],
      weeklyWorkDays: saved.weeklyWorkDays?.length ? saved.weeklyWorkDays : employee.weeklyWorkDays,
      weeklyWorkSlots: saved.weeklyWorkSlots?.length ? saved.weeklyWorkSlots : employee.weeklyWorkSlots,
    };
    setEmployees((prev) => existingId
      ? prev.map((item) => item.id === existingId ? normalizedSaved : item)
      : [...prev, normalizedSaved]);
    return normalizedSaved;
  }, []);

  const deleteEmployee = useCallback(async (id: string) => {
    await merchantApi.deleteEmployee(id);
    setEmployees((prev) => prev.filter((employee) => employee.id !== id));
  }, []);

  const saveArea = useCallback(async (area: Area, existingId?: string) => {
    const headerStoreId = (area.areaType || "store") === "store"
      ? area.storeId
      : currentStoreContextRef.current !== "all"
      ? currentStoreContextRef.current
      : stores[0]?.id;
    const saved = existingId
      ? await merchantApi.updateArea(existingId, area)
      : await merchantApi.createArea(area, headerStoreId);
    setAreas((prev) => existingId
      ? prev.map((item) => item.id === existingId ? saved : item)
      : [...prev, saved]);
    return saved;
  }, [stores]);

  const deleteArea = useCallback(async (id: string) => {
    await merchantApi.deleteArea(id);
    setAreas((prev) => prev.filter((area) => area.id !== id));
  }, []);

  const saveGlobalShift = useCallback(async (shift: ScheduleShift, existingShiftId?: string) => {
    const saveKey = existingShiftId
      ? `update:${existingShiftId}`
      : `create:${getShiftDefinitionKey(shift)}`;
    const inFlightSave = inFlightGlobalShiftSaveRef.current.get(saveKey);
    if (inFlightSave) return inFlightSave;

    const promise = (async () => {
      const saved = existingShiftId
        ? await merchantApi.updateGlobalShift(existingShiftId, shift)
        : await merchantApi.createGlobalShift(shift);
      setScheduleShifts((prev) => {
        const next = existingShiftId
          ? prev.map((item) => item.shiftId === existingShiftId ? saved : item)
          : [...prev, saved];
        return dedupeScheduleShifts(dedupeById(next));
      });
      return saved;
    })().finally(() => {
      inFlightGlobalShiftSaveRef.current.delete(saveKey);
    });

    inFlightGlobalShiftSaveRef.current.set(saveKey, promise);
    const saved = await promise;
    return saved;
  }, []);

  const deleteGlobalShift = useCallback(async (shiftId: string) => {
    const normalizedId = shiftId.replace(/^global-/, "");
    await merchantApi.deleteGlobalShift(normalizedId);
    setScheduleShifts((prev) => prev.filter((shift) => shift.shiftId !== normalizedId && shift.id !== shiftId));
  }, []);

  const buildScheduleDraftPayload = useCallback(async (storeId: string, nextShifts: ScheduleShift[]) => {
    const payload = buildEmptyScheduleDraft();
    const relevantAreas = areas
      .filter((area) => (area.areaType || "store") === "general" || area.storeId === storeId)
      .filter((area) => isBackendId(area.id))
      .sort((a, b) => a.order - b.order);

    payload.areas = relevantAreas.map((area, index) => ({
      id: requireNumericId(area.id, "区域"),
      orderSort: area.order ?? index,
    }));

    for (const shift of nextShifts) {
      if (shift.isGlobalPreset || !shift.areaId || !shift.date || shift.storeId !== storeId) continue;

      const shiftId = requireNumericId(shift.shiftId || "", "班次");
      payload.cells.push({
        areaId: requireNumericId(shift.areaId, "区域"),
        shiftId,
        date_str: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        employeesIds: (shift.employeeIds || []).map((id) => requireNumericId(id, "员工")),
        shiftsName: shift.shiftName,
        breakMinutes: shift.breakMinutes,
        color: shift.color,
      });
    }

    return payload;
  }, [areas]);

  const saveScheduleDraft = useCallback(async (nextShifts = scheduleShifts, targetStoreId?: string) => {
    const contextIds = targetStoreId && targetStoreId !== "all"
      ? [targetStoreId]
      : Array.from(new Set(nextShifts.filter((shift) => !shift.isGlobalPreset && shift.storeId).map((shift) => shift.storeId)));

    if (contextIds.length === 0) {
      throw new Error("请先选择具体门店并维护排班内容");
    }

    await Promise.all(contextIds.map(async (storeId) => {
      const payload = await buildScheduleDraftPayload(storeId, nextShifts);
      await merchantApi.saveScheduleDraft(storeId, payload);
    }));

    setScheduleShifts(nextShifts);
  }, [buildScheduleDraftPayload, scheduleShifts]);

  const publishSchedule = useCallback(async (targetStoreId?: string) => {
    const contextIds = targetStoreId && targetStoreId !== "all"
      ? [targetStoreId]
      : Array.from(new Set(scheduleShifts.filter((shift) => !shift.isGlobalPreset && shift.storeId).map((shift) => shift.storeId)));

    if (contextIds.length === 0) {
      throw new Error("请先选择具体门店并维护排班内容");
    }

    await Promise.all(contextIds.map((storeId) => merchantApi.publishSchedule(storeId)));
    setScheduleShifts((prev) => prev.map((shift) =>
      contextIds.includes(shift.storeId) ? { ...shift, status: "published" as const } : shift
    ));
  }, [scheduleShifts]);

  const buildTemplatePayload = useCallback(async (template: RosterTemplate) => {
    const storeId = template.storeId || (currentStoreContextRef.current !== "all" ? currentStoreContextRef.current : stores[0]?.id || "");

    if (!storeId) {
      throw new Error("请先选择具体门店后再保存模版");
    }

    const templateAreas = template.areaIds
      .map((areaId) => areas.find((area) => area.id === areaId))
      .filter(Boolean) as Area[];

    const cells = [];
    for (const cell of template.cells) {
      if (cell.dayIndex < 0 || cell.dayIndex >= template.totalDays) continue;
      const shiftId = requireNumericId(cell.shiftId || "", "班次");
      const cycleWeek = Math.floor(cell.dayIndex / 7) + 1;
      cells.push({
        areaId: requireNumericId(cell.areaId, "区域"),
        shiftsId: shiftId,
        dayIndex: cell.dayIndex,
        weekDay: ((cell.dayIndex % 7) + 7) % 7 + 1,
        ...(template.totalDays > 7 ? { cycleWeek } : {}),
        startTime: cell.startTime,
        endTime: cell.endTime,
        employeeIds: (cell.employeeIds || []).map((id) => requireNumericId(id, "员工")),
        color: cell.color,
      });
    }

    return {
      storeId,
      payload: {
        name: template.name,
        totalDays: template.totalDays,
        status: template.status === "disabled" ? 0 : 1,
        areas: templateAreas.map((area, index) => ({
          id: requireNumericId(area.id, "区域"),
          orderSort: area.order ?? index,
        })),
        cells,
      },
    };
  }, [areas, stores]);

  const saveRosterTemplate = useCallback(async (template: RosterTemplate) => {
    const { storeId, payload } = await buildTemplatePayload(template);
    const saved = isBackendId(template.id)
      ? await merchantApi.updateScheduleTemplate(template.id, payload)
      : await merchantApi.createScheduleTemplate(storeId, payload);
    setRosterTemplates((prev) => isBackendId(template.id)
      ? prev.map((item) => item.id === template.id ? saved : item)
      : [...prev.filter((item) => item.id !== template.id), saved]);
    return saved;
  }, [buildTemplatePayload]);

  const deleteRosterTemplate = useCallback(async (id: string) => {
    if (isBackendId(id)) {
      await merchantApi.deleteScheduleTemplate(id);
    }
    setRosterTemplates((prev) => prev.filter((template) => template.id !== id));
  }, []);

  return (
    <DataContext.Provider value={{
      loading, storesLoaded, error, refreshData, reloadForStore,
      lastStoreId,
      employees, setEmployees,
      saveEmployee, deleteEmployee,
      stores, setStores,
      saveStore, deleteStore,
      countries, setCountries,
      positions, setPositions,
      workAreas, setWorkAreas,
      scheduleShifts, setScheduleShifts,
      saveGlobalShift, deleteGlobalShift,
      saveScheduleDraft, publishSchedule,
      areas, setAreas,
      saveArea, deleteArea,
      scheduleAreas: areas, setScheduleAreas: setAreas,
      rosterTemplates, setRosterTemplates,
      saveRosterTemplate, deleteRosterTemplate,
      templates: rosterTemplates,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}

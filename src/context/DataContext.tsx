import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  isBackendId,
  merchantApi,
} from "../lib/merchantApi";
import { useAuth } from "./AuthContext";
import { usePermissions } from "./PermissionsContext";

export interface WorkDayPattern {
  dayIndex: number; // 0=Mon,1=Tue,...6=Sun
  state: "on" | "off" | "none"; // on=working, off=non-working, none=not set
  hours: number;
}

export interface Employee {
  id: string;
  password?: string;
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
  hourlyRate: number;
  notes: string;
  avatar?: string;
  employeeColor?: string;
  address?: string;
  dateOfBirth?: string;
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
  // Employment
  contractType?: string;
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
  country: "nz" | "au";
  phone: string;
  email: string;
  manager: string;
  openTime: string;
  closeTime: string;
  timezone: string;
  status: "enabled" | "disabled";
  // Geofence
  latitude?: number;
  longitude?: number;
  geofenceRadius?: number; // meters
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
  error: string;
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

interface LegacyRosterTemplateArea {
  id: string;
  name: string;
}

interface LegacyRosterTemplate extends Omit<RosterTemplate, "areaIds"> {
  areas: LegacyRosterTemplateArea[];
}

const defaultWorkDayPattern: WorkDayPattern[] = [
  { dayIndex: 0, state: "on", hours: 7.5 },
  { dayIndex: 1, state: "on", hours: 7.5 },
  { dayIndex: 2, state: "on", hours: 7.5 },
  { dayIndex: 3, state: "on", hours: 7.5 },
  { dayIndex: 4, state: "on", hours: 7.5 },
  { dayIndex: 5, state: "off", hours: 0 },
  { dayIndex: 6, state: "off", hours: 0 },
];

const mockEmployees: Employee[] = [
  {
    id: "e1",
    firstName: "Emily",
    lastName: "Chen",
    employeeId: "EMP001",
    role: "manager",
    phone: "+64 21 123 4567",
    email: "emily.chen@example.com",
    status: "active",
    startDate: "2022-03-01",
    storeIds: ["s1", "s2"],
    assignedStores: ["s1", "s2"],
    hourlyRate: 28,
    notes: "Store manager for Auckland branch",
    avatar: "",
    employeeColor: "#60a5fa",
    address: "123 Queen Street, Auckland",
    dateOfBirth: "1990-05-12",
    irdNumber: "123-456-789",
    taxCode: "M",
    kiwiSaverStatus: "Enrolled",
    employeeContributionRate: "3%",
    employerContributionRate: "3",
    esctRate: "10.5",
    bankAccountNumber: "12-3456-7890123-00",
    payrollEmployeeId: "PAY001",
    areaIds: ["area1", "area4"],
    positionIds: ["pos1", "pos2"],
    paidHoursPerDay: 7.5,
    workDayPattern: defaultWorkDayPattern,
    contractType: "permanent",
    endDate: "",
    contractedHours: "37.5",
    annualSalary: "55000",
    defaultHourlyRate: "28",
  },
  {
    id: "e2",
    firstName: "James",
    lastName: "Wilson",
    employeeId: "EMP002",
    role: "staff",
    phone: "+64 22 234 5678",
    email: "james.wilson@example.com",
    status: "active",
    startDate: "2023-01-15",
    storeIds: ["s1"],
    assignedStores: ["s1"],
    hourlyRate: 22,
    notes: "",
    avatar: "",
    employeeColor: "#a78bfa",
    irdNumber: "987-654-321",
    taxCode: "M SL",
    kiwiSaverStatus: "Enrolled",
    employeeContributionRate: "4%",
    employerContributionRate: "3",
    esctRate: "17.5",
    bankAccountNumber: "06-0987-6543210-00",
    payrollEmployeeId: "PAY002",
    areaIds: ["area1"],
    positionIds: ["pos1"],
    paidHoursPerDay: 8,
    workDayPattern: defaultWorkDayPattern,
    contractType: "fixed-term",
    endDate: "2025-12-31",
    contractedHours: "40",
    annualSalary: "",
    defaultHourlyRate: "22",
  },
  {
    id: "e3",
    firstName: "Sarah",
    lastName: "Nguyen",
    employeeId: "EMP003",
    role: "supervisor",
    phone: "+61 412 345 678",
    email: "sarah.nguyen@example.com",
    status: "active",
    startDate: "2022-07-20",
    storeIds: ["s3"],
    assignedStores: ["s3"],
    hourlyRate: 25,
    notes: "Sydney supervisor",
    avatar: "",
    employeeColor: "#34d399",
    irdNumber: "456-789-012",
    taxCode: "M",
    kiwiSaverStatus: "Non-enrolled",
    employeeContributionRate: "3%",
    employerContributionRate: "3",
    esctRate: "28",
    bankAccountNumber: "03-0456-7890123-00",
    payrollEmployeeId: "PAY003",
    areaIds: ["area6", "area7"],
    positionIds: ["pos2"],
    paidHoursPerDay: 7.5,
    workDayPattern: defaultWorkDayPattern,
    contractType: "permanent",
    endDate: "",
    contractedHours: "37.5",
    annualSalary: "50000",
    defaultHourlyRate: "25",
  },
  {
    id: "e4",
    firstName: "Michael",
    lastName: "Brown",
    employeeId: "EMP004",
    role: "partTime",
    phone: "+64 21 345 6789",
    email: "michael.brown@example.com",
    status: "active",
    startDate: "2023-06-01",
    storeIds: ["s2"],
    assignedStores: ["s2"],
    hourlyRate: 20,
    notes: "",
    avatar: "",
    employeeColor: "#fb923c",
    irdNumber: "",
    taxCode: "M",
    kiwiSaverStatus: "Enrolled",
    employeeContributionRate: "3%",
    employerContributionRate: "3",
    esctRate: "10.5",
    bankAccountNumber: "",
    payrollEmployeeId: "",
    areaIds: ["area4"],
    positionIds: [],
    paidHoursPerDay: 6,
    workDayPattern: [
      { dayIndex: 0, state: "on", hours: 6 },
      { dayIndex: 1, state: "on", hours: 6 },
      { dayIndex: 2, state: "off", hours: 0 },
      { dayIndex: 3, state: "on", hours: 6 },
      { dayIndex: 4, state: "on", hours: 6 },
      { dayIndex: 5, state: "off", hours: 0 },
      { dayIndex: 6, state: "none", hours: 0 },
    ],
    contractType: "part-time",
    endDate: "",
    contractedHours: "24",
    annualSalary: "",
    defaultHourlyRate: "20",
  },
  {
    id: "e5",
    firstName: "Jessica",
    lastName: "Lee",
    employeeId: "EMP005",
    role: "casual",
    phone: "+61 423 456 789",
    email: "jessica.lee@example.com",
    status: "inactive",
    startDate: "2021-11-10",
    storeIds: [],
    assignedStores: [],
    hourlyRate: 19,
    notes: "Currently on leave",
    avatar: "",
    employeeColor: "#f472b6",
    irdNumber: "",
    taxCode: "",
    kiwiSaverStatus: "Non-enrolled",
    employeeContributionRate: "3%",
    employerContributionRate: "3",
    esctRate: "10.5",
    bankAccountNumber: "",
    payrollEmployeeId: "",
    areaIds: [],
    positionIds: [],
    paidHoursPerDay: 8,
    workDayPattern: defaultWorkDayPattern,
    contractType: "casual",
    endDate: "2024-06-30",
    contractedHours: "",
    annualSalary: "",
    defaultHourlyRate: "19",
  },
  {
    id: "e6",
    firstName: "David",
    lastName: "Kim",
    employeeId: "EMP006",
    role: "staff",
    phone: "+64 27 456 7890",
    email: "david.kim@example.com",
    status: "active",
    startDate: "2023-09-01",
    storeIds: ["s1", "s3"],
    assignedStores: ["s1", "s3"],
    hourlyRate: 22,
    notes: "",
    avatar: "",
    employeeColor: "#38bdf8",
    irdNumber: "321-654-987",
    taxCode: "M",
    kiwiSaverStatus: "Enrolled",
    employeeContributionRate: "6%",
    employerContributionRate: "3",
    esctRate: "17.5",
    bankAccountNumber: "15-3210-9876543-00",
    payrollEmployeeId: "PAY006",
    areaIds: ["area2", "area8"],
    positionIds: ["pos1"],
    paidHoursPerDay: 8,
    workDayPattern: defaultWorkDayPattern,
    contractType: "permanent",
    endDate: "",
    contractedHours: "40",
    annualSalary: "45000",
    defaultHourlyRate: "22",
  },
];

const mockStores: Store[] = [
  {
    id: "s1",
    name: "Auckland CBD",
    code: "AKL01",
    address: "123 Queen Street",
    city: "Auckland",
    country: "nz",
    phone: "+64 9 123 4567",
    email: "auckland@example.com",
    manager: "Emily Chen",
    openTime: "08:00",
    closeTime: "22:00",
    timezone: "Pacific/Auckland",
    status: "enabled",
    latitude: -36.8485,
    longitude: 174.7633,
    geofenceRadius: 200,
  },
  {
    id: "s2",
    name: "Wellington Central",
    code: "WLG01",
    address: "45 Lambton Quay",
    city: "Wellington",
    country: "nz",
    phone: "+64 4 234 5678",
    email: "wellington@example.com",
    manager: "Emily Chen",
    openTime: "09:00",
    closeTime: "21:00",
    timezone: "Pacific/Auckland",
    status: "enabled",
    latitude: -41.2865,
    longitude: 174.7762,
    geofenceRadius: 150,
  },
  {
    id: "s3",
    name: "Sydney Westfield",
    code: "SYD01",
    address: "188 George Street",
    city: "Sydney",
    country: "au",
    phone: "+61 2 3456 7890",
    email: "sydney@example.com",
    manager: "Sarah Nguyen",
    openTime: "08:00",
    closeTime: "22:00",
    timezone: "Australia/Sydney",
    status: "enabled",
    latitude: -33.8688,
    longitude: 151.2093,
    geofenceRadius: 300,
  },
  {
    id: "s4",
    name: "Melbourne Docklands",
    code: "MEL01",
    address: "67 Collins Street",
    city: "Melbourne",
    country: "au",
    phone: "+61 3 4567 8901",
    email: "melbourne@example.com",
    manager: "",
    openTime: "09:00",
    closeTime: "22:00",
    timezone: "Australia/Melbourne",
    status: "disabled",
  },
];

// ─── Mock Schedule Areas ─────────────────────────────────────────────────────

const mockScheduleAreas: ScheduleArea[] = [
  { id: "area1", name: "前台收银", color: "blue",   storeId: "s1", order: 0 },
  { id: "area2", name: "仓储物流", color: "green",  storeId: "s1", order: 1 },
  { id: "area3", name: "客户服务", color: "purple", storeId: "s1", order: 2 },
  { id: "area4", name: "前台收银", color: "blue",   storeId: "s2", order: 0 },
  { id: "area5", name: "仓储物流", color: "green",  storeId: "s2", order: 1 },
  { id: "area6", name: "客户服务", color: "orange", storeId: "s3", order: 0 },
  { id: "area7", name: "收银台",   color: "red",    storeId: "s3", order: 1 },
  { id: "area8", name: "仓储物流", color: "green",  storeId: "s3", order: 2 },
];

// ─── Mock Roster Templates ────────────────────────────────────────────────────

const legacyMockRosterTemplates: LegacyRosterTemplate[] = [
  // ── Template 1: 标准周排班（7天）─────────────────────────────────────────
  {
    id: "rt1",
    name: "标准周排班",
    storeId: "s1",
    totalDays: 7,
    status: "enabled",
    areas: [
      { id: "rt1-area1", name: "前台收银" },
      { id: "rt1-area2", name: "仓储物流" },
    ],
    cells: [
      // 前台收银 - 早班 (Mon~Fri)
      { id: "rt1-c1",  areaId: "rt1-area1", dayIndex: 0, startTime: "08:00", endTime: "16:00", employeeIds: ["e1"], color: "blue",   label: "早班" },
      { id: "rt1-c2",  areaId: "rt1-area1", dayIndex: 1, startTime: "08:00", endTime: "16:00", employeeIds: ["e2"], color: "blue",   label: "早班" },
      { id: "rt1-c3",  areaId: "rt1-area1", dayIndex: 2, startTime: "08:00", endTime: "16:00", employeeIds: ["e1"], color: "blue",   label: "早班" },
      { id: "rt1-c4",  areaId: "rt1-area1", dayIndex: 3, startTime: "08:00", endTime: "16:00", employeeIds: ["e2"], color: "blue",   label: "早班" },
      { id: "rt1-c5",  areaId: "rt1-area1", dayIndex: 4, startTime: "08:00", endTime: "16:00", employeeIds: ["e1", "e2"], color: "blue", label: "早班" },
      // 前台收银 - 晚班 (Mon~Fri)
      { id: "rt1-c6",  areaId: "rt1-area1", dayIndex: 0, startTime: "16:00", endTime: "22:00", employeeIds: ["e3"], color: "purple", label: "晚班" },
      { id: "rt1-c7",  areaId: "rt1-area1", dayIndex: 1, startTime: "16:00", endTime: "22:00", employeeIds: ["e6"], color: "purple", label: "晚班" },
      { id: "rt1-c8",  areaId: "rt1-area1", dayIndex: 2, startTime: "16:00", endTime: "22:00", employeeIds: ["e3"], color: "purple", label: "晚班" },
      { id: "rt1-c9",  areaId: "rt1-area1", dayIndex: 3, startTime: "16:00", endTime: "22:00", employeeIds: ["e6"], color: "purple", label: "晚班" },
      { id: "rt1-c10", areaId: "rt1-area1", dayIndex: 4, startTime: "16:00", endTime: "22:00", employeeIds: ["e3"], color: "purple", label: "晚班" },
      // 前台收银 - 周末
      { id: "rt1-c11", areaId: "rt1-area1", dayIndex: 5, startTime: "09:00", endTime: "18:00", employeeIds: ["e4"], color: "orange", label: "周末班" },
      { id: "rt1-c12", areaId: "rt1-area1", dayIndex: 6, startTime: "10:00", endTime: "18:00", employeeIds: ["e4"], color: "orange", label: "周末班" },
      // 仓储物流 - 全天班 (Mon~Fri)
      { id: "rt1-c13", areaId: "rt1-area2", dayIndex: 0, startTime: "07:00", endTime: "15:00", employeeIds: ["e6"], color: "green",  label: "仓储早班" },
      { id: "rt1-c14", areaId: "rt1-area2", dayIndex: 1, startTime: "07:00", endTime: "15:00", employeeIds: ["e6"], color: "green",  label: "仓储早班" },
      { id: "rt1-c15", areaId: "rt1-area2", dayIndex: 2, startTime: "07:00", endTime: "15:00", employeeIds: ["e6"], color: "green",  label: "仓储早班" },
      { id: "rt1-c16", areaId: "rt1-area2", dayIndex: 3, startTime: "07:00", endTime: "15:00", employeeIds: ["e6"], color: "green",  label: "仓储早班" },
      { id: "rt1-c17", areaId: "rt1-area2", dayIndex: 4, startTime: "07:00", endTime: "15:00", employeeIds: ["e6"], color: "green",  label: "仓储早班" },
    ],
  },

  // ── Template 2: 双周轮班（14天）──────────────────────────────────────────
  {
    id: "rt2",
    name: "双周轮班",
    storeId: "s1",
    totalDays: 14,
    status: "enabled",
    areas: [
      { id: "rt2-area1", name: "客户服务" },
      { id: "rt2-area2", name: "前台收银" },
    ],
    cells: [
      // 第一周 - 客户服务
      { id: "rt2-c1",  areaId: "rt2-area1", dayIndex: 0,  startTime: "09:00", endTime: "17:00", employeeIds: ["e1"], color: "blue",   label: "日班" },
      { id: "rt2-c2",  areaId: "rt2-area1", dayIndex: 1,  startTime: "09:00", endTime: "17:00", employeeIds: ["e3"], color: "blue",   label: "日班" },
      { id: "rt2-c3",  areaId: "rt2-area1", dayIndex: 2,  startTime: "09:00", endTime: "17:00", employeeIds: ["e1"], color: "blue",   label: "日班" },
      { id: "rt2-c4",  areaId: "rt2-area1", dayIndex: 3,  startTime: "09:00", endTime: "17:00", employeeIds: ["e3"], color: "blue",   label: "日班" },
      { id: "rt2-c5",  areaId: "rt2-area1", dayIndex: 4,  startTime: "09:00", endTime: "17:00", employeeIds: ["e1", "e3"], color: "blue", label: "日班" },
      { id: "rt2-c6",  areaId: "rt2-area1", dayIndex: 5,  startTime: "10:00", endTime: "16:00", employeeIds: ["e4"], color: "orange", label: "周末" },
      { id: "rt2-c7",  areaId: "rt2-area1", dayIndex: 6,  startTime: "10:00", endTime: "16:00", employeeIds: ["e4"], color: "orange", label: "周末" },
      // 第二周 - 客户服务（交替）
      { id: "rt2-c8",  areaId: "rt2-area1", dayIndex: 7,  startTime: "09:00", endTime: "17:00", employeeIds: ["e3"], color: "blue",   label: "日班" },
      { id: "rt2-c9",  areaId: "rt2-area1", dayIndex: 8,  startTime: "09:00", endTime: "17:00", employeeIds: ["e1"], color: "blue",   label: "日班" },
      { id: "rt2-c10", areaId: "rt2-area1", dayIndex: 9,  startTime: "09:00", endTime: "17:00", employeeIds: ["e3"], color: "blue",   label: "日班" },
      { id: "rt2-c11", areaId: "rt2-area1", dayIndex: 10, startTime: "09:00", endTime: "17:00", employeeIds: ["e1"], color: "blue",   label: "日班" },
      { id: "rt2-c12", areaId: "rt2-area1", dayIndex: 11, startTime: "09:00", endTime: "17:00", employeeIds: ["e3", "e1"], color: "blue", label: "日班" },
      // 前台收银 - 第一周晚班
      { id: "rt2-c13", areaId: "rt2-area2", dayIndex: 0,  startTime: "17:00", endTime: "22:00", employeeIds: ["e2"], color: "purple", label: "晚班" },
      { id: "rt2-c14", areaId: "rt2-area2", dayIndex: 1,  startTime: "17:00", endTime: "22:00", employeeIds: ["e6"], color: "purple", label: "晚班" },
      { id: "rt2-c15", areaId: "rt2-area2", dayIndex: 2,  startTime: "17:00", endTime: "22:00", employeeIds: ["e2"], color: "purple", label: "晚班" },
      { id: "rt2-c16", areaId: "rt2-area2", dayIndex: 3,  startTime: "17:00", endTime: "22:00", employeeIds: ["e6"], color: "purple", label: "晚班" },
      { id: "rt2-c17", areaId: "rt2-area2", dayIndex: 4,  startTime: "17:00", endTime: "22:00", employeeIds: ["e2", "e6"], color: "purple", label: "晚班" },
      // 前台收银 - 第二周晚班
      { id: "rt2-c18", areaId: "rt2-area2", dayIndex: 7,  startTime: "17:00", endTime: "22:00", employeeIds: ["e6"], color: "purple", label: "晚班" },
      { id: "rt2-c19", areaId: "rt2-area2", dayIndex: 8,  startTime: "17:00", endTime: "22:00", employeeIds: ["e2"], color: "purple", label: "晚班" },
      { id: "rt2-c20", areaId: "rt2-area2", dayIndex: 9,  startTime: "17:00", endTime: "22:00", employeeIds: ["e6"], color: "purple", label: "晚班" },
      { id: "rt2-c21", areaId: "rt2-area2", dayIndex: 10, startTime: "17:00", endTime: "22:00", employeeIds: ["e2"], color: "purple", label: "晚班" },
      { id: "rt2-c22", areaId: "rt2-area2", dayIndex: 11, startTime: "17:00", endTime: "22:00", employeeIds: ["e6", "e2"], color: "purple", label: "晚班" },
    ],
  },

  // ── Template 3: 三班倒（7天）─────────────────────────────────────────────
  {
    id: "rt3",
    name: "三班倒",
    storeId: "s3",
    totalDays: 7,
    status: "enabled",
    areas: [
      { id: "rt3-area1", name: "收银台" },
      { id: "rt3-area2", name: "仓储物流" },
    ],
    cells: [
      // 早班 06:00-14:00
      { id: "rt3-c1",  areaId: "rt3-area1", dayIndex: 0, startTime: "06:00", endTime: "14:00", employeeIds: ["e2"], color: "green",  label: "早班A" },
      { id: "rt3-c2",  areaId: "rt3-area1", dayIndex: 1, startTime: "06:00", endTime: "14:00", employeeIds: ["e4"], color: "green",  label: "早班A" },
      { id: "rt3-c3",  areaId: "rt3-area1", dayIndex: 2, startTime: "06:00", endTime: "14:00", employeeIds: ["e2"], color: "green",  label: "早班A" },
      { id: "rt3-c4",  areaId: "rt3-area1", dayIndex: 3, startTime: "06:00", endTime: "14:00", employeeIds: ["e4"], color: "green",  label: "早班A" },
      { id: "rt3-c5",  areaId: "rt3-area1", dayIndex: 4, startTime: "06:00", endTime: "14:00", employeeIds: ["e2"], color: "green",  label: "早班A" },
      // 中班 14:00-22:00
      { id: "rt3-c6",  areaId: "rt3-area1", dayIndex: 0, startTime: "14:00", endTime: "22:00", employeeIds: ["e1"], color: "blue",   label: "中班B" },
      { id: "rt3-c7",  areaId: "rt3-area1", dayIndex: 1, startTime: "14:00", endTime: "22:00", employeeIds: ["e3"], color: "blue",   label: "中班B" },
      { id: "rt3-c8",  areaId: "rt3-area1", dayIndex: 2, startTime: "14:00", endTime: "22:00", employeeIds: ["e1"], color: "blue",   label: "中班B" },
      { id: "rt3-c9",  areaId: "rt3-area1", dayIndex: 3, startTime: "14:00", endTime: "22:00", employeeIds: ["e3"], color: "blue",   label: "中班B" },
      { id: "rt3-c10", areaId: "rt3-area1", dayIndex: 4, startTime: "14:00", endTime: "22:00", employeeIds: ["e1"], color: "blue",   label: "中班B" },
      // 夜班 22:00-06:00
      { id: "rt3-c11", areaId: "rt3-area1", dayIndex: 0, startTime: "22:00", endTime: "06:00", employeeIds: ["e6"], color: "red",    label: "夜班C" },
      { id: "rt3-c12", areaId: "rt3-area1", dayIndex: 1, startTime: "22:00", endTime: "06:00", employeeIds: ["e6"], color: "red",    label: "夜班C" },
      { id: "rt3-c13", areaId: "rt3-area1", dayIndex: 2, startTime: "22:00", endTime: "06:00", employeeIds: ["e6"], color: "red",    label: "夜班C" },
      { id: "rt3-c14", areaId: "rt3-area1", dayIndex: 3, startTime: "22:00", endTime: "06:00", employeeIds: ["e6"], color: "red",    label: "夜班C" },
      { id: "rt3-c15", areaId: "rt3-area1", dayIndex: 4, startTime: "22:00", endTime: "06:00", employeeIds: ["e6"], color: "red",    label: "夜班C" },
      // 仓储 - 日班
      { id: "rt3-c16", areaId: "rt3-area2", dayIndex: 0, startTime: "08:00", endTime: "17:00", employeeIds: ["e3"], color: "orange", label: "仓储日班" },
      { id: "rt3-c17", areaId: "rt3-area2", dayIndex: 1, startTime: "08:00", endTime: "17:00", employeeIds: ["e3"], color: "orange", label: "仓储日班" },
      { id: "rt3-c18", areaId: "rt3-area2", dayIndex: 2, startTime: "08:00", endTime: "17:00", employeeIds: ["e3"], color: "orange", label: "仓储日班" },
      { id: "rt3-c19", areaId: "rt3-area2", dayIndex: 3, startTime: "08:00", endTime: "17:00", employeeIds: ["e3"], color: "orange", label: "仓储日班" },
      { id: "rt3-c20", areaId: "rt3-area2", dayIndex: 4, startTime: "08:00", endTime: "17:00", employeeIds: ["e3"], color: "orange", label: "仓储日班" },
    ],
  },

  // ── Template 4: 周末值班模版（2天）───────────────────────────────────────
  {
    id: "rt4",
    name: "周末值班",
    storeId: "s1",
    totalDays: 7,
    status: "enabled",
    areas: [
      { id: "rt4-area1", name: "前台收银" },
      { id: "rt4-area2", name: "客户服务" },
    ],
    cells: [
      // 周六 (dayIndex 5)
      { id: "rt4-c1", areaId: "rt4-area1", dayIndex: 5, startTime: "09:00", endTime: "13:00", employeeIds: ["e4"], color: "orange", label: "上午值班" },
      { id: "rt4-c2", areaId: "rt4-area1", dayIndex: 5, startTime: "13:00", endTime: "18:00", employeeIds: ["e2"], color: "blue",   label: "下午值班" },
      { id: "rt4-c3", areaId: "rt4-area2", dayIndex: 5, startTime: "10:00", endTime: "17:00", employeeIds: ["e6"], color: "green",  label: "客服值班" },
      // 周日 (dayIndex 6)
      { id: "rt4-c4", areaId: "rt4-area1", dayIndex: 6, startTime: "09:00", endTime: "13:00", employeeIds: ["e2"], color: "orange", label: "上午值班" },
      { id: "rt4-c5", areaId: "rt4-area1", dayIndex: 6, startTime: "13:00", endTime: "18:00", employeeIds: ["e4"], color: "blue",   label: "下午值班" },
      { id: "rt4-c6", areaId: "rt4-area2", dayIndex: 6, startTime: "10:00", endTime: "16:00", employeeIds: ["e3"], color: "green",  label: "客服值班" },
    ],
  },

  // ── Template 5: 四周循环排班（28天）──────────────────────────────────────
  {
    id: "rt5",
    name: "四周循环排班",
    storeId: "s1",
    totalDays: 28,
    status: "enabled",
    areas: [
      { id: "rt5-area1", name: "前台收银" },
      { id: "rt5-area2", name: "仓储物流" },
      { id: "rt5-area3", name: "客户服务" },
    ],
    cells: [
      // 第一周 前台
      { id: "rt5-c1",  areaId: "rt5-area1", dayIndex: 0,  startTime: "08:00", endTime: "16:00", employeeIds: ["e1"], color: "blue",   label: "早班" },
      { id: "rt5-c2",  areaId: "rt5-area1", dayIndex: 1,  startTime: "08:00", endTime: "16:00", employeeIds: ["e2"], color: "blue",   label: "早班" },
      { id: "rt5-c3",  areaId: "rt5-area1", dayIndex: 2,  startTime: "08:00", endTime: "16:00", employeeIds: ["e1"], color: "blue",   label: "早班" },
      { id: "rt5-c4",  areaId: "rt5-area1", dayIndex: 3,  startTime: "08:00", endTime: "16:00", employeeIds: ["e2"], color: "blue",   label: "早班" },
      { id: "rt5-c5",  areaId: "rt5-area1", dayIndex: 4,  startTime: "08:00", endTime: "16:00", employeeIds: ["e1"], color: "blue",   label: "早班" },
      { id: "rt5-c6",  areaId: "rt5-area1", dayIndex: 0,  startTime: "16:00", endTime: "22:00", employeeIds: ["e3"], color: "purple", label: "晚班" },
      { id: "rt5-c7",  areaId: "rt5-area1", dayIndex: 1,  startTime: "16:00", endTime: "22:00", employeeIds: ["e6"], color: "purple", label: "晚班" },
      { id: "rt5-c8",  areaId: "rt5-area1", dayIndex: 2,  startTime: "16:00", endTime: "22:00", employeeIds: ["e3"], color: "purple", label: "晚班" },
      { id: "rt5-c9",  areaId: "rt5-area1", dayIndex: 3,  startTime: "16:00", endTime: "22:00", employeeIds: ["e6"], color: "purple", label: "晚班" },
      { id: "rt5-c10", areaId: "rt5-area1", dayIndex: 4,  startTime: "16:00", endTime: "22:00", employeeIds: ["e3"], color: "purple", label: "晚班" },
      // 第一周 仓储
      { id: "rt5-c11", areaId: "rt5-area2", dayIndex: 0,  startTime: "07:00", endTime: "15:00", employeeIds: ["e6"], color: "green",  label: "仓储班" },
      { id: "rt5-c12", areaId: "rt5-area2", dayIndex: 1,  startTime: "07:00", endTime: "15:00", employeeIds: ["e6"], color: "green",  label: "仓储班" },
      { id: "rt5-c13", areaId: "rt5-area2", dayIndex: 2,  startTime: "07:00", endTime: "15:00", employeeIds: ["e6"], color: "green",  label: "仓储班" },
      { id: "rt5-c14", areaId: "rt5-area2", dayIndex: 3,  startTime: "07:00", endTime: "15:00", employeeIds: ["e6"], color: "green",  label: "仓储班" },
      { id: "rt5-c15", areaId: "rt5-area2", dayIndex: 4,  startTime: "07:00", endTime: "15:00", employeeIds: ["e6"], color: "green",  label: "仓储班" },
      // 第一周 客户服务
      { id: "rt5-c16", areaId: "rt5-area3", dayIndex: 0,  startTime: "09:00", endTime: "17:00", employeeIds: ["e3"], color: "orange", label: "客服日班" },
      { id: "rt5-c17", areaId: "rt5-area3", dayIndex: 1,  startTime: "09:00", endTime: "17:00", employeeIds: ["e3"], color: "orange", label: "客服日班" },
      { id: "rt5-c18", areaId: "rt5-area3", dayIndex: 2,  startTime: "09:00", endTime: "17:00", employeeIds: ["e3"], color: "orange", label: "客服日班" },
      { id: "rt5-c19", areaId: "rt5-area3", dayIndex: 3,  startTime: "09:00", endTime: "17:00", employeeIds: ["e3"], color: "orange", label: "客服日班" },
      { id: "rt5-c20", areaId: "rt5-area3", dayIndex: 4,  startTime: "09:00", endTime: "17:00", employeeIds: ["e3"], color: "orange", label: "客服日班" },
      // 第二周 前台（员工交替）
      { id: "rt5-c21", areaId: "rt5-area1", dayIndex: 7,  startTime: "08:00", endTime: "16:00", employeeIds: ["e2"], color: "blue",   label: "早班" },
      { id: "rt5-c22", areaId: "rt5-area1", dayIndex: 8,  startTime: "08:00", endTime: "16:00", employeeIds: ["e1"], color: "blue",   label: "早班" },
      { id: "rt5-c23", areaId: "rt5-area1", dayIndex: 9,  startTime: "08:00", endTime: "16:00", employeeIds: ["e2"], color: "blue",   label: "早班" },
      { id: "rt5-c24", areaId: "rt5-area1", dayIndex: 10, startTime: "08:00", endTime: "16:00", employeeIds: ["e1"], color: "blue",   label: "早班" },
      { id: "rt5-c25", areaId: "rt5-area1", dayIndex: 11, startTime: "08:00", endTime: "16:00", employeeIds: ["e2"], color: "blue",   label: "早班" },
      { id: "rt5-c26", areaId: "rt5-area1", dayIndex: 7,  startTime: "16:00", endTime: "22:00", employeeIds: ["e6"], color: "purple", label: "晚班" },
      { id: "rt5-c27", areaId: "rt5-area1", dayIndex: 8,  startTime: "16:00", endTime: "22:00", employeeIds: ["e3"], color: "purple", label: "晚班" },
      { id: "rt5-c28", areaId: "rt5-area1", dayIndex: 9,  startTime: "16:00", endTime: "22:00", employeeIds: ["e6"], color: "purple", label: "晚班" },
      { id: "rt5-c29", areaId: "rt5-area1", dayIndex: 10, startTime: "16:00", endTime: "22:00", employeeIds: ["e3"], color: "purple", label: "晚班" },
      { id: "rt5-c30", areaId: "rt5-area1", dayIndex: 11, startTime: "16:00", endTime: "22:00", employeeIds: ["e6"], color: "purple", label: "晚班" },
      // 第三周 前台
      { id: "rt5-c31", areaId: "rt5-area1", dayIndex: 14, startTime: "08:00", endTime: "16:00", employeeIds: ["e1"], color: "blue",   label: "早班" },
      { id: "rt5-c32", areaId: "rt5-area1", dayIndex: 15, startTime: "08:00", endTime: "16:00", employeeIds: ["e2"], color: "blue",   label: "早班" },
      { id: "rt5-c33", areaId: "rt5-area1", dayIndex: 16, startTime: "08:00", endTime: "16:00", employeeIds: ["e1"], color: "blue",   label: "早班" },
      { id: "rt5-c34", areaId: "rt5-area1", dayIndex: 17, startTime: "08:00", endTime: "16:00", employeeIds: ["e2"], color: "blue",   label: "早班" },
      { id: "rt5-c35", areaId: "rt5-area1", dayIndex: 18, startTime: "08:00", endTime: "16:00", employeeIds: ["e1"], color: "blue",   label: "早班" },
      // 第四周 前台
      { id: "rt5-c36", areaId: "rt5-area1", dayIndex: 21, startTime: "08:00", endTime: "16:00", employeeIds: ["e2"], color: "blue",   label: "早班" },
      { id: "rt5-c37", areaId: "rt5-area1", dayIndex: 22, startTime: "08:00", endTime: "16:00", employeeIds: ["e1"], color: "blue",   label: "早班" },
      { id: "rt5-c38", areaId: "rt5-area1", dayIndex: 23, startTime: "08:00", endTime: "16:00", employeeIds: ["e2"], color: "blue",   label: "早班" },
      { id: "rt5-c39", areaId: "rt5-area1", dayIndex: 24, startTime: "08:00", endTime: "16:00", employeeIds: ["e1"], color: "blue",   label: "早班" },
      { id: "rt5-c40", areaId: "rt5-area1", dayIndex: 25, startTime: "08:00", endTime: "16:00", employeeIds: ["e2"], color: "blue",   label: "早班" },
    ],
  },
];

const uniqueValues = (values: string[]) =>
  values.filter((value, index) => value && values.indexOf(value) === index);

const resolveAreaIdByStoreAndName = (storeId: string, areaName: string) =>
  mockScheduleAreas.find((area) => area.storeId === storeId && area.name === areaName)?.id || "";

const normalizeLegacyTemplate = (template: LegacyRosterTemplate): RosterTemplate => {
  const areaIdMap: Record<string, string> = {};

  template.areas.forEach((area) => {
    areaIdMap[area.id] = resolveAreaIdByStoreAndName(template.storeId, area.name);
  });

  return {
    id: template.id,
    name: template.name,
    storeId: template.storeId,
    totalDays: template.totalDays,
    status: template.status,
    shifts: template.shifts,
    areaIds: uniqueValues(template.areas.map((area) => areaIdMap[area.id])),
    cells: template.cells.map((cell) => ({
      ...cell,
      areaId: areaIdMap[cell.areaId] || cell.areaId,
    })),
  };
};

const mockRosterTemplates: RosterTemplate[] = legacyMockRosterTemplates.map(normalizeLegacyTemplate);

// ─── Mock Schedule Shifts（当前周 + 上周各若干条）────────────────────────────

function getDateStr(offsetDays: number): string {
  const d = new Date();
  // Align to Monday of current week
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  monday.setDate(monday.getDate() + offsetDays);
  return monday.toISOString().slice(0, 10);
}

const mockScheduleShifts: ScheduleShift[] = [
  // 本周 Mon
  { id: "sh001", employeeId: "e1", employeeIds: ["e1"], areaId: "area1", storeId: "s1", date: getDateStr(0), startTime: "08:00", endTime: "16:00", breakMinutes: 30, shiftName: "早班", color: "blue",   note: "来自模版: 标准周排班", status: "published" },
  { id: "sh002", employeeId: "e3", employeeIds: ["e3"], areaId: "area1", storeId: "s1", date: getDateStr(0), startTime: "16:00", endTime: "22:00", breakMinutes: 30, shiftName: "晚班", color: "purple", note: "来自模版: 标准周排班", status: "published" },
  { id: "sh003", employeeId: "e6", employeeIds: ["e6"], areaId: "area2", storeId: "s1", date: getDateStr(0), startTime: "07:00", endTime: "15:00", breakMinutes: 30, shiftName: "仓储早班", color: "green", note: "", status: "published" },
  // 本周 Tue
  { id: "sh004", employeeId: "e2", employeeIds: ["e2"], areaId: "area1", storeId: "s1", date: getDateStr(1), startTime: "08:00", endTime: "16:00", breakMinutes: 30, shiftName: "早班", color: "blue",   note: "", status: "published" },
  { id: "sh005", employeeId: "e6", employeeIds: ["e6"], areaId: "area1", storeId: "s1", date: getDateStr(1), startTime: "16:00", endTime: "22:00", breakMinutes: 30, shiftName: "晚班", color: "purple", note: "", status: "published" },
  { id: "sh006", employeeId: "e3", employeeIds: ["e3"], areaId: "area3", storeId: "s1", date: getDateStr(1), startTime: "09:00", endTime: "17:00", breakMinutes: 30, shiftName: "客服日班", color: "orange", note: "", status: "draft" },
  // 本周 Wed
  { id: "sh007", employeeId: "e1", employeeIds: ["e1"], areaId: "area1", storeId: "s1", date: getDateStr(2), startTime: "08:00", endTime: "16:00", breakMinutes: 30, shiftName: "早班", color: "blue",   note: "", status: "published" },
  { id: "sh008", employeeId: "e3", employeeIds: ["e3"], areaId: "area1", storeId: "s1", date: getDateStr(2), startTime: "16:00", endTime: "22:00", breakMinutes: 30, shiftName: "晚班", color: "purple", note: "", status: "draft" },
  // 本周 Thu
  { id: "sh009", employeeId: "e2", employeeIds: ["e2"], areaId: "area1", storeId: "s1", date: getDateStr(3), startTime: "08:00", endTime: "16:00", breakMinutes: 30, shiftName: "早班", color: "blue",   note: "", status: "draft" },
  { id: "sh010", employeeId: "e6", employeeIds: ["e6"], areaId: "area2", storeId: "s1", date: getDateStr(3), startTime: "07:00", endTime: "15:00", breakMinutes: 30, shiftName: "仓储早班", color: "green", note: "", status: "draft" },
  // 本周 Fri
  { id: "sh011", employeeId: "e1", employeeIds: ["e1", "e2"], areaId: "area1", storeId: "s1", date: getDateStr(4), startTime: "08:00", endTime: "16:00", breakMinutes: 30, shiftName: "早班", color: "blue",   note: "高峰班次", status: "draft" },
  { id: "sh012", employeeId: "e2", employeeIds: ["e2"], areaId: "area3", storeId: "s1", date: getDateStr(4), startTime: "17:00", endTime: "22:00", breakMinutes: 0,  shiftName: "晚班", color: "purple", note: "", status: "draft" },
  // 本周 Sat
  { id: "sh013", employeeId: "e4", employeeIds: ["e4"], areaId: "area1", storeId: "s1", date: getDateStr(5), startTime: "09:00", endTime: "18:00", breakMinutes: 30, shiftName: "周末班", color: "orange", note: "", status: "draft" },
  { id: "sh014", employeeId: "e6", employeeIds: ["e6"], areaId: "area3", storeId: "s1", date: getDateStr(5), startTime: "10:00", endTime: "17:00", breakMinutes: 30, shiftName: "客服值班", color: "green", note: "", status: "draft" },
  // 本周 Sun
  { id: "sh015", employeeId: "e4", employeeIds: ["e4"], areaId: "area1", storeId: "s1", date: getDateStr(6), startTime: "10:00", endTime: "18:00", breakMinutes: 30, shiftName: "周末班", color: "orange", note: "", status: "draft" },
];

interface PersistedDataSnapshot {
  employees: Employee[];
  stores: Store[];
  scheduleShifts: ScheduleShift[];
  areas: Area[];
  rosterTemplates: RosterTemplate[];
}

const getDefaultDataSnapshot = (): PersistedDataSnapshot => ({
  employees: [],
  stores: [],
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

const getContextStoreIds = (selectedStoreId: string, storeItems: Store[]) => {
  if (selectedStoreId && selectedStoreId !== "all") return [selectedStoreId];
  return storeItems.map((store) => store.id).filter(Boolean);
};

const isSameShiftDefinition = (a: ScheduleShift, b: Pick<ScheduleShift, "shiftName" | "startTime" | "endTime" | "color" | "storeId" | "shiftType">) =>
  (a.shiftName || "").trim() === (b.shiftName || "").trim() &&
  a.startTime === b.startTime &&
  a.endTime === b.endTime &&
  (a.color || "") === (b.color || "") &&
  (a.shiftType || "store") === (b.shiftType || "store") &&
  ((a.shiftType || "store") === "general" || a.storeId === b.storeId);

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
    color?: string;
  }[],
});

const makeTemplateCellShift = (cell: RosterTemplateCell, storeId: string): ScheduleShift => ({
  id: cell.shiftId ? `global-${cell.shiftId}` : `template-cell-${cell.id}`,
  shiftId: cell.shiftId,
  employeeId: "",
  employeeIds: cell.employeeIds || [],
  areaId: cell.areaId,
  storeId,
  shiftType: "store",
  date: "",
  startTime: cell.startTime,
  endTime: cell.endTime,
  breakMinutes: 30,
  shiftName: cell.label || cell.startTime,
  color: cell.color,
  note: "",
  status: "published",
});

const DataContext = createContext<DataContextType>({
  loading: false,
  error: "",
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
  const [scheduleShifts, setScheduleShifts] = useState<ScheduleShift[]>(initialData.scheduleShifts);
  const [areas, setAreas] = useState<Area[]>(initialData.areas);
  const [rosterTemplates, setRosterTemplates] = useState<RosterTemplate[]>(initialData.rosterTemplates);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const currentStoreContextRef = useRef("all");
  const loadSeqRef = useRef(0);

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

  const loadData = useCallback(async (storeContext = currentStoreContextRef.current) => {
    if (permissionsLoading) return;

    if (status !== "authenticated") {
      setEmployees([]);
      setStores([]);
      setScheduleShifts([]);
      setAreas([]);
      setRosterTemplates([]);
      return;
    }

    const seq = loadSeqRef.current + 1;
    loadSeqRef.current = seq;
    setLoading(true);
    setError("");

    try {
      const nextStores = await merchantApi.listStores();
      const contextStoreIds = getContextStoreIds(storeContext, nextStores);

      const [
        employeeGroups,
        areaGroups,
        globalShiftGroups,
        scheduleGroups,
        templateGroups,
      ] = await Promise.all([
        Promise.all(contextStoreIds.map((storeId) => merchantApi.listEmployees(storeId))),
        Promise.all(contextStoreIds.map((storeId) => merchantApi.listAreas(storeId))),
        Promise.all(contextStoreIds.map((storeId) => merchantApi.listGlobalShifts(storeId))),
        Promise.all(contextStoreIds.map((storeId) => merchantApi.getSchedule(storeId))),
        Promise.all(contextStoreIds.map((storeId) => loadTemplatesForStore(storeId))),
      ]);

      if (loadSeqRef.current !== seq) return;

      setStores(nextStores);
      setEmployees(dedupeById(employeeGroups.flat()));
      setAreas(dedupeById(areaGroups.flat()));
      setRosterTemplates(dedupeById(templateGroups.flat()));
      setScheduleShifts(dedupeById([...globalShiftGroups.flat(), ...scheduleGroups.flat()]));
    } catch (loadError) {
      const message = getOperationMessage(loadError, "加载数据失败");
      console.warn("[DataContext] failed to load backend data:", loadError);
      if (loadSeqRef.current === seq) setError(message);
    } finally {
      if (loadSeqRef.current === seq) setLoading(false);
    }
  }, [loadTemplatesForStore, permissionsLoading, status]);

  const refreshData = useCallback(() => loadData(currentStoreContextRef.current), [loadData]);

  const reloadForStore = useCallback((storeId: string) => {
    currentStoreContextRef.current = storeId || "all";
    return loadData(currentStoreContextRef.current);
  }, [loadData]);

  useEffect(() => {
    if (status === "authenticated" && !permissionsLoading) {
      refreshData();
    } else {
      queueMicrotask(() => {
        setEmployees([]);
        setStores([]);
        setScheduleShifts([]);
        setAreas([]);
        setRosterTemplates([]);
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
    if (!existingId && !employee.password) {
      throw new Error("创建员工需要设置初始密码");
    }
    const saved = existingId
      ? await merchantApi.updateEmployee(existingId, employee)
      : await merchantApi.createEmployee(employee);
    setEmployees((prev) => existingId
      ? prev.map((item) => item.id === existingId ? saved : item)
      : [...prev, saved]);
    return saved;
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

  const ensureGlobalShiftId = useCallback(async (shift: ScheduleShift, targetStoreId: string) => {
    if (isBackendId(shift.shiftId)) return shift.shiftId as string;

    const normalizedShift: ScheduleShift = {
      ...shift,
      storeId: (shift.shiftType || "store") === "general" ? "" : (shift.storeId || targetStoreId),
      shiftType: shift.shiftType || "store",
    };

    const matched = scheduleShifts.find((item) =>
      item.shiftId &&
      item.isGlobalPreset &&
      isSameShiftDefinition(item, normalizedShift)
    );
    if (matched?.shiftId) return matched.shiftId;

    const created = await merchantApi.createGlobalShift(normalizedShift);
    setScheduleShifts((prev) => dedupeById([...prev, created]));
    return created.shiftId || created.id.replace(/^global-/, "");
  }, [scheduleShifts]);

  const saveGlobalShift = useCallback(async (shift: ScheduleShift, existingShiftId?: string) => {
    const saved = existingShiftId
      ? await merchantApi.updateGlobalShift(existingShiftId, shift)
      : await merchantApi.createGlobalShift(shift);
    setScheduleShifts((prev) => existingShiftId
      ? prev.map((item) => item.shiftId === existingShiftId ? saved : item)
      : dedupeById([...prev, saved]));
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

      const shiftId = await ensureGlobalShiftId(shift, storeId);
      payload.cells.push({
        areaId: requireNumericId(shift.areaId, "区域"),
        shiftId: requireNumericId(shiftId, "班次"),
        date_str: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        employeesIds: (shift.employeeIds || []).map((id) => requireNumericId(id, "员工")),
        color: shift.color,
      });
    }

    return payload;
  }, [areas, ensureGlobalShiftId]);

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
      if (cell.dayIndex < 0 || cell.dayIndex > 6) continue;
      const shiftId = await ensureGlobalShiftId(makeTemplateCellShift(cell, storeId), storeId);
      cells.push({
        areaId: requireNumericId(cell.areaId, "区域"),
        shiftsId: requireNumericId(shiftId, "班次"),
        weekDay: cell.dayIndex + 1,
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
  }, [areas, ensureGlobalShiftId, stores]);

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
    await merchantApi.deleteScheduleTemplate(id);
    setRosterTemplates((prev) => prev.filter((template) => template.id !== id));
  }, []);

  return (
    <DataContext.Provider value={{
      loading, error, refreshData, reloadForStore,
      employees, setEmployees,
      saveEmployee, deleteEmployee,
      stores, setStores,
      saveStore, deleteStore,
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

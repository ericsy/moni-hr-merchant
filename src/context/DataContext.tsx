import React, { createContext, useContext, useEffect, useState } from "react";

export interface WorkDayPattern {
  dayIndex: number; // 0=Mon,1=Tue,...6=Sun
  state: "on" | "off" | "none"; // on=working, off=non-working, none=not set
  hours: number;
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
  employees: Employee[];
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  stores: Store[];
  setStores: React.Dispatch<React.SetStateAction<Store[]>>;
  scheduleShifts: ScheduleShift[];
  setScheduleShifts: React.Dispatch<React.SetStateAction<ScheduleShift[]>>;
  areas: Area[];
  setAreas: React.Dispatch<React.SetStateAction<Area[]>>;
  scheduleAreas: Area[];
  setScheduleAreas: React.Dispatch<React.SetStateAction<Area[]>>;
  rosterTemplates: RosterTemplate[];
  setRosterTemplates: React.Dispatch<React.SetStateAction<RosterTemplate[]>>;
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

const DATA_STORAGE_KEY = "moni-hr:data-context:v1";

interface PersistedDataSnapshot {
  employees: Employee[];
  stores: Store[];
  scheduleShifts: ScheduleShift[];
  areas: Area[];
  rosterTemplates: RosterTemplate[];
}

const getDefaultDataSnapshot = (): PersistedDataSnapshot => ({
  employees: mockEmployees,
  stores: mockStores,
  scheduleShifts: mockScheduleShifts,
  areas: mockScheduleAreas,
  rosterTemplates: mockRosterTemplates,
});

const loadPersistedDataSnapshot = (): PersistedDataSnapshot => {
  if (typeof window === "undefined") {
    return getDefaultDataSnapshot();
  }

  try {
    const raw = window.localStorage.getItem(DATA_STORAGE_KEY);
    if (!raw) {
      return getDefaultDataSnapshot();
    }

    const parsed = JSON.parse(raw) as Partial<PersistedDataSnapshot>;

    return {
      employees: Array.isArray(parsed.employees) ? parsed.employees : mockEmployees,
      stores: Array.isArray(parsed.stores) ? parsed.stores : mockStores,
      scheduleShifts: Array.isArray(parsed.scheduleShifts) ? parsed.scheduleShifts : mockScheduleShifts,
      areas: Array.isArray(parsed.areas) ? parsed.areas : mockScheduleAreas,
      rosterTemplates: Array.isArray(parsed.rosterTemplates) ? parsed.rosterTemplates : mockRosterTemplates,
    };
  } catch (error) {
    console.warn("[DataContext] failed to load persisted data, fallback to mock data", error);
    return getDefaultDataSnapshot();
  }
};

const persistDataSnapshot = (snapshot: PersistedDataSnapshot) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.warn("[DataContext] failed to persist data snapshot", error);
  }
};

const DataContext = createContext<DataContextType>({
  employees: mockEmployees,
  setEmployees: () => {},
  stores: mockStores,
  setStores: () => {},
  scheduleShifts: mockScheduleShifts,
  setScheduleShifts: () => {},
  areas: mockScheduleAreas,
  setAreas: () => {},
  scheduleAreas: mockScheduleAreas,
  setScheduleAreas: () => {},
  rosterTemplates: mockRosterTemplates,
  setRosterTemplates: () => {},
  templates: mockRosterTemplates,
});

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [initialData] = useState<PersistedDataSnapshot>(() => loadPersistedDataSnapshot());
  const [employees, setEmployees] = useState<Employee[]>(initialData.employees);
  const [stores, setStores] = useState<Store[]>(initialData.stores);
  const [scheduleShifts, setScheduleShifts] = useState<ScheduleShift[]>(initialData.scheduleShifts);
  const [areas, setAreas] = useState<Area[]>(initialData.areas);
  const [rosterTemplates, setRosterTemplates] = useState<RosterTemplate[]>(initialData.rosterTemplates);

  useEffect(() => {
    persistDataSnapshot({
      employees,
      stores,
      scheduleShifts,
      areas,
      rosterTemplates,
    });
  }, [employees, stores, scheduleShifts, areas, rosterTemplates]);

  return (
    <DataContext.Provider value={{
      employees, setEmployees,
      stores, setStores,
      scheduleShifts, setScheduleShifts,
      areas, setAreas,
      scheduleAreas: areas, setScheduleAreas: setAreas,
      rosterTemplates, setRosterTemplates,
      templates: rosterTemplates,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}

import type {
  RosterTemplate,
  RosterTemplateCell,
  ScheduleShift,
} from "../context/DataContext";

export type RosterGridViewMode = "area" | "employee";

export const ROSTER_UNASSIGNED_ROW_ID = "__roster_unassigned__";

export function getShiftEmployeeIds(
  shift: Pick<ScheduleShift, "employeeId" | "employeeIds">,
): string[] {
  return shift.employeeIds?.length
    ? shift.employeeIds
    : shift.employeeId
      ? [shift.employeeId]
      : [];
}

export function shiftMatchesStore(
  shift: Pick<ScheduleShift, "storeId" | "isGlobalPreset">,
  storeId?: string,
): boolean {
  if (shift.isGlobalPreset) return false;
  return !storeId || shift.storeId === storeId;
}

export function filterShiftsForEmployeeOnDate(
  shifts: ScheduleShift[],
  empId: string,
  dateStr: string,
  storeId?: string,
): ScheduleShift[] {
  return shifts.filter(
    (s) =>
      s.date === dateStr &&
      shiftMatchesStore(s, storeId) &&
      getShiftEmployeeIds(s).includes(empId),
  );
}

export function filterUnassignedShiftsOnDate(
  shifts: ScheduleShift[],
  dateStr: string,
  storeId?: string,
): ScheduleShift[] {
  return shifts.filter(
    (s) =>
      s.date === dateStr &&
      shiftMatchesStore(s, storeId) &&
      getShiftEmployeeIds(s).length === 0,
  );
}

export function filterCellsForEmployeeOnDay(
  cells: RosterTemplateCell[],
  empId: string,
  dayIndex: number,
): RosterTemplateCell[] {
  return cells.filter(
    (c) =>
      c.dayIndex === dayIndex && (c.employeeIds || []).includes(empId),
  );
}

export function filterUnassignedCellsOnDay(
  cells: RosterTemplateCell[],
  dayIndex: number,
): RosterTemplateCell[] {
  return cells.filter(
    (c) => c.dayIndex === dayIndex && !(c.employeeIds || []).length,
  );
}

export function readStoredGridViewMode(
  storageKey: string,
  fallback: RosterGridViewMode = "area",
): RosterGridViewMode {
  try {
    const value = localStorage.getItem(storageKey);
    return value === "employee" ? "employee" : fallback;
  } catch {
    return fallback;
  }
}

export function storeGridViewMode(
  storageKey: string,
  mode: RosterGridViewMode,
): void {
  try {
    localStorage.setItem(storageKey, mode);
  } catch {
    /* ignore */
  }
}

export type ShiftModalMode = "area" | "employee";

export function makeScheduleShiftSlotKey(
  shift: Pick<
    ScheduleShift,
    "areaId" | "date" | "startTime" | "endTime"
  >,
): string {
  return `${shift.areaId}|${shift.date}|${shift.startTime}|${shift.endTime}`;
}

export function makeTemplateCellSlotKey(
  cell: Pick<
    RosterTemplateCell,
    "areaId" | "dayIndex" | "startTime" | "endTime"
  >,
): string {
  return `${cell.areaId}|${cell.dayIndex}|${cell.startTime}|${cell.endTime}`;
}

export function mergeUniqueEmployeeIds(
  ...groups: Array<string[] | undefined>
): string[] {
  return Array.from(
    new Set(groups.flatMap((group) => group || []).filter(Boolean)),
  );
}

export function getWeekScheduleMemberEmployeeIds(
  shifts: ScheduleShift[],
  weekFromStr: string,
  weekToStr: string,
  storeId?: string,
  memberIds: string[] = [],
): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();

  const add = (id: string) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    ordered.push(id);
  };

  memberIds.forEach(add);
  shifts.forEach((shift) => {
    if (!shiftMatchesStore(shift, storeId)) return;
    const date = (shift.date || "").slice(0, 10);
    if (!date || date < weekFromStr || date > weekToStr) return;
    getShiftEmployeeIds(shift).forEach(add);
  });

  return ordered;
}

/** 模版成员（有序）：先按 employeeIds 顺序，格子中额外出现的员工追加到末尾 */
export function getTemplateMemberEmployeeIds(
  template: Pick<RosterTemplate, "employeeIds" | "cells"> | null | undefined,
): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();

  const add = (id: string) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    ordered.push(id);
  };

  (template?.employeeIds || []).forEach(add);
  (template?.cells || []).forEach((cell) => {
    (cell.employeeIds || []).forEach(add);
  });
  return ordered;
}

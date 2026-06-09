import type { RosterTemplateCell, ScheduleShift } from "../context/DataContext";

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
    "areaId" | "date" | "startTime" | "endTime" | "shiftId" | "shiftName"
  >,
): string {
  const shiftPart = (shift.shiftId || shift.shiftName || "").trim();
  return `${shift.areaId}|${shift.date}|${shift.startTime}|${shift.endTime}|${shiftPart}`;
}

export function makeTemplateCellSlotKey(
  cell: Pick<
    RosterTemplateCell,
    "areaId" | "dayIndex" | "startTime" | "endTime" | "shiftId" | "label"
  >,
): string {
  const shiftPart = (cell.shiftId || cell.label || "").trim();
  return `${cell.areaId}|${cell.dayIndex}|${cell.startTime}|${cell.endTime}|${shiftPart}`;
}

export function mergeUniqueEmployeeIds(
  ...groups: Array<string[] | undefined>
): string[] {
  return Array.from(
    new Set(groups.flatMap((group) => group || []).filter(Boolean)),
  );
}

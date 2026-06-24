import dayjs, { type Dayjs } from "dayjs";
import type { EmployeeDateLeave, EmployeeShiftLeave } from "./merchantApi";
import { intervalsOverlap } from "./fieldServiceAssign";

function normalizeTime(value: string) {
  return (value || "").trim().slice(0, 5);
}

function buildDateTimeRange(
  date: string,
  startTime: string,
  endTime: string,
): { start: Dayjs; end: Dayjs } | null {
  const normalizedDate = date.slice(0, 10);
  const start = dayjs(`${normalizedDate}T${normalizeTime(startTime)}`);
  let end = dayjs(`${normalizedDate}T${normalizeTime(endTime)}`);
  if (!start.isValid() || !end.isValid()) return null;
  if (!end.isAfter(start)) end = end.add(1, "day");
  return { start, end };
}

export function getShiftLeaveDateTimeRange(leave: EmployeeShiftLeave) {
  const date = (leave.scheduleDate ?? "").slice(0, 10);
  if (!date) return null;

  const shiftStart = normalizeTime(leave.shiftStartTime ?? "");
  const shiftEnd = normalizeTime(leave.shiftEndTime ?? "");
  const partialStart = normalizeTime(leave.partialStartTime ?? "");
  const partialEnd = normalizeTime(leave.partialEndTime ?? "");
  const effect = (leave.leaveEffect ?? "").trim();

  if (effect === "late_in") {
    return buildDateTimeRange(date, shiftStart, partialEnd);
  }
  if (effect === "early_out") {
    return buildDateTimeRange(date, partialStart, shiftEnd);
  }
  return buildDateTimeRange(date, shiftStart, shiftEnd);
}

function isActiveDateLeave(status: string | null | undefined) {
  const normalized = (status ?? "").trim().toLowerCase();
  return normalized === "approved" || normalized === "pending";
}

export function isEmployeeOnLeaveForWindow(
  employeeId: string,
  windowStart: Dayjs,
  windowEnd: Dayjs,
  dateLeaves: EmployeeDateLeave[],
  shiftLeaves: EmployeeShiftLeave[],
) {
  const empId = String(employeeId);
  const jobDate = windowStart.format("YYYY-MM-DD");

  for (const leave of dateLeaves) {
    if (String(leave.merchantAdminId) !== empId) continue;
    if (!isActiveDateLeave(leave.status)) continue;

    const from = (leave.leaveDateFrom ?? "").slice(0, 10);
    const to = (leave.leaveDateTo ?? "").slice(0, 10);
    if (!from || !to) continue;
    if (jobDate >= from && jobDate <= to) return true;
  }

  for (const leave of shiftLeaves) {
    if (String(leave.merchantAdminId) !== empId) continue;

    const leaveDate = (leave.scheduleDate ?? "").slice(0, 10);
    if (!leaveDate) continue;
    const jobStartDate = windowStart.format("YYYY-MM-DD");
    const jobEndDate = windowEnd.format("YYYY-MM-DD");
    if (jobStartDate !== leaveDate && jobEndDate !== leaveDate) continue;

    const leaveRange = getShiftLeaveDateTimeRange(leave);
    if (!leaveRange) continue;
    if (intervalsOverlap(windowStart, windowEnd, leaveRange.start, leaveRange.end)) {
      return true;
    }
  }

  return false;
}

export function filterLeavesForStore<T extends { storeId?: string | number | null }>(
  leaves: T[],
  storeId: string,
) {
  if (!storeId) return leaves;
  return leaves.filter((leave) => !leave.storeId || String(leave.storeId) === String(storeId));
}

export function filterEmployeesAvailableForFieldJob(
  employees: Array<{ id: string; name: string }>,
  scheduledStart: string,
  scheduledEnd: string,
  dateLeaves: EmployeeDateLeave[],
  shiftLeaves: EmployeeShiftLeave[],
  options?: { includeEmployeeId?: string },
) {
  const windowStart = dayjs(scheduledStart);
  const windowEnd = dayjs(scheduledEnd);
  if (!windowStart.isValid() || !windowEnd.isValid()) return employees;

  const available = employees.filter(
    (employee) =>
      !isEmployeeOnLeaveForWindow(
        employee.id,
        windowStart,
        windowEnd,
        dateLeaves,
        shiftLeaves,
      ),
  );

  const includeId = options?.includeEmployeeId;
  if (!includeId || available.some((employee) => employee.id === includeId)) {
    return available;
  }

  const preserved = employees.find((employee) => employee.id === includeId);
  return preserved ? [preserved, ...available] : available;
}

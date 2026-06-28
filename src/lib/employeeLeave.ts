import dayjs, { type Dayjs } from "dayjs";
import type { EmployeeDateLeave, EmployeeShiftLeave } from "./merchantApi";
import { intervalsOverlap } from "./fieldServiceAssign";
import type { FieldServiceJob } from "../types/fieldService";
import { getFieldJobAssignmentEmployeeIds } from "./fieldJobEmployees";

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

function isActiveAssignedFieldJob(job: FieldServiceJob) {
  if (job.status === "cancelled" || job.status === "completed") return false;
  return getFieldJobAssignmentEmployeeIds(job).length > 0;
}

/** 两段时间重叠视为冲突（不要求首尾间隔） */
export function fieldJobTimeWindowsConflict(
  startA: Dayjs,
  endA: Dayjs,
  startB: Dayjs,
  endB: Dayjs,
) {
  return intervalsOverlap(startA, endA, startB, endB);
}

export function isEmployeeConflictingWithFieldJobs(
  employeeId: string,
  windowStart: Dayjs,
  windowEnd: Dayjs,
  existingJobs: FieldServiceJob[],
  options?: { excludeJobId?: string },
) {
  const empId = String(employeeId);
  const excludeJobId = options?.excludeJobId;

  for (const job of existingJobs) {
    if (excludeJobId && job.id === excludeJobId) continue;
    if (!isActiveAssignedFieldJob(job)) continue;
    if (!getFieldJobAssignmentEmployeeIds(job).includes(empId)) continue;

    const jobStart = dayjs(job.scheduledStart);
    const jobEnd = dayjs(job.scheduledEnd);
    if (!jobStart.isValid() || !jobEnd.isValid()) continue;

    if (fieldJobTimeWindowsConflict(windowStart, windowEnd, jobStart, jobEnd)) {
      return true;
    }
  }

  return false;
}

export type EmployeeFieldJobBlockReason = "leave" | "field_job_conflict";

export interface EmployeeFieldJobBlockInfo {
  reason: EmployeeFieldJobBlockReason;
  conflictingJob?: FieldServiceJob;
}

export function getEmployeeFieldJobBlockInfo(
  employeeId: string,
  scheduledStart: string,
  scheduledEnd: string,
  dateLeaves: EmployeeDateLeave[],
  shiftLeaves: EmployeeShiftLeave[],
  existingJobs: FieldServiceJob[],
  options?: { excludeJobId?: string },
): EmployeeFieldJobBlockInfo | null {
  const windowStart = dayjs(scheduledStart);
  const windowEnd = dayjs(scheduledEnd);
  if (!windowStart.isValid() || !windowEnd.isValid()) return null;

  if (
    isEmployeeOnLeaveForWindow(
      employeeId,
      windowStart,
      windowEnd,
      dateLeaves,
      shiftLeaves,
    )
  ) {
    return { reason: "leave" };
  }

  const excludeJobId = options?.excludeJobId;
  const empId = String(employeeId);

  for (const job of existingJobs) {
    if (excludeJobId && job.id === excludeJobId) continue;
    if (!isActiveAssignedFieldJob(job)) continue;
    if (!getFieldJobAssignmentEmployeeIds(job).includes(empId)) continue;

    const jobStart = dayjs(job.scheduledStart);
    const jobEnd = dayjs(job.scheduledEnd);
    if (!jobStart.isValid() || !jobEnd.isValid()) continue;

    if (fieldJobTimeWindowsConflict(windowStart, windowEnd, jobStart, jobEnd)) {
      return { reason: "field_job_conflict", conflictingJob: job };
    }
  }

  return null;
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
  options?: {
    includeEmployeeIds?: string[];
    existingJobs?: FieldServiceJob[];
    excludeJobId?: string;
  },
) {
  const windowStart = dayjs(scheduledStart);
  const windowEnd = dayjs(scheduledEnd);
  if (!windowStart.isValid() || !windowEnd.isValid()) return employees;

  const existingJobs = options?.existingJobs ?? [];

  const available = employees.filter((employee) => {
    if (
      isEmployeeOnLeaveForWindow(
        employee.id,
        windowStart,
        windowEnd,
        dateLeaves,
        shiftLeaves,
      )
    ) {
      return false;
    }

    if (
      isEmployeeConflictingWithFieldJobs(
        employee.id,
        windowStart,
        windowEnd,
        existingJobs,
        { excludeJobId: options?.excludeJobId },
      )
    ) {
      return false;
    }

    return true;
  });

  const includeIds = (options?.includeEmployeeIds ?? []).filter(Boolean);
  if (includeIds.length === 0) {
    return available;
  }

  const preserved = includeIds
    .filter((employeeId) => !available.some((employee) => employee.id === employeeId))
    .map((employeeId) => employees.find((employee) => employee.id === employeeId))
    .filter((employee): employee is { id: string; name: string } => Boolean(employee));

  return preserved.length > 0 ? [...preserved, ...available] : available;
}

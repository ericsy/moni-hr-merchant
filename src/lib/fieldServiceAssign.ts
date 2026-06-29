import dayjs from "dayjs";
import type { FieldJobAssignPreview, FieldJobStoreShiftBrief, FieldServiceJob } from "../types/fieldService";
import type { ScheduleShift } from "../context/DataContext";

export function combineDateAndTime(date: string, time: string) {
  const normalizedDate = dayjs(date).format("YYYY-MM-DD");
  const normalizedTime = (time || "00:00").slice(0, 5);
  return dayjs(`${normalizedDate}T${normalizedTime}:00`);
}

export function intervalsOverlap(startA: dayjs.Dayjs, endA: dayjs.Dayjs, startB: dayjs.Dayjs, endB: dayjs.Dayjs) {
  return startA.isBefore(endB) && endA.isAfter(startB);
}

export function findEmployeeStoreShiftOnDate(
  shifts: ScheduleShift[],
  employeeId: string,
  date: string,
  storeNameById: Record<string, string>,
): FieldJobStoreShiftBrief | null {
  const targetDate = dayjs(date).format("YYYY-MM-DD");
  const matched = shifts
    .filter((shift) => {
      const shiftDate = dayjs(shift.date).format("YYYY-MM-DD");
      if (shiftDate !== targetDate) return false;
      const ids = shift.employeeIds?.length ? shift.employeeIds : shift.employeeId ? [shift.employeeId] : [];
      return ids.map(String).includes(String(employeeId));
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (matched.length === 0) return null;
  return toStoreShiftBrief(matched[0], storeNameById);
}

export function findBestOverlappingStoreShiftForEmployee(
  shifts: ScheduleShift[],
  employeeId: string,
  scheduledStart: string,
  scheduledEnd: string,
  storeNameById: Record<string, string>,
): FieldJobStoreShiftBrief | null {
  const jobStart = dayjs(scheduledStart);
  const jobEnd = dayjs(scheduledEnd);
  if (!jobStart.isValid() || !jobEnd.isValid() || !jobEnd.isAfter(jobStart)) {
    return null;
  }

  const matched = shifts
    .filter((shift) => {
      const ids = shift.employeeIds?.length ? shift.employeeIds : shift.employeeId ? [shift.employeeId] : [];
      if (!ids.map(String).includes(String(employeeId))) return false;
      const shiftStart = combineDateAndTime(shift.date, shift.startTime);
      let shiftEnd = combineDateAndTime(shift.date, shift.endTime);
      if (!shiftEnd.isAfter(shiftStart)) {
        shiftEnd = shiftEnd.add(1, "day");
      }
      return intervalsOverlap(jobStart, jobEnd, shiftStart, shiftEnd);
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (matched.length === 0) return null;
  return toStoreShiftBrief(matched[0], storeNameById);
}

function toStoreShiftBrief(shift: ScheduleShift, storeNameById: Record<string, string>) {
  const targetDate = dayjs(shift.date).format("YYYY-MM-DD");
  const start = combineDateAndTime(shift.date, shift.startTime);
  let end = combineDateAndTime(shift.date, shift.endTime);
  if (!end.isAfter(start)) {
    end = end.add(1, "day");
  }
  const cellId = shift.id.startsWith("schedule-") ? shift.id.replace(/^schedule-/, "") : shift.id;

  return {
    id: cellId,
    storeId: shift.storeId,
    storeName: storeNameById[shift.storeId] || shift.storeId,
    date: targetDate,
    start: start.toISOString(),
    end: end.toISOString(),
    startTime: shift.startTime,
    endTime: shift.endTime,
  };
}

export function buildAssignPreview(
  job: Pick<FieldServiceJob, "scheduledStart" | "scheduledEnd">,
  storeShift: FieldJobStoreShiftBrief | null,
  locale: "zh" | "en" = "zh",
): FieldJobAssignPreview {
  if (!storeShift) {
    return {
      hasStoreShift: false,
      storeShift: null,
      overlap: false,
      suggestedSyncStoreClockIn: false,
      suggestedSyncStoreClockOut: false,
      validationWarnings: [],
    };
  }

  const jobStart = dayjs(job.scheduledStart);
  const jobEnd = dayjs(job.scheduledEnd);
  const shiftStart = dayjs(storeShift.start);
  const shiftEnd = dayjs(storeShift.end);
  const overlap = intervalsOverlap(jobStart, jobEnd, shiftStart, shiftEnd);

  const startAligned = jobStart.isSame(shiftStart, "minute");
  const endAligned = jobEnd.isSame(shiftEnd, "minute");
  const coversShift = !jobStart.isAfter(shiftStart, "minute") && !jobEnd.isBefore(shiftEnd, "minute");

  let suggestedSyncStoreClockIn = false;
  let suggestedSyncStoreClockOut = false;

  if (overlap) {
    if (coversShift || startAligned) suggestedSyncStoreClockIn = true;
    if (coversShift || endAligned) suggestedSyncStoreClockOut = true;
    if (coversShift) {
      suggestedSyncStoreClockIn = true;
      suggestedSyncStoreClockOut = true;
    }
    if (overlap && !startAligned && !endAligned && !coversShift) {
      suggestedSyncStoreClockIn = false;
      suggestedSyncStoreClockOut = false;
    }
  }

  return {
    hasStoreShift: true,
    storeShift,
    overlap,
    suggestedSyncStoreClockIn,
    suggestedSyncStoreClockOut,
    validationWarnings: [],
  };
}

export function validateAssignSyncOptions(
  job: Pick<FieldServiceJob, "scheduledStart" | "scheduledEnd">,
  storeShift: FieldJobStoreShiftBrief | null,
  payload: { syncStoreClockIn: boolean; syncStoreClockOut: boolean },
  locale: "zh" | "en" = "zh",
) {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!storeShift) {
    if (payload.syncStoreClockIn || payload.syncStoreClockOut) {
      errors.push(
        locale === "zh"
          ? "该员工当日无店班，不能同步门店打卡"
          : "No store shift today; store punch sync is not available",
      );
    }
    return { valid: errors.length === 0, warnings, errors };
  }

  const jobStart = dayjs(job.scheduledStart);
  const jobEnd = dayjs(job.scheduledEnd);
  const shiftStart = dayjs(storeShift.start);
  const shiftEnd = dayjs(storeShift.end);

  if (payload.syncStoreClockIn && jobStart.isAfter(shiftStart, "minute")) {
    errors.push(
      locale === "zh"
        ? "勾选同步门店上班时，外勤开始时间不能晚于店班开始时间"
        : "Field start must be on or before store shift start when syncing store clock-in",
    );
  }

  if (payload.syncStoreClockOut && jobEnd.isBefore(shiftEnd, "minute")) {
    errors.push(
      locale === "zh"
        ? "勾选同步门店下班时，外勤结束时间不能早于店班结束时间"
        : "Field end must be on or after store shift end when syncing store clock-out",
    );
  }

  if (payload.syncStoreClockIn && payload.syncStoreClockOut) {
    if (jobStart.isAfter(shiftStart, "minute") || jobEnd.isBefore(shiftEnd, "minute")) {
      errors.push(
        locale === "zh"
          ? "同时同步上下班时，外勤时段应覆盖或对齐店班时段"
          : "When syncing both ends, the field job must cover or align with the store shift",
      );
    }
  }

  return { valid: errors.length === 0, warnings, errors };
}

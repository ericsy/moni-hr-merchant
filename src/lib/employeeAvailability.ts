import dayjs from "dayjs";
import type { Employee, TimeSlot } from "../context/DataContext";
import { getClockRange, MINUTES_PER_DAY, toMinutes } from "./shift";

type Locale = "zh" | "en";

type EmployeeAvailabilityInput = Pick<Employee, "firstName" | "lastName" | "workDayPattern">;

interface IndexedShiftAvailabilityInput {
  dayIndex: number;
  startTime: string;
  endTime: string;
}

interface DatedShiftAvailabilityInput {
  date: string;
  startTime: string;
  endTime: string;
}

const WEEKDAY_LABELS_ZH = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const WEEKDAY_LABELS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const getWeekdayLabel = (dayIndex: number, locale: Locale) => {
  const normalized = ((dayIndex % 7) + 7) % 7;
  return (locale === "zh" ? WEEKDAY_LABELS_ZH : WEEKDAY_LABELS_EN)[normalized];
};

const getDetailedDayLabel = (dayIndex: number, locale: Locale) => {
  const weekNumber = Math.floor(dayIndex / 7) + 1;
  const weekdayLabel = getWeekdayLabel(dayIndex, locale);
  return locale === "zh" ? `第${weekNumber}周 ${weekdayLabel}` : `Week ${weekNumber} ${weekdayLabel}`;
};

const getEmployeeName = (employee: EmployeeAvailabilityInput) =>
  `${employee.firstName} ${employee.lastName}`.trim();

const getTemplateDayLabel = (dayIndex: number, locale: Locale) =>
  getDetailedDayLabel(dayIndex, locale);

const getDateDayLabel = (date: string, locale: Locale) => {
  const parsed = dayjs(date);
  if (!parsed.isValid()) return date;
  const weekdayIndex = (parsed.day() + 6) % 7;
  return `${parsed.format("YYYY-MM-DD")} ${getWeekdayLabel(weekdayIndex, locale)}`;
};

const normalizeSlot = (slot: TimeSlot) => {
  const start = toMinutes(slot.start || "");
  const end = toMinutes(slot.end || "");
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return { start, end };
};

const isWindowCoveredBySlots = (start: number, end: number, slots: TimeSlot[] = []) => {
  if (end <= start) return true;

  const sorted = slots
    .map(normalizeSlot)
    .filter((slot): slot is { start: number; end: number } => Boolean(slot))
    .sort((a, b) => a.start - b.start);

  let coveredUntil = start;
  for (const slot of sorted) {
    if (slot.end <= coveredUntil) continue;
    if (slot.start > coveredUntil) return false;
    coveredUntil = Math.max(coveredUntil, slot.end);
    if (coveredUntil >= end) return true;
  }

  return coveredUntil >= end;
};

const getUncoveredWorkWindowMessage = (
  employee: EmployeeAvailabilityInput,
  dayIndex: number,
  label: string,
  startMinute: number,
  endMinute: number,
  locale: Locale
) => {
  const weekdayIndex = ((dayIndex % 7) + 7) % 7;
  const workDay = employee.workDayPattern?.find((item) => item.dayIndex === weekdayIndex);
  const employeeName = getEmployeeName(employee);

  if (!workDay || workDay.state !== "on" || workDay.hours <= 0) {
    return locale === "zh"
      ? `${employeeName} 在 ${label} 不在工作日，工作时间无法覆盖该班次。`
      : `${employeeName} is not scheduled to work on ${label}, so their work time does not cover this shift.`;
  }

  const slots = workDay.timeSlots || [];
  if (slots.length === 0) {
    return locale === "zh"
      ? `${employeeName} 在 ${label} 未设置具体工作时间，无法确认覆盖该班次。`
      : `${employeeName} has no work-time slots on ${label}, so this shift cannot be confirmed as covered.`;
  }

  if (isWindowCoveredBySlots(startMinute, endMinute, slots)) return null;

  return locale === "zh"
    ? `${employeeName} 在 ${label} 的工作时间未完全覆盖该班次时间段。`
    : `${employeeName}'s work time on ${label} does not fully cover this shift.`;
};

export function getTemplateShiftAvailabilityWarning(
  employee: EmployeeAvailabilityInput,
  shift: IndexedShiftAvailabilityInput,
  locale: Locale
) {
  const { startMinutes, endMinutes } = getClockRange(shift);
  let cursor = startMinutes;
  while (cursor < endMinutes) {
    const dayOffset = Math.floor(cursor / MINUTES_PER_DAY);
    const segmentStart = cursor % MINUTES_PER_DAY;
    const segmentEnd = Math.min(endMinutes, (dayOffset + 1) * MINUTES_PER_DAY) - dayOffset * MINUTES_PER_DAY;
    const absoluteDayIndex = shift.dayIndex + dayOffset;
    const message = getUncoveredWorkWindowMessage(
      employee,
      absoluteDayIndex,
      getTemplateDayLabel(absoluteDayIndex, locale),
      segmentStart,
      segmentEnd,
      locale
    );
    if (message) return message;
    cursor = (dayOffset + 1) * MINUTES_PER_DAY;
  }

  return null;
}

export function getDatedShiftAvailabilityWarning(
  employee: EmployeeAvailabilityInput,
  shift: DatedShiftAvailabilityInput,
  locale: Locale
) {
  const start = dayjs(`${shift.date}T${shift.startTime}`);
  let end = dayjs(`${shift.date}T${shift.endTime}`);
  if (!start.isValid() || !end.isValid()) return null;
  if (!end.isAfter(start)) end = end.add(1, "day");

  let cursor = start;
  while (cursor.isBefore(end)) {
    const dayEnd = cursor.startOf("day").add(1, "day");
    const segmentEnd = end.isBefore(dayEnd) ? end : dayEnd;
    const weekdayIndex = (cursor.day() + 6) % 7;
    const segmentEndMinute = segmentEnd.isSame(dayEnd)
      ? MINUTES_PER_DAY
      : segmentEnd.hour() * 60 + segmentEnd.minute();
    const message = getUncoveredWorkWindowMessage(
      employee,
      weekdayIndex,
      getDateDayLabel(cursor.format("YYYY-MM-DD"), locale),
      cursor.hour() * 60 + cursor.minute(),
      segmentEndMinute,
      locale
    );
    if (message) return message;
    cursor = segmentEnd;
  }

  return null;
}

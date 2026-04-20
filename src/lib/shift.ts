import dayjs, { type Dayjs } from "dayjs";

export const MINUTES_PER_DAY = 24 * 60;

export interface ClockRangeLike {
  startTime: string;
  endTime: string;
}

export interface DatedShiftLike extends ClockRangeLike {
  date: string;
}

export interface IndexedShiftLike extends ClockRangeLike {
  dayIndex: number;
}

export const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

export const getClockRange = ({ startTime, endTime }: ClockRangeLike) => {
  const startMinutes = toMinutes(startTime);
  let endMinutes = toMinutes(endTime);

  if (endMinutes <= startMinutes) {
    endMinutes += MINUTES_PER_DAY;
  }

  return { startMinutes, endMinutes };
};

export const calcShiftHours = (startTime: string, endTime: string, breakMinutes = 0) => {
  const { startMinutes, endMinutes } = getClockRange({ startTime, endTime });
  return Math.max(0, (endMinutes - startMinutes - breakMinutes) / 60).toFixed(1);
};

export const getShiftDateRange = (shift: DatedShiftLike) => {
  const start = dayjs(`${shift.date}T${shift.startTime}`);
  let end = dayjs(`${shift.date}T${shift.endTime}`);

  if (!end.isAfter(start)) {
    end = end.add(1, "day");
  }

  return { start, end };
};

export const datedShiftsOverlap = (a: DatedShiftLike, b: DatedShiftLike) => {
  const rangeA = getShiftDateRange(a);
  const rangeB = getShiftDateRange(b);
  return rangeA.start.isBefore(rangeB.end) && rangeA.end.isAfter(rangeB.start);
};

const getIndexedShiftRange = (shift: IndexedShiftLike) => {
  const { startMinutes, endMinutes } = getClockRange(shift);
  const dayOffset = shift.dayIndex * MINUTES_PER_DAY;
  return {
    startMinutes: dayOffset + startMinutes,
    endMinutes: dayOffset + endMinutes,
  };
};

export const indexedShiftsOverlap = (a: IndexedShiftLike, b: IndexedShiftLike) => {
  const rangeA = getIndexedShiftRange(a);
  const rangeB = getIndexedShiftRange(b);
  return rangeA.startMinutes < rangeB.endMinutes && rangeA.endMinutes > rangeB.startMinutes;
};

export const shiftIntersectsWindow = (
  shift: DatedShiftLike,
  windowStart: Dayjs,
  windowEnd: Dayjs
) => {
  const { start, end } = getShiftDateRange(shift);
  return end.isAfter(windowStart) && start.isBefore(windowEnd);
};

export const shiftIntersectsDay = (shift: DatedShiftLike, date: string) => {
  const dayStart = dayjs(date).startOf("day");
  return shiftIntersectsWindow(shift, dayStart, dayStart.add(1, "day"));
};

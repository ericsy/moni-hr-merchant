import dayjs, { type Dayjs } from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";

dayjs.extend(isoWeek);

export const getCurrentScheduleWeekStart = () =>
  dayjs().startOf("isoWeek").startOf("day");

export const isBeforeCurrentScheduleWeek = (
  date?: string | Dayjs | null,
) => {
  if (!date) return false;
  const value = dayjs.isDayjs(date) ? date : dayjs(date);
  if (!value.isValid()) return false;
  return value.isBefore(getCurrentScheduleWeekStart(), "day");
};

export const isScheduleDateEditable = (date?: string | Dayjs | null) =>
  !isBeforeCurrentScheduleWeek(date);

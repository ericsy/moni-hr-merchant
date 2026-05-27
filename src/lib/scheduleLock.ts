import dayjs, { type Dayjs } from "dayjs";

export const getScheduleEditableDateStart = () =>
  dayjs().add(1, "day").startOf("day");

export const isOnOrBeforeCurrentScheduleDate = (
  date?: string | Dayjs | null,
) => {
  if (!date) return false;
  const value = dayjs.isDayjs(date) ? date : dayjs(date);
  if (!value.isValid()) return false;
  return value.isBefore(getScheduleEditableDateStart(), "day");
};

export const isScheduleDateEditable = (date?: string | Dayjs | null) =>
  !isOnOrBeforeCurrentScheduleDate(date);

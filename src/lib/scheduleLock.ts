import dayjs, { type Dayjs } from "dayjs";

import { isDevAppEnv } from "./appEnv";

/** dev：含当日可编辑；test/pro：仅明日及以后可编辑 */
export const getScheduleEditableDateStart = () => {
  const today = dayjs().startOf("day");
  return isDevAppEnv() ? today : today.add(1, "day");
};

export const allowsEditingTodaySchedule = () => isDevAppEnv();

export const getScheduleReadonlyMessage = (isZh: boolean) =>
  isDevAppEnv()
    ? isZh
      ? "当前日期之前的排班只能查看，不能修改"
      : "Rosters before today are read-only"
    : isZh
      ? "当前日期及之前的排班只能查看，不能修改"
      : "Rosters for today and earlier are read-only";

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

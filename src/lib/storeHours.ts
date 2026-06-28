import type {
  Store,
  StoreWeekdayHours,
  TimeSlot,
  WorkDayPattern,
} from "../context/DataContext";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
const DEFAULT_OPEN_TIME = "09:00";
const DEFAULT_CLOSE_TIME = "22:00";

const toWeekday = (value: number) => {
  const normalized = ((value - 1) % 7 + 7) % 7;
  return normalized + 1;
};

export function isStoreClosedOnWeekday(store: Pick<Store, "weeklyHours"> | undefined | null, weekday: number) {
  const normalizedWeekday = toWeekday(weekday);
  const hours = store?.weeklyHours?.find((item) => item.weekday === normalizedWeekday);
  return hours?.closed === true;
}

export function isStoreClosedOnDayIndex(store: Pick<Store, "weeklyHours"> | undefined | null, dayIndex: number) {
  return isStoreClosedOnWeekday(store, dayIndex + 1);
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function calcHoursFromSlots(slots: TimeSlot[]): number {
  return slots.reduce((total, slot) => {
    const diff = timeToMinutes(slot.end) - timeToMinutes(slot.start);
    return total + (diff > 0 ? diff / 60 : 0);
  }, 0);
}

export function getNormalizedStoreWeeklyHours(
  store?: Pick<Store, "weeklyHours" | "openTime" | "closeTime"> | null,
): StoreWeekdayHours[] {
  if (store?.weeklyHours?.length) {
    const byWeekday = new Map(store.weeklyHours.map((item) => [item.weekday, item]));
    return WEEKDAYS.map((weekday) => {
      const item = byWeekday.get(weekday);
      return {
        weekday,
        closed: item?.closed ?? false,
        openTime: item?.openTime || store.openTime || DEFAULT_OPEN_TIME,
        closeTime: item?.closeTime || store.closeTime || DEFAULT_CLOSE_TIME,
      };
    });
  }

  return WEEKDAYS.map((weekday) => ({
    weekday,
    closed: false,
    openTime: store?.openTime || DEFAULT_OPEN_TIME,
    closeTime: store?.closeTime || DEFAULT_CLOSE_TIME,
  }));
}

export function workDayPatternFromStore(
  store?: Pick<Store, "weeklyHours" | "openTime" | "closeTime"> | null,
): WorkDayPattern[] {
  return getNormalizedStoreWeeklyHours(store).map((item) => {
    const dayIndex = item.weekday - 1;
    if (item.closed) {
      return { dayIndex, state: "off" as const, hours: 0, timeSlots: [] };
    }

    const openTime = item.openTime || DEFAULT_OPEN_TIME;
    const closeTime = item.closeTime || DEFAULT_CLOSE_TIME;
    const timeSlots: TimeSlot[] = [{ start: openTime, end: closeTime }];
    return {
      dayIndex,
      state: "on" as const,
      hours: calcHoursFromSlots(timeSlots),
      timeSlots,
    };
  });
}

export function getPrimaryPaidHoursFromWorkDayPattern(
  pattern: WorkDayPattern[],
  fallback = 8,
): number {
  const firstWorkingDay = pattern.find((day) => day.state === "on" && day.hours > 0);
  return firstWorkingDay?.hours ?? fallback;
}

export function getDefaultWorkDayPatternForStores(
  storeIds: string[],
  stores: Pick<Store, "id" | "weeklyHours" | "openTime" | "closeTime">[],
  fallback: WorkDayPattern[],
): WorkDayPattern[] {
  const firstStoreId = storeIds[0];
  if (!firstStoreId) return fallback;
  const store = stores.find((item) => item.id === firstStoreId);
  if (!store) return fallback;
  return workDayPatternFromStore(store);
}

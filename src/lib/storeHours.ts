import type { Store } from "../context/DataContext";

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

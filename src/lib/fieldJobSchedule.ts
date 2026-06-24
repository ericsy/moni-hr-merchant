import dayjs, { type Dayjs } from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import type { FieldServiceJob } from "../types/fieldService";

dayjs.extend(isoWeek);

export function getFieldJobDateKey(job: Pick<FieldServiceJob, "scheduledStart">) {
  const parsed = dayjs(job.scheduledStart);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD") : "";
}

export function getWeekStart(date: Dayjs) {
  return date.startOf("isoWeek");
}

export function getWeekDates(weekStart: Dayjs) {
  const start = getWeekStart(weekStart);
  return Array.from({ length: 7 }, (_, index) => start.add(index, "day"));
}

export function filterJobsOnDate(jobs: FieldServiceJob[], date: Dayjs) {
  const key = date.format("YYYY-MM-DD");
  return jobs
    .filter((job) => getFieldJobDateKey(job) === key)
    .sort((a, b) => dayjs(a.scheduledStart).valueOf() - dayjs(b.scheduledStart).valueOf());
}

export function countFieldJobsByDate(jobs: FieldServiceJob[]) {
  const map = new Map<string, number>();
  for (const job of jobs) {
    const key = getFieldJobDateKey(job);
    if (!key) continue;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

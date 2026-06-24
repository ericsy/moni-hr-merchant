import dayjs, { type Dayjs } from "dayjs";
import type { FieldServiceJob } from "../types/fieldService";

export function getFieldJobDateKey(job: Pick<FieldServiceJob, "scheduledStart">) {
  const parsed = dayjs(job.scheduledStart);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD") : "";
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

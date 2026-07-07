import dayjs from "dayjs";
import type { FieldServiceJob } from "../types/fieldService";

/** 商家端外勤工单编辑截止（分钟），与后端 FieldJobMerchantEditRules 一致 */
export const FIELD_JOB_EDIT_DEADLINE_MINUTES_BEFORE_START = 60;

/** 距计划开始仍不少于 1 小时时可编辑；已完成/已取消不可编辑。 */
export function isFieldJobEditableByMerchant(
  job: FieldServiceJob,
  now: dayjs.Dayjs = dayjs(),
): boolean {
  if (job.status === "completed" || job.status === "cancelled") {
    return false;
  }
  const start = dayjs(job.scheduledStart);
  if (!start.isValid()) {
    return false;
  }
  return start.diff(now, "minute") >= FIELD_JOB_EDIT_DEADLINE_MINUTES_BEFORE_START;
}

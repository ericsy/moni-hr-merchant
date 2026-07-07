import dayjs from "dayjs";
import type { FieldServiceJob } from "../types/fieldService";
import { isFieldJobAssigned } from "./fieldJobEmployees";

/** 商家端外勤工单编辑截止（分钟），与后端 FieldJobMerchantEditRules 一致 */
export const FIELD_JOB_EDIT_DEADLINE_MINUTES_BEFORE_START = 60;

/** 距计划开始仍不少于 1 小时时可编辑已有工单；已完成/已取消不可编辑。 */
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

/**
 * 派单/改派：待分配且无接单人时可首次派单（含新建后选人），不受 1 小时编辑截止限制。
 * 已分配工单的改派仍受编辑截止限制。
 */
export function canAssignFieldJobByMerchant(
  job: FieldServiceJob,
  now: dayjs.Dayjs = dayjs(),
): boolean {
  if (job.status === "completed" || job.status === "cancelled") {
    return false;
  }
  if (job.status === "pending" && !isFieldJobAssigned(job)) {
    return true;
  }
  if (job.status !== "pending" && job.status !== "assigned") {
    return false;
  }
  return isFieldJobEditableByMerchant(job, now);
}

import dayjs from "dayjs";
import type {
  CurrentPunchAction,
  DayWorkStatus,
  PunchActionType,
  TimelineFieldJobItem,
  TimelineStoreShiftItem,
  TodayWorkSummary,
  TodayWorkTimelineItem,
} from "../types/fieldService";

const FIELD_EARLY_MINUTES = 15;
const FIELD_LATE_MINUTES = 30;

export interface PunchStateInput {
  date: string;
  timeline: TodayWorkTimelineItem[];
  now?: dayjs.Dayjs;
  locale?: "zh" | "en";
}

function labels(locale: "zh" | "en") {
  return locale === "zh"
    ? {
        storeClockIn: "到店上班",
        storeClockOut: "离店下班",
        fieldClockIn: "开始服务",
        fieldClockInSync: "开始服务（计入今日上班）",
        fieldClockOut: "完成服务",
        fieldClockOutSync: "完成服务（今日下班）",
        waitingField: "请等待外勤开始时间",
        waitingStoreOut: "请先完成外勤服务后再离店下班",
        waitingReturn: "请返回门店完成今日下班",
        done: "今日工作已完成",
        hintStoreIn: "请在门店围栏内打卡",
        hintStoreOut: "请在门店围栏内打卡下班",
        hintFieldIn: "请在客户地址附近开始服务",
        hintFieldOut: "请在客户地址附近完成服务",
      }
    : {
        storeClockIn: "Clock in at store",
        storeClockOut: "Clock out at store",
        fieldClockIn: "Start service",
        fieldClockInSync: "Start service (counts as clock-in)",
        fieldClockOut: "Complete service",
        fieldClockOutSync: "Complete service (end of day)",
        waitingField: "Please wait until the field job starts",
        waitingStoreOut: "Complete the field job before clocking out at store",
        waitingReturn: "Return to the store to clock out",
        done: "Today's work is complete",
        hintStoreIn: "Clock in within the store geofence",
        hintStoreOut: "Clock out within the store geofence",
        hintFieldIn: "Start service near the customer address",
        hintFieldOut: "Complete service near the customer address",
      };
}

function getStoreShift(timeline: TodayWorkTimelineItem[]) {
  return timeline.find((item): item is TimelineStoreShiftItem => item.type === "store_shift") || null;
}

function getFieldJobs(timeline: TodayWorkTimelineItem[]) {
  return timeline
    .filter((item): item is TimelineFieldJobItem => item.type === "field_job")
    .sort((a, b) => a.start.localeCompare(b.start));
}

function isFieldWindowOpen(item: TimelineFieldJobItem, now: dayjs.Dayjs) {
  const start = dayjs(item.start).subtract(FIELD_EARLY_MINUTES, "minute");
  const end = dayjs(item.end).add(FIELD_LATE_MINUTES, "minute");
  return !now.isBefore(start) && !now.isAfter(end);
}

function buildFieldAction(
  item: TimelineFieldJobItem,
  action: PunchActionType,
  locale: "zh" | "en",
): CurrentPunchAction {
  const copy = labels(locale);
  const syncIn = action === "FIELD_CLOCK_IN_SYNC_STORE";
  const syncOut = action === "FIELD_CLOCK_OUT_SYNC_STORE";
  const isIn = action === "FIELD_CLOCK_IN" || syncIn;

  return {
    action,
    refType: "field_job",
    refId: item.id,
    geofence: {
      lat: item.latitude,
      lng: item.longitude,
      radius: item.geofenceRadius,
    },
    hint: isIn ? copy.hintFieldIn : copy.hintFieldOut,
    buttonLabel: syncIn
      ? copy.fieldClockInSync
      : syncOut
        ? copy.fieldClockOutSync
        : isIn
          ? copy.fieldClockIn
          : copy.fieldClockOut,
  };
}

function buildStoreAction(
  item: TimelineStoreShiftItem,
  action: Extract<PunchActionType, "STORE_CLOCK_IN" | "STORE_CLOCK_OUT">,
  locale: "zh" | "en",
): CurrentPunchAction {
  const copy = labels(locale);
  const isIn = action === "STORE_CLOCK_IN";
  return {
    action,
    refType: "store_shift",
    refId: item.id,
    geofence:
      item.latitude != null && item.longitude != null && item.geofenceRadius != null
        ? { lat: item.latitude, lng: item.longitude, radius: item.geofenceRadius }
        : null,
    hint: isIn ? copy.hintStoreIn : copy.hintStoreOut,
    buttonLabel: isIn ? copy.storeClockIn : copy.storeClockOut,
  };
}

function findActiveFieldJob(fieldJobs: TimelineFieldJobItem[], now: dayjs.Dayjs) {
  for (const job of fieldJobs) {
    if (!job.fieldClockInAt && isFieldWindowOpen(job, now)) return { job, phase: "in" as const };
    if (job.fieldClockInAt && !job.fieldClockOutAt) return { job, phase: "out" as const };
  }

  const nextPending = fieldJobs.find((job) => !job.fieldClockOutAt);
  if (nextPending && !nextPending.fieldClockInAt) {
    return { job: nextPending, phase: "in" as const };
  }
  return null;
}

export function resolveCurrentPunchAction(input: PunchStateInput): CurrentPunchAction {
  const locale = input.locale || "zh";
  const copy = labels(locale);
  const now = input.now || dayjs();
  const storeShift = getStoreShift(input.timeline);
  const fieldJobs = getFieldJobs(input.timeline);

  const allFieldDone = fieldJobs.length === 0 || fieldJobs.every((job) => !!job.fieldClockOutAt);
  const storeInDone = !storeShift || !!storeShift.storeClockInAt;
  const storeOutDone = !storeShift || !!storeShift.storeClockOutAt;

  if (storeOutDone && allFieldDone && (storeShift || fieldJobs.length > 0)) {
    return { action: "DONE", hint: copy.done, buttonLabel: copy.done };
  }

  const syncInJob = fieldJobs.find((job) => job.syncStoreClockIn);
  const syncOutJob = fieldJobs.find((job) => job.syncStoreClockOut);

  if (storeShift && !storeShift.storeClockInAt) {
    if (syncInJob && !syncInJob.fieldClockInAt) {
      const action = syncInJob.syncStoreClockIn ? "FIELD_CLOCK_IN_SYNC_STORE" : "FIELD_CLOCK_IN";
      if (isFieldWindowOpen(syncInJob, now) || now.isAfter(dayjs(syncInJob.start))) {
        return buildFieldAction(syncInJob, action, locale);
      }
      return { action: "WAITING", hint: copy.waitingField, buttonLabel: copy.waitingField };
    }

    if (!syncInJob || fieldJobs.length === 0) {
      return buildStoreAction(storeShift, "STORE_CLOCK_IN", locale);
    }
  }

  const activeField = findActiveFieldJob(fieldJobs, now);
  if (activeField) {
    const { job, phase } = activeField;
    if (phase === "in") {
      const action = job.syncStoreClockIn ? "FIELD_CLOCK_IN_SYNC_STORE" : "FIELD_CLOCK_IN";
      if (isFieldWindowOpen(job, now) || now.isAfter(dayjs(job.start))) {
        return buildFieldAction(job, action, locale);
      }
      return { action: "WAITING", hint: copy.waitingField, buttonLabel: copy.waitingField };
    }

    const action = job.syncStoreClockOut ? "FIELD_CLOCK_OUT_SYNC_STORE" : "FIELD_CLOCK_OUT";
    return buildFieldAction(job, action, locale);
  }

  const pendingField = fieldJobs.find((job) => !job.fieldClockOutAt);
  if (pendingField) {
    return { action: "WAITING", hint: copy.waitingField, buttonLabel: copy.waitingField };
  }

  if (storeShift && storeShift.storeClockInAt && !storeShift.storeClockOutAt) {
    if (syncOutJob && !syncOutJob.fieldClockOutAt) {
      const action = syncOutJob.syncStoreClockOut ? "FIELD_CLOCK_OUT_SYNC_STORE" : "FIELD_CLOCK_OUT";
      return buildFieldAction(syncOutJob, action, locale);
    }
    if (!allFieldDone) {
      return { action: "WAITING", hint: copy.waitingStoreOut, buttonLabel: copy.waitingStoreOut };
    }
    return buildStoreAction(storeShift, "STORE_CLOCK_OUT", locale);
  }

  if (!storeShift && fieldJobs.length > 0) {
    const onlyJob = fieldJobs[0];
    if (!onlyJob.fieldClockInAt) {
      const action = onlyJob.syncStoreClockIn ? "FIELD_CLOCK_IN_SYNC_STORE" : "FIELD_CLOCK_IN";
      return buildFieldAction(onlyJob, action, locale);
    }
    if (!onlyJob.fieldClockOutAt) {
      const action = onlyJob.syncStoreClockOut ? "FIELD_CLOCK_OUT_SYNC_STORE" : "FIELD_CLOCK_OUT";
      return buildFieldAction(onlyJob, action, locale);
    }
  }

  return { action: "DONE", hint: copy.done, buttonLabel: copy.done };
}

export function resolveDayStatus(input: PunchStateInput): DayWorkStatus {
  const action = resolveCurrentPunchAction(input).action;
  if (action === "DONE") return "done";
  if (action === "WAITING") return "in_progress";
  const store = getStoreShift(input.timeline);
  const fields = getFieldJobs(input.timeline);
  const started =
    (store?.storeClockInAt && true) ||
    fields.some((job) => !!job.fieldClockInAt);
  return started ? "in_progress" : "not_started";
}

export function buildTodayWorkSummary(input: PunchStateInput): TodayWorkSummary {
  return {
    date: input.date,
    timeline: input.timeline,
    currentPunchAction: resolveCurrentPunchAction(input),
    dayStatus: resolveDayStatus(input),
  };
}

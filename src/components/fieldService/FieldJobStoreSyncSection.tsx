import { Alert, Checkbox, Spin } from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useState } from "react";
import {
  buildAssignPreview,
  canEnableSyncClockIn,
  canEnableSyncClockOut,
  findBestOverlappingStoreShiftForEmployee,
} from "../../lib/fieldServiceAssign";
import { merchantApi } from "../../lib/merchantApi";
import type { FieldJobAssignPreview } from "../../types/fieldService";
import type { ScheduleShift } from "../../context/DataContext";

export interface FieldJobStoreSyncValue {
  syncStoreClockIn: boolean;
  syncStoreClockOut: boolean;
}

interface UseFieldJobStoreSyncPreviewOptions {
  jobId?: string;
  scheduledStart: string;
  scheduledEnd: string;
  employeeId: string;
  storeId: string;
  storeNameById: Record<string, string>;
  scheduleShifts: ScheduleShift[];
  locale: "zh" | "en";
}

export function useFieldJobStoreSyncPreview({
  jobId,
  scheduledStart,
  scheduledEnd,
  employeeId,
  storeId,
  storeNameById,
  scheduleShifts,
  locale,
}: UseFieldJobStoreSyncPreviewOptions) {
  const [preview, setPreview] = useState<FieldJobAssignPreview | null>(null);
  const [loading, setLoading] = useState(false);

  const loadPreview = useCallback(async () => {
    if (!employeeId || !scheduledStart || !scheduledEnd) {
      setPreview(null);
      return;
    }

    const jobWindow = { scheduledStart, scheduledEnd };
    setLoading(true);
    try {
      if (jobId) {
        const apiPreview = await merchantApi.getFieldJobAssignPreview(storeId, jobId, employeeId);
        setPreview(apiPreview);
        return;
      }

      const storeShift = findBestOverlappingStoreShiftForEmployee(
        scheduleShifts,
        employeeId,
        scheduledStart,
        scheduledEnd,
        storeNameById,
      );
      setPreview(buildAssignPreview(jobWindow, storeShift, locale));
    } catch {
      const storeShift = findBestOverlappingStoreShiftForEmployee(
        scheduleShifts,
        employeeId,
        scheduledStart,
        scheduledEnd,
        storeNameById,
      );
      setPreview(buildAssignPreview(jobWindow, storeShift, locale));
    } finally {
      setLoading(false);
    }
  }, [
    employeeId,
    jobId,
    locale,
    scheduledEnd,
    scheduledStart,
    scheduleShifts,
    storeId,
    storeNameById,
  ]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  return { preview, loading };
}

interface FieldJobStoreSyncFieldsProps {
  preview: FieldJobAssignPreview | null;
  scheduledStart: string;
  scheduledEnd: string;
  loading?: boolean;
  labels: Record<string, unknown>;
  value: FieldJobStoreSyncValue;
  onChange: (next: FieldJobStoreSyncValue) => void;
  validationErrors?: string[];
}

export function FieldJobStoreSyncFields({
  preview,
  scheduledStart,
  scheduledEnd,
  loading = false,
  labels,
  value,
  onChange,
  validationErrors = [],
}: FieldJobStoreSyncFieldsProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Spin />
      </div>
    );
  }

  if (!preview) return null;

  const jobStart = dayjs(scheduledStart);
  const jobEnd = dayjs(scheduledEnd);
  const shiftStart = preview.storeShift ? dayjs(preview.storeShift.start) : null;
  const shiftEnd = preview.storeShift ? dayjs(preview.storeShift.end) : null;
  const syncInEligible =
    preview.overlap && shiftStart ? canEnableSyncClockIn(jobStart, shiftStart) : false;
  const syncOutEligible =
    preview.overlap && shiftEnd ? canEnableSyncClockOut(jobEnd, shiftEnd) : false;

  return (
    <div className="flex flex-col gap-3">
      <Alert
        type={preview.hasStoreShift ? "info" : "success"}
        showIcon
        message={
          preview.hasStoreShift && preview.storeShift
            ? `${String(labels.storeShiftDetected)}：${preview.storeShift.startTime}–${preview.storeShift.endTime}（${preview.storeShift.storeName}）`
            : String(labels.storeShiftNone)
        }
      />

      {preview.overlap ? (
        <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
          <div className="mb-2 text-sm font-medium">{String(labels.syncHint)}</div>
          <div className="mb-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
            {String(labels.syncWindowHint)}
          </div>
          <div className="flex flex-col gap-2">
            <Checkbox
              checked={value.syncStoreClockIn}
              disabled={!syncInEligible}
              onChange={(event) =>
                onChange({ ...value, syncStoreClockIn: event.target.checked })
              }
            >
              {String(labels.syncStoreClockIn)}
            </Checkbox>
            {!syncInEligible ? (
              <div className="pl-6 text-xs" style={{ color: "var(--muted-foreground)" }}>
                {String(labels.syncClockInWindowHint)}
              </div>
            ) : null}
            <Checkbox
              checked={value.syncStoreClockOut}
              disabled={!syncOutEligible}
              onChange={(event) =>
                onChange({ ...value, syncStoreClockOut: event.target.checked })
              }
            >
              {String(labels.syncStoreClockOut)}
            </Checkbox>
            {!syncOutEligible ? (
              <div className="pl-6 text-xs" style={{ color: "var(--muted-foreground)" }}>
                {String(labels.syncClockOutWindowHint)}
              </div>
            ) : null}
          </div>
        </div>
      ) : preview.hasStoreShift ? (
        <Alert type="warning" showIcon message={String(labels.overlapRequired)} />
      ) : null}

      {preview.validationWarnings.length > 0 ? (
        <Alert type="warning" showIcon message={preview.validationWarnings.join("；")} />
      ) : null}

      {validationErrors.length > 0 ? (
        <Alert type="error" showIcon message={validationErrors.join("；")} />
      ) : null}
    </div>
  );
}

export function resolveFieldJobStoreSyncValue(
  preview: FieldJobAssignPreview | null,
  existingAssignment?: { syncStoreClockIn: boolean; syncStoreClockOut: boolean } | null,
  jobWindow?: { scheduledStart: string; scheduledEnd: string },
): FieldJobStoreSyncValue {
  const base = existingAssignment
    ? {
        syncStoreClockIn: existingAssignment.syncStoreClockIn,
        syncStoreClockOut: existingAssignment.syncStoreClockOut,
      }
    : {
        syncStoreClockIn: preview?.suggestedSyncStoreClockIn ?? false,
        syncStoreClockOut: preview?.suggestedSyncStoreClockOut ?? false,
      };

  if (!jobWindow || !preview?.storeShift) {
    return base;
  }
  return applyFieldJobStoreSyncForPreview(preview, base, jobWindow);
}

export function applyFieldJobStoreSyncForPreview(
  preview: FieldJobAssignPreview | null,
  value: FieldJobStoreSyncValue,
  job?: { scheduledStart: string; scheduledEnd: string },
): FieldJobStoreSyncValue {
  if (!preview?.overlap) {
    return { syncStoreClockIn: false, syncStoreClockOut: false };
  }
  if (!preview.storeShift || !job) {
    return value;
  }
  const jobStart = dayjs(job.scheduledStart);
  const jobEnd = dayjs(job.scheduledEnd);
  const shiftStart = dayjs(preview.storeShift.start);
  const shiftEnd = dayjs(preview.storeShift.end);
  return {
    syncStoreClockIn: value.syncStoreClockIn && canEnableSyncClockIn(jobStart, shiftStart),
    syncStoreClockOut: value.syncStoreClockOut && canEnableSyncClockOut(jobEnd, shiftEnd),
  };
}

import { Alert, Checkbox, Modal, Select, Spin } from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildAssignPreview,
  findEmployeeStoreShiftOnDate,
  validateAssignSyncOptions,
} from "../../lib/fieldServiceAssign";
import { filterEmployeesAvailableForFieldJob } from "../../lib/employeeLeave";
import {
  buildFieldJobAssignmentPayloads,
  getFieldJobAssignmentEmployeeIds,
  isFieldJobAssigned,
} from "../../lib/fieldJobEmployees";
import { merchantApi } from "../../lib/merchantApi";
import type { FieldJobAssignPayload, FieldJobAssignPreview, FieldServiceJob } from "../../types/fieldService";
import type { EmployeeDateLeave, EmployeeShiftLeave } from "../../lib/merchantApi";
import type { ScheduleShift } from "../../context/DataContext";

interface EmployeeOption {
  id: string;
  name: string;
}

interface FieldJobAssignModalProps {
  open: boolean;
  job: FieldServiceJob | null;
  storeId: string;
  storeNameById: Record<string, string>;
  employees: EmployeeOption[];
  dateLeaves: EmployeeDateLeave[];
  shiftLeaves: EmployeeShiftLeave[];
  existingJobs: FieldServiceJob[];
  scheduleShifts: ScheduleShift[];
  locale: "zh" | "en";
  labels: Record<string, unknown>;
  onCancel: () => void;
  onSubmit: (payload: { assignments: FieldJobAssignPayload[] }) => Promise<void>;
}

export default function FieldJobAssignModal({
  open,
  job,
  storeId,
  storeNameById,
  employees,
  dateLeaves,
  shiftLeaves,
  existingJobs,
  scheduleShifts,
  locale,
  labels,
  onCancel,
  onSubmit,
}: FieldJobAssignModalProps) {
  const [employeeIds, setEmployeeIds] = useState<string[]>([]);
  const [syncStoreClockIn, setSyncStoreClockIn] = useState(false);
  const [syncStoreClockOut, setSyncStoreClockOut] = useState(false);
  const [preview, setPreview] = useState<FieldJobAssignPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const resetState = useCallback(() => {
    setEmployeeIds([]);
    setSyncStoreClockIn(false);
    setSyncStoreClockOut(false);
    setPreview(null);
    setErrors([]);
  }, []);

  const isReassign = isFieldJobAssigned(job);
  const singleEmployeeMode = employeeIds.length === 1;
  const previewEmployeeId = singleEmployeeMode ? employeeIds[0] : "";

  useEffect(() => {
    if (!open) {
      resetState();
      return;
    }

    setEmployeeIds(getFieldJobAssignmentEmployeeIds(job));
  }, [job, open, resetState]);

  const availableEmployees = useMemo(() => {
    if (!job) return employees;
    return filterEmployeesAvailableForFieldJob(
      employees,
      job.scheduledStart,
      job.scheduledEnd,
      dateLeaves,
      shiftLeaves,
      {
        existingJobs,
        excludeJobId: job.id,
        includeEmployeeIds: [
          ...employeeIds,
          ...getFieldJobAssignmentEmployeeIds(job),
        ],
      },
    );
  }, [dateLeaves, employeeIds, employees, existingJobs, job, shiftLeaves]);

  useEffect(() => {
    if (!open) return;
    setEmployeeIds((current) =>
      current.filter((employeeId) => availableEmployees.some((employee) => employee.id === employeeId)),
    );
  }, [availableEmployees, open]);

  const loadPreview = useCallback(
    async (nextEmployeeId: string) => {
      if (!job || !nextEmployeeId) {
        setPreview(null);
        return;
      }

      setLoadingPreview(true);
      try {
        const apiPreview = await merchantApi.getFieldJobAssignPreview(storeId, job.id, nextEmployeeId);
        setPreview(apiPreview);
        setSyncStoreClockIn(apiPreview.suggestedSyncStoreClockIn);
        setSyncStoreClockOut(apiPreview.suggestedSyncStoreClockOut);
      } catch {
        const jobDate = dayjs(job.scheduledStart).format("YYYY-MM-DD");
        const storeShift = findEmployeeStoreShiftOnDate(
          scheduleShifts,
          nextEmployeeId,
          jobDate,
          storeNameById,
        );
        const localPreview = buildAssignPreview(job, storeShift, locale);
        setPreview(localPreview);
        setSyncStoreClockIn(localPreview.suggestedSyncStoreClockIn);
        setSyncStoreClockOut(localPreview.suggestedSyncStoreClockOut);
      } finally {
        setLoadingPreview(false);
      }
    },
    [job, locale, scheduleShifts, storeId, storeNameById],
  );

  useEffect(() => {
    if (!open || !previewEmployeeId) {
      setPreview(null);
      return;
    }
    void loadPreview(previewEmployeeId);
  }, [loadPreview, open, previewEmployeeId]);

  const validation = useMemo(() => {
    if (!singleEmployeeMode) {
      return {
        valid: employeeIds.length > 0,
        warnings: [],
        errors: employeeIds.length > 0 ? [] : [String(labels.employeeRequired)],
      };
    }
    if (!job || !preview?.storeShift) {
      return {
        valid: !!previewEmployeeId,
        warnings: [],
        errors: previewEmployeeId ? [] : [String(labels.employeeRequired)],
      };
    }
    return validateAssignSyncOptions(
      job,
      preview.storeShift,
      { syncStoreClockIn, syncStoreClockOut },
      locale,
    );
  }, [
    employeeIds.length,
    job,
    labels.employeeRequired,
    locale,
    preview?.storeShift,
    previewEmployeeId,
    singleEmployeeMode,
    syncStoreClockIn,
    syncStoreClockOut,
  ]);

  const handleOk = async () => {
    if (employeeIds.length === 0) {
      setErrors([String(labels.employeeRequired)]);
      return;
    }
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    const assignments = buildFieldJobAssignmentPayloads(job, employeeIds, {
      syncStoreClockIn: singleEmployeeMode && preview?.overlap ? syncStoreClockIn : false,
      syncStoreClockOut: singleEmployeeMode && preview?.overlap ? syncStoreClockOut : false,
    });

    try {
      setSubmitting(true);
      await onSubmit({ assignments });
    } finally {
      setSubmitting(false);
    }
  };

  if (!job) return null;

  return (
    <Modal
      open={open}
      title={String(isReassign ? labels.reassignTitle : labels.assignTitle)}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={submitting}
      okText={String(isReassign ? labels.reassignConfirm : labels.assignConfirm)}
      destroyOnClose
    >
      <div className="flex flex-col gap-4 py-2">
        <div className="rounded-lg p-3 text-sm" style={{ background: "var(--secondary)" }}>
          <div className="font-medium">{job.customerName}</div>
          <div style={{ color: "var(--muted-foreground)" }}>{job.serviceAddress}</div>
          <div className="mt-1">
            {dayjs(job.scheduledStart).format("YYYY-MM-DD HH:mm")} –{" "}
            {dayjs(job.scheduledEnd).format("HH:mm")}
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-medium">{String(labels.selectEmployee)}</div>
          {availableEmployees.length === 0 ? (
            <Alert type="warning" showIcon message={String(labels.noAvailableEmployees)} />
          ) : (
            <Select
              showSearch
              mode="multiple"
              className="w-full"
              placeholder={String(labels.selectEmployee)}
              value={employeeIds}
              onChange={setEmployeeIds}
              options={availableEmployees.map((employee) => ({
                value: employee.id,
                label: employee.name,
              }))}
              optionFilterProp="label"
            />
          )}
        </div>

        {singleEmployeeMode && loadingPreview ? (
          <div className="flex justify-center py-4">
            <Spin />
          </div>
        ) : null}

        {singleEmployeeMode && preview && previewEmployeeId ? (
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
                <div className="flex flex-col gap-2">
                  <Checkbox
                    checked={syncStoreClockIn}
                    onChange={(event) => setSyncStoreClockIn(event.target.checked)}
                  >
                    {String(labels.syncStoreClockIn)}
                  </Checkbox>
                  <Checkbox
                    checked={syncStoreClockOut}
                    onChange={(event) => setSyncStoreClockOut(event.target.checked)}
                  >
                    {String(labels.syncStoreClockOut)}
                  </Checkbox>
                </div>
              </div>
            ) : preview.hasStoreShift ? (
              <Alert type="warning" showIcon message={String(labels.overlapRequired)} />
            ) : null}
          </div>
        ) : employeeIds.length > 1 ? (
          <Alert type="info" showIcon message={String(labels.multiEmployeeAssignHint)} />
        ) : null}

        {errors.length > 0 ? (
          <Alert type="error" showIcon message={errors.join("；")} />
        ) : null}
      </div>
    </Modal>
  );
}

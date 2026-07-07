import { Alert, Modal, Select } from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { validateAssignSyncOptions } from "../../lib/fieldServiceAssign";
import { filterEmployeesAvailableForFieldJob, getEmployeeFieldJobBlockInfo } from "../../lib/employeeLeave";
import {
  buildFieldJobAssignmentPayloads,
  getFieldJobAssignmentEmployeeIds,
  getFieldJobAssignments,
  isFieldJobAssigned,
  normalizeEmployeeAdminId,
  normalizeEmployeeAdminIds,
} from "../../lib/fieldJobEmployees";
import type { FieldJobAssignPayload, FieldServiceJob } from "../../types/fieldService";
import type { EmployeeDateLeave, EmployeeShiftLeave } from "../../lib/merchantApi";
import type { ScheduleShift } from "../../context/DataContext";
import {
  applyFieldJobStoreSyncForPreview,
  FieldJobStoreSyncFields,
  resolveFieldJobStoreSyncValue,
  useFieldJobStoreSyncPreview,
  type FieldJobStoreSyncValue,
} from "./FieldJobStoreSyncSection";

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
  const [syncValue, setSyncValue] = useState<FieldJobStoreSyncValue>({
    syncStoreClockIn: false,
    syncStoreClockOut: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const resetState = useCallback(() => {
    setEmployeeIds([]);
    setSyncValue({ syncStoreClockIn: false, syncStoreClockOut: false });
    setErrors([]);
  }, []);

  const isReassign = isFieldJobAssigned(job);
  const singleEmployeeMode = employeeIds.length === 1;
  const previewEmployeeId = singleEmployeeMode ? employeeIds[0] : "";
  const existingAssignment = useMemo(() => {
    if (!job || !previewEmployeeId) return null;
    return getFieldJobAssignments(job).find(
      (assignment) => String(assignment.merchantAdminId) === String(previewEmployeeId),
    ) ?? null;
  }, [job, previewEmployeeId]);

  useEffect(() => {
    if (!open) {
      resetState();
      return;
    }

    setEmployeeIds(normalizeEmployeeAdminIds(getFieldJobAssignmentEmployeeIds(job)));
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

  const { preview, loading: loadingPreview } = useFieldJobStoreSyncPreview({
    jobId: open && singleEmployeeMode ? job?.id : undefined,
    scheduledStart: job?.scheduledStart || "",
    scheduledEnd: job?.scheduledEnd || "",
    employeeId: open && singleEmployeeMode ? previewEmployeeId : "",
    storeId,
    storeNameById,
    scheduleShifts,
    locale,
  });

  useEffect(() => {
    if (!open || !singleEmployeeMode || !preview) return;
    setSyncValue(
      resolveFieldJobStoreSyncValue(preview, existingAssignment, job ?? undefined),
    );
  }, [existingAssignment, job, open, preview, singleEmployeeMode]);

  const validation = useMemo(() => {
    if (!singleEmployeeMode) {
      return {
        valid: employeeIds.length > 0,
        warnings: [],
        errors: employeeIds.length > 0 ? [] : [String(labels.employeeRequired)],
      };
    }
    if (!job || !previewEmployeeId) {
      return {
        valid: false,
        warnings: [],
        errors: [String(labels.employeeRequired)],
      };
    }
    if (!preview?.storeShift) {
      return { valid: true, warnings: [], errors: [] as string[] };
    }
    return validateAssignSyncOptions(job, preview.storeShift, syncValue, locale);
  }, [
    employeeIds.length,
    job,
    labels.employeeRequired,
    locale,
    preview?.storeShift,
    previewEmployeeId,
    singleEmployeeMode,
    syncValue,
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

    if (job) {
      for (const employeeId of employeeIds) {
        const blockInfo = getEmployeeFieldJobBlockInfo(
          employeeId,
          job.scheduledStart,
          job.scheduledEnd,
          dateLeaves,
          shiftLeaves,
          existingJobs,
          { excludeJobId: job.id },
        );
        if (!blockInfo) continue;

        const employeeName = employees.find((employee) => employee.id === employeeId)?.name || employeeId;
        if (blockInfo.reason === "leave") {
          setErrors([String(labels.employeeUnavailableLeave).replace("{name}", employeeName)]);
          return;
        }
        const conflictCustomer = blockInfo.conflictingJob?.customerName?.trim();
        const template = conflictCustomer
          ? String(labels.employeeUnavailableConflictWithJob)
          : String(labels.employeeUnavailableConflict);
        setErrors([
          template
            .replace("{name}", employeeName)
            .replace("{customer}", conflictCustomer || ""),
        ]);
        return;
      }
    }

    const appliedSync = applyFieldJobStoreSyncForPreview(preview, syncValue, job ?? undefined);
    const assignments = buildFieldJobAssignmentPayloads(job, employeeIds, {
      syncStoreClockIn: singleEmployeeMode ? appliedSync.syncStoreClockIn : false,
      syncStoreClockOut: singleEmployeeMode ? appliedSync.syncStoreClockOut : false,
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
              onChange={(ids) => setEmployeeIds(normalizeEmployeeAdminIds(ids as Array<string | number>))}
              options={availableEmployees.map((employee) => ({
                value: normalizeEmployeeAdminId(employee.id),
                label: employee.name,
              }))}
              optionFilterProp="label"
            />
          )}
        </div>

        {singleEmployeeMode && previewEmployeeId ? (
          <FieldJobStoreSyncFields
            preview={preview}
            scheduledStart={job.scheduledStart}
            scheduledEnd={job.scheduledEnd}
            loading={loadingPreview}
            labels={labels}
            value={syncValue}
            onChange={setSyncValue}
            validationErrors={validation.errors}
          />
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

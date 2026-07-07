import { DatePicker, Alert, Form, Input, Modal, Select } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";
import HourMinuteTimePicker from "../HourMinuteTimePicker";
import GeoFenceMapPicker from "../GeoFenceMapPicker";
import GoogleAddressAutocompleteInput from "../GoogleAddressAutocompleteInput";
import {
  filterEmployeesAvailableForFieldJob,
  getEmployeeFieldJobBlockInfo,
} from "../../lib/employeeLeave";
import type { EmployeeDateLeave, EmployeeShiftLeave } from "../../lib/merchantApi";
import type { GooglePlaceSummary } from "../../lib/googleMaps";
import type { FieldJobFormSubmitPayload, FieldServiceJob } from "../../types/fieldService";
import { getFieldJobAssignmentEmployeeIds, getFieldJobAssignments, isFieldJobAssigned, normalizeEmployeeAdminIds } from "../../lib/fieldJobEmployees";
import type { ScheduleShift } from "../../context/DataContext";
import {
  applyFieldJobStoreSyncForPreview,
  FieldJobStoreSyncFields,
  resolveFieldJobStoreSyncValue,
  useFieldJobStoreSyncPreview,
  type FieldJobStoreSyncValue,
} from "./FieldJobStoreSyncSection";
import { validateAssignSyncOptions } from "../../lib/fieldServiceAssign";

const { TextArea } = Input;

const TIME_ONLY_DATE = "2000-01-01";
const FIELD_JOB_TIME_MINUTE_STEP = 5;
const DEFAULT_FIELD_JOB_DURATION_HOURS = 2;

export interface FieldJobFormValues {
  customerName: string;
  customerPhone: string;
  serviceAddress: string;
  serviceType: string;
  serviceDate: Dayjs;
  merchantAdminIds?: string[];
  latitude: number;
  longitude: number;
  geofenceRadius: number;
  notes?: string;
}

interface FieldJobFormModalProps {
  open: boolean;
  job?: FieldServiceJob | null;
  storeId: string;
  storeNameById: Record<string, string>;
  scheduleShifts: ScheduleShift[];
  employees: Array<{ id: string; name: string }>;
  dateLeaves: EmployeeDateLeave[];
  shiftLeaves: EmployeeShiftLeave[];
  existingJobs: FieldServiceJob[];
  locale: "zh" | "en";
  labels: Record<string, unknown>;
  onCancel: () => void;
  onSubmit: (payload: FieldJobFormSubmitPayload) => Promise<void>;
}

function snapTimeToMinuteStep(
  time: Dayjs = dayjs(),
  minuteStep = FIELD_JOB_TIME_MINUTE_STEP,
) {
  const totalMinutes = time.hour() * 60 + time.minute();
  const snappedMinutes =
    Math.round(totalMinutes / minuteStep) * minuteStep;
  const clampedMinutes = Math.min(
    Math.max(snappedMinutes, 0),
    24 * 60 - minuteStep,
  );
  return time.startOf("day").add(clampedMinutes, "minute");
}

function getDefaultFieldJobStartTime(now = dayjs()) {
  return snapTimeToMinuteStep(now).format("HH:mm");
}

function getDefaultFieldJobEndTime(
  startTime: string,
  durationHours = DEFAULT_FIELD_JOB_DURATION_HOURS,
  minuteStep = FIELD_JOB_TIME_MINUTE_STEP,
) {
  const start = timeValue(startTime);
  let end = start.add(durationHours, "hour");
  if (!end.isAfter(start)) {
    end = start.add(minuteStep, "minute");
  }
  const latestEnd = dayjs(`${TIME_ONLY_DATE} 23:59`, "YYYY-MM-DD HH:mm");
  if (end.isAfter(latestEnd)) {
    end = start.add(minuteStep, "minute");
  }
  return end.format("HH:mm");
}

function getDefaultFieldJobTimes(now = dayjs()) {
  const startTime = getDefaultFieldJobStartTime(now);
  return {
    startTime,
    endTime: getDefaultFieldJobEndTime(startTime),
  };
}

function timeValue(value?: Dayjs | string | null, fallback?: string) {
  const resolvedFallback = fallback ?? "09:00";
  if (dayjs.isDayjs(value) && value.isValid()) {
    return dayjs(`${TIME_ONLY_DATE} ${value.format("HH:mm")}`, "YYYY-MM-DD HH:mm");
  }
  const text =
    typeof value === "string" && /^\d{1,2}:\d{2}$/.test(value)
      ? value
      : resolvedFallback;
  return dayjs(`${TIME_ONLY_DATE} ${text}`, "YYYY-MM-DD HH:mm");
}

function toTimeString(source?: Dayjs | string, fallbackHour = 9, fallbackMinute = 0) {
  const fallback = `${String(fallbackHour).padStart(2, "0")}:${String(fallbackMinute).padStart(2, "0")}`;
  if (typeof source === "string" && /^\d{1,2}:\d{2}$/.test(source)) {
    return source;
  }
  const parsed = source ? dayjs(source) : null;
  if (!parsed?.isValid()) return fallback;
  return parsed.format("HH:mm");
}

function combineDateAndTime(serviceDate: Dayjs, time: Dayjs | string) {
  const timeObj = timeValue(time);
  return serviceDate
    .hour(timeObj.hour())
    .minute(timeObj.minute())
    .second(0)
    .millisecond(0);
}

function toLocalDateTimeString(value: Dayjs) {
  return value.format("YYYY-MM-DDTHH:mm:ss");
}

function formatBlockMessage(
  labels: Record<string, unknown>,
  employeeName: string,
  blockInfo: ReturnType<typeof getEmployeeFieldJobBlockInfo>,
) {
  if (!blockInfo) return "";

  if (blockInfo.reason === "leave") {
    return String(labels.employeeUnavailableLeave).replace("{name}", employeeName);
  }

  const conflictCustomer = blockInfo.conflictingJob?.customerName?.trim();
  const template = conflictCustomer
    ? String(labels.employeeUnavailableConflictWithJob)
    : String(labels.employeeUnavailableConflict);
  return template
    .replace("{name}", employeeName)
    .replace("{customer}", conflictCustomer || "");
}

function applyTimeChange(
  time: Dayjs | Dayjs[] | null,
  onChange: (next: string) => void,
) {
  if (!time || Array.isArray(time) || !time.isValid()) return;
  onChange(time.format("HH:mm"));
}

function isValidServiceTimeRange(start: string, end: string) {
  return timeValue(end).isAfter(timeValue(start));
}

export default function FieldJobFormModal({
  open,
  job,
  storeId,
  storeNameById,
  scheduleShifts,
  employees,
  dateLeaves,
  shiftLeaves,
  existingJobs,
  locale,
  labels,
  onCancel,
  onSubmit,
}: FieldJobFormModalProps) {
  const [form] = Form.useForm<FieldJobFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [startTime, setStartTime] = useState(() => getDefaultFieldJobStartTime());
  const [endTime, setEndTime] = useState(() =>
    getDefaultFieldJobEndTime(getDefaultFieldJobStartTime()),
  );
  const [employeeError, setEmployeeError] = useState("");
  const [syncValue, setSyncValue] = useState<FieldJobStoreSyncValue>({
    syncStoreClockIn: false,
    syncStoreClockOut: false,
  });
  const [syncErrors, setSyncErrors] = useState<string[]>([]);
  const [locateNow, setLocateNow] = useState(0);
  const [preservedGeocodeAddress, setPreservedGeocodeAddress] = useState("");
  const serviceAddress = Form.useWatch("serviceAddress", form);
  const serviceDate = Form.useWatch("serviceDate", form);
  const selectedEmployeeIds = normalizeEmployeeAdminIds(
    Form.useWatch("merchantAdminIds", form) as Array<string | number> | undefined,
  );
  const singleSelectedEmployeeId = selectedEmployeeIds.length === 1 ? selectedEmployeeIds[0] : "";
  const isEmployeeOnlyEdit = !!job && isFieldJobAssigned(job);
  const [geo, setGeo] = useState({
    latitude: job?.latitude ?? -36.8485,
    longitude: job?.longitude ?? 174.7633,
    geofenceRadius: job?.geofenceRadius ?? 100,
  });
  const modalInitKeyRef = useRef<string | null>(null);

  const timeRangeError = useMemo(() => {
    if (isValidServiceTimeRange(startTime, endTime)) return "";
    return String(labels.endTimeInvalid);
  }, [endTime, labels.endTimeInvalid, startTime]);

  const scheduledWindow = useMemo(() => {
    const date = serviceDate ? dayjs(serviceDate) : dayjs().startOf("day");
    if (!date.isValid()) return null;
    const start = combineDateAndTime(date, startTime);
    const end = combineDateAndTime(date, endTime);
    if (!end.isAfter(start)) return null;
    return {
      scheduledStart: toLocalDateTimeString(start),
      scheduledEnd: toLocalDateTimeString(end),
    };
  }, [endTime, serviceDate, startTime]);

  const existingAssignment = useMemo(() => {
    if (!job || !singleSelectedEmployeeId) return null;
    return getFieldJobAssignments(job).find(
      (assignment) => String(assignment.merchantAdminId) === String(singleSelectedEmployeeId),
    ) ?? null;
  }, [job, singleSelectedEmployeeId]);

  const { preview: syncPreview, loading: loadingSyncPreview } = useFieldJobStoreSyncPreview({
    jobId: open ? job?.id : undefined,
    scheduledStart: scheduledWindow?.scheduledStart || "",
    scheduledEnd: scheduledWindow?.scheduledEnd || "",
    employeeId: open && singleSelectedEmployeeId ? singleSelectedEmployeeId : "",
    storeId,
    storeNameById,
    scheduleShifts,
    locale,
  });

  useEffect(() => {
    if (!open || !singleSelectedEmployeeId || !syncPreview) return;
    setSyncValue(
      resolveFieldJobStoreSyncValue(
        syncPreview,
        existingAssignment,
        scheduledWindow ?? undefined,
      ),
    );
  }, [existingAssignment, open, scheduledWindow, singleSelectedEmployeeId, syncPreview]);

  const syncValidation = useMemo(() => {
    if (!singleSelectedEmployeeId || !scheduledWindow) {
      return { valid: true, errors: [] as string[] };
    }
    if (!syncPreview?.storeShift) {
      return { valid: true, errors: [] as string[] };
    }
    return validateAssignSyncOptions(
      scheduledWindow,
      syncPreview.storeShift,
      syncValue,
      locale,
    );
  }, [locale, scheduledWindow, singleSelectedEmployeeId, syncPreview?.storeShift, syncValue]);

  useEffect(() => {
    setSyncErrors(syncValidation.errors);
  }, [syncValidation.errors]);

  const availableEmployees = useMemo(() => {
    if (!scheduledWindow) return employees;
    return filterEmployeesAvailableForFieldJob(
      employees,
      scheduledWindow.scheduledStart,
      scheduledWindow.scheduledEnd,
      dateLeaves,
      shiftLeaves,
      {
        includeEmployeeIds: [
          ...selectedEmployeeIds,
          ...getFieldJobAssignmentEmployeeIds(job),
        ],
        existingJobs,
        excludeJobId: job?.id,
      },
    );
  }, [
    dateLeaves,
    employees,
    existingJobs,
    job,
    scheduledWindow,
    selectedEmployeeIds,
    shiftLeaves,
  ]);

  const employeeAvailabilityMessage = useMemo(() => {
    if (!scheduledWindow || selectedEmployeeIds.length === 0) return "";

    for (const employeeId of selectedEmployeeIds) {
      const blockInfo = getEmployeeFieldJobBlockInfo(
        employeeId,
        scheduledWindow.scheduledStart,
        scheduledWindow.scheduledEnd,
        dateLeaves,
        shiftLeaves,
        existingJobs,
        { excludeJobId: job?.id },
      );
      if (!blockInfo) continue;

      const employeeName =
        employees.find((employee) => employee.id === employeeId)?.name ||
        getFieldJobAssignments(job).find((assignment) => assignment.merchantAdminId === employeeId)
          ?.employeeName ||
        employeeId;
      return formatBlockMessage(labels, employeeName, blockInfo);
    }

    return "";
  }, [
    dateLeaves,
    employees,
    existingJobs,
    job,
    labels,
    scheduledWindow,
    selectedEmployeeIds,
    shiftLeaves,
  ]);

  useEffect(() => {
    if (!open) return;
    setEmployeeError(employeeAvailabilityMessage);
  }, [employeeAvailabilityMessage, open]);

  useEffect(() => {
    if (!open) {
      modalInitKeyRef.current = null;
      return;
    }

    const initKey = job?.id ?? "__create__";
    if (modalInitKeyRef.current === initKey) return;
    modalInitKeyRef.current = initKey;

    if (job) {
      const start = dayjs(job.scheduledStart);
      const end = dayjs(job.scheduledEnd);
      form.setFieldsValue({
        customerName: job.customerName,
        customerPhone: job.customerPhone,
        serviceAddress: job.serviceAddress,
        serviceType: job.serviceType?.trim() || "",
        serviceDate: start.startOf("day"),
        latitude: job.latitude,
        longitude: job.longitude,
        geofenceRadius: job.geofenceRadius,
        notes: job.notes,
        merchantAdminIds: normalizeEmployeeAdminIds(getFieldJobAssignmentEmployeeIds(job)),
      });
      setStartTime(toTimeString(start));
      setEndTime(toTimeString(end, 11, 0));
      setEmployeeError("");
      setGeo({
        latitude: job.latitude,
        longitude: job.longitude,
        geofenceRadius: job.geofenceRadius,
      });
      setPreservedGeocodeAddress(job.serviceAddress.trim());
      setLocateNow(0);
      return;
    }

    form.resetFields();
    const today = dayjs().startOf("day");
    const { startTime: defaultStartTime, endTime: defaultEndTime } =
      getDefaultFieldJobTimes();
    form.setFieldsValue({
      serviceDate: today,
      geofenceRadius: 100,
      merchantAdminIds: [],
    });
    setStartTime(defaultStartTime);
    setEndTime(defaultEndTime);
    setEmployeeError("");
    setGeo({ latitude: -36.8485, longitude: 174.7633, geofenceRadius: 100 });
    setPreservedGeocodeAddress("");
    setLocateNow(0);
  }, [form, job, open]);

  const applyGeoFromPlace = (place: GooglePlaceSummary) => {
    if (typeof place.latitude !== "number" || typeof place.longitude !== "number") {
      return;
    }

    setGeo((prev) => {
      const next = {
        latitude: place.latitude as number,
        longitude: place.longitude as number,
        geofenceRadius: prev.geofenceRadius,
      };
      form.setFieldsValue({
        latitude: next.latitude,
        longitude: next.longitude,
        geofenceRadius: next.geofenceRadius,
      });
      return next;
    });
    setPreservedGeocodeAddress(place.formattedAddress.trim());
    setLocateNow((tick) => tick + 1);
  };

  const handleAddressInputComplete = (address: string) => {
    const trimmed = address.trim();
    if (trimmed.length < 4) return;
    if (trimmed === preservedGeocodeAddress) return;
    setPreservedGeocodeAddress("");
    setLocateNow((tick) => tick + 1);
  };

  const handleOk = async () => {
    try {
      const values = isEmployeeOnlyEdit
        ? await form.validateFields(["merchantAdminIds"])
        : await form.validateFields();
      const scheduledStart = isEmployeeOnlyEdit && job
        ? dayjs(job.scheduledStart)
        : combineDateAndTime(values.serviceDate, startTime);
      const scheduledEnd = isEmployeeOnlyEdit && job
        ? dayjs(job.scheduledEnd)
        : combineDateAndTime(values.serviceDate, endTime);

      if (!isEmployeeOnlyEdit && !isValidServiceTimeRange(startTime, endTime)) {
        return;
      }

      const selectedIds = normalizeEmployeeAdminIds(values.merchantAdminIds as Array<string | number> | undefined);
      if (isEmployeeOnlyEdit && selectedIds.length === 0) {
        setEmployeeError(String(labels.employeeRequired));
        return;
      }
      if (selectedIds.length > 0) {
        for (const employeeId of selectedIds) {
          const blockInfo = getEmployeeFieldJobBlockInfo(
            employeeId,
            toLocalDateTimeString(scheduledStart),
            toLocalDateTimeString(scheduledEnd),
            dateLeaves,
            shiftLeaves,
            existingJobs,
            { excludeJobId: job?.id },
          );
          if (blockInfo) {
            const employeeName =
              employees.find((employee) => employee.id === employeeId)?.name || employeeId;
            setEmployeeError(formatBlockMessage(labels, employeeName, blockInfo));
            return;
          }
        }
      }
      setEmployeeError("");

      if (!syncValidation.valid) {
        setSyncErrors(syncValidation.errors);
        return;
      }
      setSyncErrors([]);

      const appliedSync = applyFieldJobStoreSyncForPreview(syncPreview, syncValue, scheduledWindow ?? undefined);

      setSubmitting(true);
      const upsertPayload = isEmployeeOnlyEdit && job
        ? {
            storeId: job.storeId || storeId,
            customerName: job.customerName,
            customerPhone: job.customerPhone,
            serviceAddress: job.serviceAddress,
            latitude: job.latitude,
            longitude: job.longitude,
            geofenceRadius: job.geofenceRadius,
            scheduledStart: job.scheduledStart,
            scheduledEnd: job.scheduledEnd,
            serviceType: job.serviceType?.trim() || "",
            notes: job.notes,
          }
        : {
            storeId: job?.storeId || storeId,
            customerName: values.customerName.trim(),
            customerPhone: values.customerPhone.trim(),
            serviceAddress: values.serviceAddress.trim(),
            latitude: geo.latitude,
            longitude: geo.longitude,
            geofenceRadius: geo.geofenceRadius,
            scheduledStart: toLocalDateTimeString(scheduledStart),
            scheduledEnd: toLocalDateTimeString(scheduledEnd),
            serviceType: values.serviceType.trim(),
            notes: values.notes?.trim() || undefined,
          };

      await onSubmit({
        ...upsertPayload,
        merchantAdminIds: selectedIds,
        syncStoreClockIn: selectedIds.length === 1 ? appliedSync.syncStoreClockIn : false,
        syncStoreClockOut: selectedIds.length === 1 ? appliedSync.syncStoreClockOut : false,
        assignmentsOnly: isEmployeeOnlyEdit,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={
        isEmployeeOnlyEdit
          ? String(labels.editAssignedTitle)
          : job
            ? String(labels.edit)
            : String(labels.create)
      }
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={submitting}
      width={760}
      destroyOnClose
      maskClosable={false}
      okText={isEmployeeOnlyEdit ? String(labels.reassignConfirm) : undefined}
      styles={{
        body: {
          maxHeight: "calc(100vh - 160px)",
          overflowY: "auto",
          paddingTop: 8,
        },
      }}
    >
      <Form form={form} layout="vertical" className="mt-1">
        {isEmployeeOnlyEdit ? (
          <Alert type="info" showIcon className="mb-3" message={String(labels.editAssignedHint)} />
        ) : null}
        {employeeError ? (
          <Alert type="error" showIcon className="mb-3" message={employeeError} />
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <Form.Item
            name="customerName"
            label={String(labels.customerName)}
            rules={[{ required: true, message: String(labels.customerRequired) }]}
          >
            <Input disabled={isEmployeeOnlyEdit} />
          </Form.Item>
          <Form.Item name="customerPhone" label={String(labels.customerPhone)}>
            <Input disabled={isEmployeeOnlyEdit} />
          </Form.Item>
        </div>

        <Form.Item
          name="serviceAddress"
          label={String(labels.serviceAddress)}
          rules={[{ required: true, message: String(labels.addressRequired) }]}
          extra={
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              {String(labels.addressLocateHint)}
            </span>
          }
        >
          <GoogleAddressAutocompleteInput
            disabled={isEmployeeOnlyEdit}
            placeholder={String(labels.serviceAddressPlaceholder)}
            onPlaceSelected={isEmployeeOnlyEdit ? undefined : applyGeoFromPlace}
            onInputComplete={isEmployeeOnlyEdit ? undefined : handleAddressInputComplete}
          />
        </Form.Item>

        <div className="grid gap-3 md:grid-cols-2">
          <Form.Item
            name="serviceType"
            label={String(labels.serviceType)}
            rules={[
              { required: true, message: String(labels.serviceTypeRequired) },
              { max: 64, message: String(labels.serviceTypeMaxLength) },
            ]}
          >
            <Input
              disabled={isEmployeeOnlyEdit}
              maxLength={64}
              placeholder={String(labels.serviceTypePlaceholder)}
            />
          </Form.Item>
          <Form.Item
            name="serviceDate"
            label={String(labels.serviceDate)}
            rules={[{ required: true, message: String(labels.dateRequired) }]}
          >
            <DatePicker className="w-full" format="YYYY-MM-DD" disabled={isEmployeeOnlyEdit} />
          </Form.Item>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Form.Item
            label={String(labels.scheduledStart)}
            required
            validateStatus={timeRangeError ? "error" : undefined}
            help={timeRangeError || undefined}
          >
            <HourMinuteTimePicker
              className="w-full"
              disabled={isEmployeeOnlyEdit}
              minuteStep={FIELD_JOB_TIME_MINUTE_STEP}
              locale={locale}
              value={timeValue(startTime)}
              onChange={(time) => applyTimeChange(time, setStartTime)}
            />
          </Form.Item>
          <Form.Item
            label={String(labels.scheduledEnd)}
            required
            validateStatus={timeRangeError ? "error" : undefined}
          >
            <HourMinuteTimePicker
              className="w-full"
              disabled={isEmployeeOnlyEdit}
              minuteStep={FIELD_JOB_TIME_MINUTE_STEP}
              locale={locale}
              value={timeValue(endTime, getDefaultFieldJobEndTime(startTime))}
              onChange={(time) => applyTimeChange(time, setEndTime)}
            />
          </Form.Item>
        </div>

        <Form.Item
          name="merchantAdminIds"
          label={String(labels.employee)}
          validateStatus={employeeError ? "error" : undefined}
          help={employeeError || (
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              {String(
                isEmployeeOnlyEdit
                  ? labels.formEmployeeReassignHint
                  : labels.formEmployeeHint,
              )}
            </span>
          )}
          getValueFromEvent={(value) =>
            normalizeEmployeeAdminIds(value as Array<string | number> | undefined)
          }
        >
          <Select
            allowClear
            showSearch
            mode="multiple"
            className="w-full"
            placeholder={String(labels.selectEmployeeOptional)}
            options={availableEmployees.map((employee) => ({
              value: String(employee.id),
              label: employee.name,
            }))}
            optionFilterProp="label"
          />
        </Form.Item>

        {singleSelectedEmployeeId && scheduledWindow ? (
          <FieldJobStoreSyncFields
            preview={syncPreview}
            scheduledStart={scheduledWindow.scheduledStart}
            scheduledEnd={scheduledWindow.scheduledEnd}
            loading={loadingSyncPreview}
            labels={labels}
            value={syncValue}
            onChange={setSyncValue}
            validationErrors={syncErrors}
          />
        ) : selectedEmployeeIds.length > 1 ? (
          <Alert type="info" showIcon message={String(labels.multiEmployeeAssignHint)} />
        ) : null}

        <Form.Item label={String(labels.geofenceRadius)}>
          <div className={isEmployeeOnlyEdit ? "pointer-events-none opacity-70" : undefined}>
            <GeoFenceMapPicker
              value={geo}
              compact
              hideSearch
              addressQuery={serviceAddress || ""}
              preservedGeocodeAddress={preservedGeocodeAddress}
              locateNow={isEmployeeOnlyEdit ? 0 : locateNow}
              geofenceDesc={String(labels.geofenceDesc)}
              onChange={
                isEmployeeOnlyEdit
                  ? undefined
                  : (next) => {
                      setGeo(next);
                      form.setFieldsValue({
                        latitude: next.latitude,
                        longitude: next.longitude,
                        geofenceRadius: next.geofenceRadius,
                      });
                    }
              }
            />
          </div>
        </Form.Item>

        <Form.Item name="notes" label={String(labels.notes)}>
          <TextArea rows={3} disabled={isEmployeeOnlyEdit} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

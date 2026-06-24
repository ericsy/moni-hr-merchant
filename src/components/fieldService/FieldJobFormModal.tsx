import { DatePicker, Form, Input, Modal, Select, TimePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useState } from "react";
import GeoFenceMapPicker from "../GeoFenceMapPicker";
import GoogleAddressAutocompleteInput from "../GoogleAddressAutocompleteInput";
import type { GooglePlaceSummary } from "../../lib/googleMaps";
import type { FieldJobUpsertPayload, FieldServiceJob } from "../../types/fieldService";

const { TextArea } = Input;

const TIME_ONLY_DATE = "2000-01-01";

export interface FieldJobFormValues {
  customerName: string;
  customerPhone: string;
  serviceAddress: string;
  serviceType: string;
  serviceDate: Dayjs;
  latitude: number;
  longitude: number;
  geofenceRadius: number;
  notes?: string;
}

interface FieldJobFormModalProps {
  open: boolean;
  job?: FieldServiceJob | null;
  locale: "zh" | "en";
  labels: Record<string, unknown>;
  onCancel: () => void;
  onSubmit: (payload: FieldJobUpsertPayload) => Promise<void>;
}

function getServiceTypeOptions(labels: Record<string, unknown>) {
  const types = (labels.serviceTypes || {}) as Record<string, string>;
  return Object.entries(types).map(([value, label]) => ({ value, label }));
}

function timeValue(value?: Dayjs | string | null, fallback = "09:00") {
  if (dayjs.isDayjs(value) && value.isValid()) {
    return dayjs(`${TIME_ONLY_DATE} ${value.format("HH:mm")}`, "YYYY-MM-DD HH:mm");
  }
  const text = typeof value === "string" && /^\d{1,2}:\d{2}$/.test(value) ? value : fallback;
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

function applyTimeChange(
  time: Dayjs | Dayjs[] | null,
  onChange: (next: string) => void,
) {
  if (!time || Array.isArray(time) || !time.isValid()) return;
  onChange(time.format("HH:mm"));
}

export default function FieldJobFormModal({
  open,
  job,
  labels,
  onCancel,
  onSubmit,
}: FieldJobFormModalProps) {
  const [form] = Form.useForm<FieldJobFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");
  const [timeError, setTimeError] = useState("");
  const [locateNow, setLocateNow] = useState(0);
  const [preservedGeocodeAddress, setPreservedGeocodeAddress] = useState("");
  const serviceAddress = Form.useWatch("serviceAddress", form);
  const [geo, setGeo] = useState({
    latitude: job?.latitude ?? -36.8485,
    longitude: job?.longitude ?? 174.7633,
    geofenceRadius: job?.geofenceRadius ?? 100,
  });

  useEffect(() => {
    if (!open) return;

    if (job) {
      const start = dayjs(job.scheduledStart);
      const end = dayjs(job.scheduledEnd);
      form.setFieldsValue({
        customerName: job.customerName,
        customerPhone: job.customerPhone,
        serviceAddress: job.serviceAddress,
        serviceType: job.serviceType || "cleaning",
        serviceDate: start.startOf("day"),
        latitude: job.latitude,
        longitude: job.longitude,
        geofenceRadius: job.geofenceRadius,
        notes: job.notes,
      });
      setStartTime(toTimeString(start));
      setEndTime(toTimeString(end, 11, 0));
      setTimeError("");
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
    form.setFieldsValue({
      serviceType: "cleaning",
      serviceDate: today,
      geofenceRadius: 100,
    });
    setStartTime("09:00");
    setEndTime("11:00");
    setTimeError("");
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
      const values = await form.validateFields();
      const scheduledStart = combineDateAndTime(values.serviceDate, startTime);
      const scheduledEnd = combineDateAndTime(values.serviceDate, endTime);

      if (!scheduledEnd.isAfter(scheduledStart)) {
        setTimeError(String(labels.endTimeInvalid));
        return;
      }
      setTimeError("");

      setSubmitting(true);
      await onSubmit({
        storeId: job?.storeId || "",
        customerName: values.customerName.trim(),
        customerPhone: values.customerPhone.trim(),
        serviceAddress: values.serviceAddress.trim(),
        latitude: geo.latitude,
        longitude: geo.longitude,
        geofenceRadius: geo.geofenceRadius,
        scheduledStart: toLocalDateTimeString(scheduledStart),
        scheduledEnd: toLocalDateTimeString(scheduledEnd),
        serviceType: values.serviceType,
        notes: values.notes?.trim() || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={job ? String(labels.edit) : String(labels.create)}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={submitting}
      width={760}
      destroyOnClose
    >
      <Form form={form} layout="vertical" className="mt-2">
        <div className="grid gap-3 md:grid-cols-2">
          <Form.Item
            name="customerName"
            label={String(labels.customerName)}
            rules={[{ required: true, message: String(labels.customerRequired) }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="customerPhone" label={String(labels.customerPhone)}>
            <Input />
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
            placeholder={String(labels.serviceAddressPlaceholder)}
            onPlaceSelected={applyGeoFromPlace}
            onInputComplete={handleAddressInputComplete}
          />
        </Form.Item>

        <div className="grid gap-3 md:grid-cols-2">
          <Form.Item name="serviceType" label={String(labels.serviceType)}>
            <Select options={getServiceTypeOptions(labels)} />
          </Form.Item>
          <Form.Item
            name="serviceDate"
            label={String(labels.serviceDate)}
            rules={[{ required: true, message: String(labels.dateRequired) }]}
          >
            <DatePicker className="w-full" format="YYYY-MM-DD" />
          </Form.Item>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Form.Item
            label={String(labels.scheduledStart)}
            required
            validateStatus={timeError ? "error" : undefined}
          >
            <TimePicker
              className="w-full"
              format="HH:mm"
              minuteStep={5}
              value={timeValue(startTime, "09:00")}
              onChange={(time) => applyTimeChange(time, setStartTime)}
              onCalendarChange={(time) => applyTimeChange(time, setStartTime)}
              onOk={(time) => applyTimeChange(time, setStartTime)}
            />
          </Form.Item>
          <Form.Item
            label={String(labels.scheduledEnd)}
            required
            validateStatus={timeError ? "error" : undefined}
            help={timeError || undefined}
          >
            <TimePicker
              className="w-full"
              format="HH:mm"
              minuteStep={5}
              value={timeValue(endTime, "11:00")}
              onChange={(time) => applyTimeChange(time, setEndTime)}
              onCalendarChange={(time) => applyTimeChange(time, setEndTime)}
              onOk={(time) => applyTimeChange(time, setEndTime)}
            />
          </Form.Item>
        </div>

        <Form.Item label={String(labels.geofenceRadius)}>
          <GeoFenceMapPicker
            value={geo}
            hideSearch
            addressQuery={serviceAddress || ""}
            preservedGeocodeAddress={preservedGeocodeAddress}
            locateNow={locateNow}
            geofenceDesc={String(labels.geofenceDesc)}
            onChange={(next) => {
              setGeo(next);
              form.setFieldsValue({
                latitude: next.latitude,
                longitude: next.longitude,
                geofenceRadius: next.geofenceRadius,
              });
            }}
          />
        </Form.Item>

        <Form.Item name="notes" label={String(labels.notes)}>
          <TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

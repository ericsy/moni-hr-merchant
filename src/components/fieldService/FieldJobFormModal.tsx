import { DatePicker, Form, Input, Modal, Select, TimePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useState } from "react";
import GeoFenceMapPicker from "../GeoFenceMapPicker";
import type { FieldJobUpsertPayload, FieldServiceJob } from "../../types/fieldService";

const { TextArea } = Input;

export interface FieldJobFormValues {
  customerName: string;
  customerPhone: string;
  serviceAddress: string;
  serviceType: string;
  serviceDate: Dayjs;
  startTime: Dayjs;
  endTime: Dayjs;
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

function toTimeValue(source?: Dayjs | string, fallbackHour = 9, fallbackMinute = 0) {
  const parsed = source ? dayjs(source) : null;
  if (!parsed?.isValid()) {
    return dayjs().hour(fallbackHour).minute(fallbackMinute).second(0).millisecond(0);
  }
  return dayjs().hour(parsed.hour()).minute(parsed.minute()).second(0).millisecond(0);
}

function combineDateAndTime(serviceDate: Dayjs, time: Dayjs) {
  return serviceDate
    .hour(time.hour())
    .minute(time.minute())
    .second(0)
    .millisecond(0);
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
        startTime: toTimeValue(start),
        endTime: toTimeValue(end, 11, 0),
        latitude: job.latitude,
        longitude: job.longitude,
        geofenceRadius: job.geofenceRadius,
        notes: job.notes,
      });
      setGeo({
        latitude: job.latitude,
        longitude: job.longitude,
        geofenceRadius: job.geofenceRadius,
      });
      return;
    }

    form.resetFields();
    const today = dayjs().startOf("day");
    form.setFieldsValue({
      serviceType: "cleaning",
      serviceDate: today,
      startTime: toTimeValue(undefined, 9, 0),
      endTime: toTimeValue(undefined, 11, 0),
      geofenceRadius: 100,
    });
    setGeo({ latitude: -36.8485, longitude: 174.7633, geofenceRadius: 100 });
  }, [form, job, open]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const scheduledStart = combineDateAndTime(values.serviceDate, values.startTime);
      const scheduledEnd = combineDateAndTime(values.serviceDate, values.endTime);

      if (!scheduledEnd.isAfter(scheduledStart)) {
        form.setFields([
          {
            name: "endTime",
            errors: [String(labels.endTimeInvalid)],
          },
        ]);
        return;
      }

      setSubmitting(true);
      await onSubmit({
        storeId: job?.storeId || "",
        customerName: values.customerName.trim(),
        customerPhone: values.customerPhone.trim(),
        serviceAddress: values.serviceAddress.trim(),
        latitude: geo.latitude,
        longitude: geo.longitude,
        geofenceRadius: geo.geofenceRadius,
        scheduledStart: scheduledStart.toISOString(),
        scheduledEnd: scheduledEnd.toISOString(),
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
        >
          <Input />
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
            name="startTime"
            label={String(labels.scheduledStart)}
            rules={[{ required: true, message: String(labels.timeRequired) }]}
          >
            <TimePicker className="w-full" format="HH:mm" minuteStep={5} needConfirm={false} />
          </Form.Item>
          <Form.Item
            name="endTime"
            label={String(labels.scheduledEnd)}
            rules={[{ required: true, message: String(labels.timeRequired) }]}
          >
            <TimePicker className="w-full" format="HH:mm" minuteStep={5} needConfirm={false} />
          </Form.Item>
        </div>

        <Form.Item label={String(labels.geofenceRadius)}>
          <GeoFenceMapPicker
            value={geo}
            defaultLocationQuery={form.getFieldValue("serviceAddress") || ""}
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

import { Checkbox, DatePicker, Form, Input, InputNumber, Modal, Select } from "antd";
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
  scheduledRange: [Dayjs, Dayjs];
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

export default function FieldJobFormModal({
  open,
  job,
  locale,
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
      form.setFieldsValue({
        customerName: job.customerName,
        customerPhone: job.customerPhone,
        serviceAddress: job.serviceAddress,
        serviceType: job.serviceType || "cleaning",
        scheduledRange: [dayjs(job.scheduledStart), dayjs(job.scheduledEnd)],
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
    form.setFieldsValue({
      serviceType: "cleaning",
      scheduledRange: [
        dayjs().hour(9).minute(0).second(0),
        dayjs().hour(11).minute(0).second(0),
      ],
      geofenceRadius: 100,
    });
    setGeo({ latitude: -36.8485, longitude: 174.7633, geofenceRadius: 100 });
  }, [form, job, open]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const [start, end] = values.scheduledRange;
      await onSubmit({
        storeId: job?.storeId || "",
        customerName: values.customerName.trim(),
        customerPhone: values.customerPhone.trim(),
        serviceAddress: values.serviceAddress.trim(),
        latitude: geo.latitude,
        longitude: geo.longitude,
        geofenceRadius: geo.geofenceRadius,
        scheduledStart: start.toISOString(),
        scheduledEnd: end.toISOString(),
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
          <Input
            onChange={(event) => {
              const value = event.target.value;
              form.setFieldValue("serviceAddress", value);
            }}
          />
        </Form.Item>

        <div className="grid gap-3 md:grid-cols-2">
          <Form.Item name="serviceType" label={String(labels.serviceType)}>
            <Select options={getServiceTypeOptions(labels)} />
          </Form.Item>
          <Form.Item
            name="scheduledRange"
            label={`${String(labels.scheduledStart)} - ${String(labels.scheduledEnd)}`}
            rules={[{ required: true, message: String(labels.timeRequired) }]}
          >
            <DatePicker.RangePicker
              showTime={{ format: "HH:mm" }}
              format="YYYY-MM-DD HH:mm"
              className="w-full"
            />
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

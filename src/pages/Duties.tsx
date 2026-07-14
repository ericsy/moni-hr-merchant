import { useEffect, useMemo, useState } from "react";
import {
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Switch,
  Table,
  Tag,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "../context/LocaleContext";
import { useStore } from "../context/StoreContext";
import { useData } from "../context/DataContext";
import {
  merchantApi,
  type DutyCompletionApi,
  type DutyTemplateApi,
} from "../lib/merchantApi";

const TRIGGER_OPTIONS = [
  { value: "clock_in", zh: "上班必做", en: "Clock-in" },
  { value: "clock_out", zh: "下班必做", en: "Clock-out" },
  { value: "recurring", zh: "分钟重复", en: "Recurring" },
];

export default function Duties() {
  const { locale } = useLocale();
  const { selectedStoreId } = useStore();
  const { employees } = useData();
  const zh = locale === "zh";

  const [templates, setTemplates] = useState<DutyTemplateApi[]>([]);
  const [completions, setCompletions] = useState<DutyCompletionApi[]>([]);
  const [loading, setLoading] = useState(false);
  const [completionDate, setCompletionDate] = useState<Dayjs>(() => dayjs());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DutyTemplateApi | null>(null);
  const [form] = Form.useForm();
  const [assigneeForm] = Form.useForm();
  const [dailyDate, setDailyDate] = useState<Dayjs>(() => dayjs());
  const [assigneeModal, setAssigneeModal] = useState<DutyTemplateApi | null>(null);

  const storeEmployees = useMemo(
    () =>
      (employees || []).filter((e) => {
        if (!selectedStoreId || selectedStoreId === "all") return true;
        const ids = (e.storeIds || []).map(String);
        return ids.includes(String(selectedStoreId));
      }),
    [employees, selectedStoreId],
  );

  const employeeOptions = storeEmployees.map((e) => ({
    value: Number(e.id),
    label: [e.firstName, e.lastName].filter(Boolean).join(" ") || e.email || String(e.id),
  }));

  const reload = async () => {
    if (!selectedStoreId || selectedStoreId === "all") {
      setTemplates([]);
      setCompletions([]);
      return;
    }
    setLoading(true);
    try {
      const [tpl, comps] = await Promise.all([
        merchantApi.listDutyTemplates(String(selectedStoreId)),
        merchantApi.listDutyCompletions(String(selectedStoreId), completionDate.format("YYYY-MM-DD")),
      ]);
      setTemplates(tpl);
      setCompletions(comps);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId, completionDate]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      triggerType: "clock_in",
      assignmentMode: "fixed",
      required: true,
      intervalMinutes: 30,
    });
    setModalOpen(true);
  };

  const openEdit = (row: DutyTemplateApi) => {
    setEditing(row);
    form.setFieldsValue({
      title: row.title,
      description: row.description,
      triggerType: row.triggerType,
      assignmentMode: row.assignmentMode || "fixed",
      required: row.required !== false,
      intervalMinutes: row.intervalMinutes ?? 30,
      status: row.status === 0 ? 0 : 1,
    });
    setModalOpen(true);
  };

  const saveTemplate = async () => {
    if (!selectedStoreId || selectedStoreId === "all") {
      toast.error(zh ? "请先选择门店" : "Select a store first");
      return;
    }
    const values = await form.validateFields();
    try {
      if (editing?.id) {
        await merchantApi.patchDutyTemplate(String(editing.id), {
          title: values.title,
          description: values.description,
          triggerType: values.triggerType,
          assignmentMode: values.assignmentMode,
          required: values.required,
          intervalMinutes: values.triggerType === "recurring" ? values.intervalMinutes : null,
          status: values.status,
        });
      } else {
        await merchantApi.createDutyTemplate(String(selectedStoreId), {
          title: values.title,
          description: values.description,
          triggerType: values.triggerType,
          assignmentMode: values.assignmentMode,
          required: values.required,
          intervalMinutes: values.triggerType === "recurring" ? values.intervalMinutes : undefined,
        });
      }
      toast.success(zh ? "已保存" : "Saved");
      setModalOpen(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  };

  const openAssignees = async (row: DutyTemplateApi) => {
    setAssigneeModal(row);
    if ((row.assignmentMode || "fixed") === "by_date") {
      const ids = await merchantApi.listDutyDailyAssignees(
        String(row.id),
        dailyDate.format("YYYY-MM-DD"),
      );
      assigneeForm.setFieldsValue({ merchantAdminIds: ids });
    } else {
      assigneeForm.setFieldsValue({ merchantAdminIds: row.fixedAssigneeIds || [] });
    }
  };

  const saveAssignees = async () => {
    if (!assigneeModal?.id) return;
    const values = await assigneeForm.validateFields();
    try {
      if ((assigneeModal.assignmentMode || "fixed") === "by_date") {
        await merchantApi.replaceDutyDailyAssignees(
          String(assigneeModal.id),
          dailyDate.format("YYYY-MM-DD"),
          values.merchantAdminIds || [],
        );
      } else {
        await merchantApi.replaceDutyFixedAssignees(String(assigneeModal.id), values.merchantAdminIds || []);
      }
      toast.success(zh ? "委派已更新" : "Assignees updated");
      setAssigneeModal(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold m-0">{zh ? "门店 Duties" : "Store Duties"}</h1>
          <p className="text-slate-500 text-sm m-0 mt-1">
            {zh
              ? "配置上班/下班必做与分钟重复任务；固定委派或按日分派。打卡前须完成必做；免打卡按排班时间窗弹出。"
              : "Configure clock-in/out required duties and recurring tasks. Fixed or daily assignees. Duties gate punch; punch-exempt stores use schedule windows."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button icon={<RefreshCw size={16} />} onClick={() => void reload()} loading={loading}>
            {zh ? "刷新" : "Refresh"}
          </Button>
          <Button type="primary" icon={<Plus size={16} />} onClick={openCreate}>
            {zh ? "新建模板" : "New template"}
          </Button>
        </div>
      </div>

      {!selectedStoreId || selectedStoreId === "all" ? (
        <div className="text-slate-500">{zh ? "请选择具体门店后管理 Duties" : "Select a concrete store to manage duties"}</div>
      ) : (
        <>
          <Table
            rowKey={(r) => String(r.id)}
            loading={loading}
            dataSource={templates}
            pagination={false}
            columns={[
              { title: zh ? "标题" : "Title", dataIndex: "title" },
              {
                title: zh ? "触发" : "Trigger",
                dataIndex: "triggerType",
                render: (v: string, row) => {
                  const opt = TRIGGER_OPTIONS.find((o) => o.value === v);
                  return (
                    <span>
                      {zh ? opt?.zh : opt?.en}
                      {v === "recurring" ? ` / ${row.intervalMinutes || "-"}m` : ""}
                    </span>
                  );
                },
              },
              {
                title: zh ? "委派" : "Assign",
                dataIndex: "assignmentMode",
                render: (v: string) => (v === "by_date" ? (zh ? "按日" : "By date") : zh ? "固定" : "Fixed"),
              },
              {
                title: zh ? "必做" : "Required",
                dataIndex: "required",
                render: (v: boolean) => (v === false ? <Tag>optional</Tag> : <Tag color="blue">required</Tag>),
              },
              {
                title: zh ? "状态" : "Status",
                dataIndex: "status",
                render: (v: number) => (v === 0 ? <Tag>off</Tag> : <Tag color="green">on</Tag>),
              },
              {
                title: zh ? "操作" : "Actions",
                render: (_: unknown, row: DutyTemplateApi) => (
                  <div className="flex gap-2">
                    <Button size="small" onClick={() => openEdit(row)}>
                      {zh ? "编辑" : "Edit"}
                    </Button>
                    <Button size="small" onClick={() => void openAssignees(row)}>
                      {zh ? "委派" : "Assign"}
                    </Button>
                    <Button
                      size="small"
                      danger
                      onClick={() => {
                        Modal.confirm({
                          title: zh ? "删除模板？" : "Delete template?",
                          onOk: async () => {
                            await merchantApi.deleteDutyTemplate(String(row.id));
                            toast.success(zh ? "已删除" : "Deleted");
                            await reload();
                          },
                        });
                      }}
                    >
                      {zh ? "删除" : "Delete"}
                    </Button>
                  </div>
                ),
              },
            ]}
          />

          <div className="flex items-center gap-3 mt-8">
            <h2 className="text-base font-semibold m-0">{zh ? "完成情况" : "Completions"}</h2>
            <DatePicker value={completionDate} onChange={(d) => d && setCompletionDate(d)} />
          </div>
          <Table
            rowKey={(r) => String(r.id)}
            loading={loading}
            dataSource={completions}
            pagination={{ pageSize: 20 }}
            columns={[
              { title: zh ? "标题" : "Title", dataIndex: "title" },
              { title: zh ? "员工" : "Employee", dataIndex: "merchantAdminId" },
              { title: zh ? "触发" : "Trigger", dataIndex: "triggerType" },
              {
                title: zh ? "状态" : "Status",
                dataIndex: "status",
                render: (v: string) => <Tag color={v === "completed" ? "green" : v === "expired" ? "red" : "default"}>{v}</Tag>,
              },
              { title: zh ? "完成时间" : "Completed", dataIndex: "completedAt" },
            ]}
          />
        </>
      )}

      <Modal
        open={modalOpen}
        title={editing ? (zh ? "编辑模板" : "Edit template") : zh ? "新建模板" : "New template"}
        onCancel={() => setModalOpen(false)}
        onOk={() => void saveTemplate()}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label={zh ? "标题" : "Title"} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={zh ? "说明" : "Description"}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="triggerType" label={zh ? "触发类型" : "Trigger"} rules={[{ required: true }]}>
            <Select
              options={TRIGGER_OPTIONS.map((o) => ({ value: o.value, label: zh ? o.zh : o.en }))}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(p, c) => p.triggerType !== c.triggerType}>
            {() =>
              form.getFieldValue("triggerType") === "recurring" ? (
                <Form.Item
                  name="intervalMinutes"
                  label={zh ? "间隔（分钟）" : "Interval (minutes)"}
                  rules={[{ required: true }]}
                >
                  <InputNumber min={1} className="w-full" />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item name="assignmentMode" label={zh ? "委派模式" : "Assignment mode"}>
            <Select
              options={[
                { value: "fixed", label: zh ? "固定人员" : "Fixed" },
                { value: "by_date", label: zh ? "按日分派" : "By date" },
              ]}
            />
          </Form.Item>
          <Form.Item name="required" label={zh ? "必做" : "Required"} valuePropName="checked">
            <Switch />
          </Form.Item>
          {editing ? (
            <Form.Item name="status" label={zh ? "启用" : "Enabled"}>
              <Select
                options={[
                  { value: 1, label: zh ? "启用" : "On" },
                  { value: 0, label: zh ? "停用" : "Off" },
                ]}
              />
            </Form.Item>
          ) : null}
        </Form>
      </Modal>

      <Modal
        open={!!assigneeModal}
        title={zh ? "委派员工" : "Assign employees"}
        onCancel={() => setAssigneeModal(null)}
        onOk={() => void saveAssignees()}
        destroyOnClose
      >
        {(assigneeModal?.assignmentMode || "fixed") === "by_date" ? (
          <div className="mb-3">
            <span className="mr-2">{zh ? "日期" : "Date"}</span>
            <DatePicker
              value={dailyDate}
              onChange={async (d) => {
                if (!d || !assigneeModal?.id) return;
                setDailyDate(d);
                const ids = await merchantApi.listDutyDailyAssignees(String(assigneeModal.id), d.format("YYYY-MM-DD"));
                assigneeForm.setFieldsValue({ merchantAdminIds: ids });
              }}
            />
          </div>
        ) : null}
        <Form form={assigneeForm} layout="vertical">
          <Form.Item name="merchantAdminIds" label={zh ? "员工" : "Employees"}>
            <Select mode="multiple" options={employeeOptions} optionFilterProp="label" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

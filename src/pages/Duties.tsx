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
  Tooltip,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { ChevronLeft, ChevronRight, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "../context/LocaleContext";
import { useStore } from "../context/StoreContext";
import { useData } from "../context/DataContext";
import {
  merchantApi,
  type DutyCalendarEntryApi,
  type DutyTemplateApi,
} from "../lib/merchantApi";

const TRIGGER_OPTIONS = [
  { value: "clock_in", zh: "上班必做", en: "Clock-in" },
  { value: "clock_out", zh: "下班必做", en: "Clock-out" },
  { value: "recurring", zh: "分钟重复", en: "Recurring" },
];

type CalStatus = "scheduled" | "pending" | "completed" | "expired" | "skipped" | "partial";

const STATUS_META: Record<CalStatus, { color: string; zh: string; en: string }> = {
  scheduled: { color: "default", zh: "已排未生成", en: "Scheduled" },
  pending: { color: "gold", zh: "待完成", en: "Pending" },
  completed: { color: "green", zh: "已完成", en: "Completed" },
  expired: { color: "red", zh: "已过期", en: "Expired" },
  skipped: { color: "default", zh: "已跳过", en: "Skipped" },
  partial: { color: "orange", zh: "部分完成", en: "Partial" },
};

function startOfWeekMonday(d: Dayjs): Dayjs {
  // dayjs day(): 0=Sun..6=Sat; shift so Monday=0
  const offset = (d.day() + 6) % 7;
  return d.subtract(offset, "day").startOf("day");
}

export default function Duties() {
  const { locale } = useLocale();
  const { selectedStoreId } = useStore();
  const { employees } = useData();
  const zh = locale === "zh";

  const [templates, setTemplates] = useState<DutyTemplateApi[]>([]);
  const [calendarEntries, setCalendarEntries] = useState<DutyCalendarEntryApi[]>([]);
  const [loading, setLoading] = useState(false);
  const [calLoading, setCalLoading] = useState(false);
  const [weekStart, setWeekStart] = useState<Dayjs>(() => startOfWeekMonday(dayjs()));
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DutyTemplateApi | null>(null);
  const [form] = Form.useForm();
  const [assigneeForm] = Form.useForm();
  const [dailyDate, setDailyDate] = useState<Dayjs>(() => dayjs());
  const [assigneeModal, setAssigneeModal] = useState<DutyTemplateApi | null>(null);
  // 按日委派：当日可委派员工（有排班且未请假）；null 表示未加载
  const [eligibleIds, setEligibleIds] = useState<number[] | null>(null);

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

  const byDateModal = (assigneeModal?.assignmentMode || "fixed") === "by_date";
  const selectedAssigneeIds: number[] = Form.useWatch("merchantAdminIds", assigneeForm) || [];

  // 按日委派下拉仅显示当日有排班且未请假的员工；固定委派显示全店员工。
  // 已选中但已不可委派的人（如事后批假）仍保留在选项中以便展示姓名与移除，保存时后端会拒绝。
  const assigneeOptions = useMemo(() => {
    if (!byDateModal || eligibleIds === null) return employeeOptions;
    const allow = new Set(eligibleIds.map(Number));
    const selected = new Set((selectedAssigneeIds || []).map(Number));
    return employeeOptions
      .filter((o) => allow.has(o.value) || selected.has(o.value))
      .map((o) =>
        allow.has(o.value)
          ? o
          : { ...o, label: `${o.label}${zh ? "（当日不可委派）" : " (unavailable)"}` },
      );
  }, [byDateModal, eligibleIds, employeeOptions, selectedAssigneeIds, zh]);

  const loadEligible = async (date: Dayjs) => {
    if (!selectedStoreId || selectedStoreId === "all") return;
    try {
      const ids = await merchantApi.listDutyEligibleAssignees(
        String(selectedStoreId),
        date.format("YYYY-MM-DD"),
      );
      setEligibleIds(ids.map(Number));
    } catch {
      setEligibleIds(null);
    }
  };

  const employeeNameById = useMemo(() => {
    const map = new Map<string, string>();
    (employees || []).forEach((e) => {
      const name = [e.firstName, e.lastName].filter(Boolean).join(" ") || e.email || String(e.id);
      map.set(String(e.id), name);
    });
    return map;
  }, [employees]);

  const nameOf = (adminId: number | string | undefined) => {
    const key = String(adminId ?? "");
    return employeeNameById.get(key) || `#${key}`;
  };

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => weekStart.add(i, "day")),
    [weekStart],
  );

  // templateId -> dateStr -> entries[]
  const calGrid = useMemo(() => {
    const map = new Map<string, Map<string, DutyCalendarEntryApi[]>>();
    calendarEntries.forEach((e) => {
      const tid = String(e.templateId ?? "");
      const dt = e.workDate || "";
      if (!map.has(tid)) map.set(tid, new Map());
      const inner = map.get(tid)!;
      if (!inner.has(dt)) inner.set(dt, []);
      inner.get(dt)!.push(e);
    });
    return map;
  }, [calendarEntries]);

  const hasConcreteStore = !!selectedStoreId && selectedStoreId !== "all";

  const reloadTemplates = async () => {
    if (!hasConcreteStore) {
      setTemplates([]);
      return;
    }
    setLoading(true);
    try {
      const tpl = await merchantApi.listDutyTemplates(String(selectedStoreId));
      setTemplates(tpl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  const reloadCalendar = async () => {
    if (!hasConcreteStore) {
      setCalendarEntries([]);
      return;
    }
    setCalLoading(true);
    try {
      const from = weekStart.format("YYYY-MM-DD");
      const to = weekStart.add(6, "day").format("YYYY-MM-DD");
      const items = await merchantApi.listDutyCalendar(String(selectedStoreId), from, to);
      setCalendarEntries(items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Load failed");
    } finally {
      setCalLoading(false);
    }
  };

  useEffect(() => {
    void reloadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId]);

  useEffect(() => {
    void reloadCalendar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId, weekStart]);

  const reloadAll = async () => {
    await Promise.all([reloadTemplates(), reloadCalendar()]);
  };

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
    if (!hasConcreteStore) {
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
      await reloadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  };

  const openAssignees = async (row: DutyTemplateApi, presetDate?: Dayjs) => {
    setAssigneeModal(row);
    if ((row.assignmentMode || "fixed") === "by_date") {
      const date = presetDate || dailyDate;
      setDailyDate(date);
      setEligibleIds(null);
      const [ids] = await Promise.all([
        merchantApi.listDutyDailyAssignees(String(row.id), date.format("YYYY-MM-DD")),
        loadEligible(date),
      ]);
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
      await reloadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  const rangeLabel = `${weekStart.format("YYYY/MM/DD")} - ${weekStart.add(6, "day").format("MM/DD")}`;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold m-0">{zh ? "门店 Duties" : "Store Duties"}</h1>
          <p className="text-slate-500 text-sm m-0 mt-1">
            {zh
              ? "配置上班/下班必做与分钟重复任务；固定委派或按日分派。固定委派仅在该员工当天有排班时生效并落到日历。"
              : "Configure clock-in/out required duties and recurring tasks. Fixed assignees apply only on days the employee is scheduled, and are projected onto the calendar."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button icon={<RefreshCw size={16} />} onClick={() => void reloadAll()} loading={loading || calLoading}>
            {zh ? "刷新" : "Refresh"}
          </Button>
          <Button type="primary" icon={<Plus size={16} />} onClick={openCreate}>
            {zh ? "新建模板" : "New template"}
          </Button>
        </div>
      </div>

      {!hasConcreteStore ? (
        <div className="text-slate-500">{zh ? "请选择具体门店后管理 Duties" : "Select a concrete store to manage duties"}</div>
      ) : (
        <>
          {/* 周日历视图 */}
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-base font-semibold m-0">{zh ? "委派日历" : "Duty Calendar"}</h2>
            <div className="flex items-center gap-1">
              <Button size="small" icon={<ChevronLeft size={16} />} onClick={() => setWeekStart((w) => w.subtract(7, "day"))} />
              <Button size="small" onClick={() => setWeekStart(startOfWeekMonday(dayjs()))}>
                {zh ? "本周" : "This week"}
              </Button>
              <Button size="small" icon={<ChevronRight size={16} />} onClick={() => setWeekStart((w) => w.add(7, "day"))} />
            </div>
            <span className="text-slate-500 text-sm">{rangeLabel}</span>
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              {(Object.keys(STATUS_META) as CalStatus[]).map((s) => (
                <Tag key={s} color={STATUS_META[s].color}>
                  {zh ? STATUS_META[s].zh : STATUS_META[s].en}
                </Tag>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left p-2 border-b border-slate-200 sticky left-0 bg-slate-50 min-w-[160px]">
                    {zh ? "模板" : "Template"}
                  </th>
                  {weekDays.map((d) => {
                    const isToday = d.isSame(dayjs(), "day");
                    return (
                      <th
                        key={d.format("YYYY-MM-DD")}
                        className={`p-2 border-b border-l border-slate-200 text-center min-w-[130px] ${isToday ? "bg-blue-50" : ""}`}
                      >
                        <div className="font-medium">{d.format(zh ? "MM/DD" : "ddd")}</div>
                        <div className="text-xs text-slate-400">{d.format(zh ? "ddd" : "MM/DD")}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {templates.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-400">
                      {zh ? "暂无模板，请先新建" : "No templates yet"}
                    </td>
                  </tr>
                ) : (
                  templates.map((tpl) => {
                    const byDate = (tpl.assignmentMode || "fixed") === "by_date";
                    const perDate = calGrid.get(String(tpl.id));
                    return (
                      <tr key={String(tpl.id)} className="align-top">
                        <td className="p-2 border-b border-slate-100 sticky left-0 bg-white">
                          <div className="font-medium">{tpl.title}</div>
                          <div className="text-xs text-slate-400">
                            {byDate ? (zh ? "按日" : "By date") : zh ? "固定" : "Fixed"}
                            {tpl.status === 0 ? ` · ${zh ? "停用" : "off"}` : ""}
                          </div>
                        </td>
                        {weekDays.map((d) => {
                          const dateStr = d.format("YYYY-MM-DD");
                          const entries = perDate?.get(dateStr) || [];
                          const isToday = d.isSame(dayjs(), "day");
                          return (
                            <td
                              key={dateStr}
                              onClick={byDate ? () => void openAssignees(tpl, d) : undefined}
                              className={`p-1.5 border-b border-l border-slate-100 align-top ${isToday ? "bg-blue-50/40" : ""} ${byDate ? "cursor-pointer hover:bg-slate-50" : ""}`}
                            >
                              <div className="flex flex-col gap-1">
                                {entries.length === 0 ? (
                                  <span className="text-slate-300 text-xs">
                                    {byDate ? (zh ? "点击分派" : "assign") : "—"}
                                  </span>
                                ) : (
                                  entries.map((en, i) => {
                                    const meta = STATUS_META[(en.status as CalStatus) || "scheduled"] || STATUS_META.scheduled;
                                    return (
                                      <Tooltip
                                        key={`${en.merchantAdminId}-${i}`}
                                        title={zh ? meta.zh : meta.en}
                                      >
                                        <Tag color={meta.color} className="m-0 truncate max-w-[120px]">
                                          {nameOf(en.merchantAdminId)}
                                        </Tag>
                                      </Tooltip>
                                    );
                                  })
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 模板管理 */}
          <h2 className="text-base font-semibold m-0 mt-8">{zh ? "模板管理" : "Templates"}</h2>
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
                title: zh ? "固定委派人" : "Fixed assignees",
                dataIndex: "fixedAssigneeIds",
                render: (_: unknown, row: DutyTemplateApi) => {
                  if ((row.assignmentMode || "fixed") === "by_date") {
                    return <span className="text-slate-400">{zh ? "按日分派" : "By date"}</span>;
                  }
                  const ids = row.fixedAssigneeIds || [];
                  if (ids.length === 0) return <span className="text-slate-400">—</span>;
                  return (
                    <div className="flex flex-wrap gap-1">
                      {ids.map((id) => (
                        <Tag key={String(id)} className="m-0">
                          {nameOf(id)}
                        </Tag>
                      ))}
                    </div>
                  );
                },
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
                            await reloadAll();
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
                setEligibleIds(null);
                const [ids] = await Promise.all([
                  merchantApi.listDutyDailyAssignees(String(assigneeModal.id), d.format("YYYY-MM-DD")),
                  loadEligible(d),
                ]);
                assigneeForm.setFieldsValue({ merchantAdminIds: ids });
              }}
            />
            <p className="text-slate-500 text-xs mt-2 mb-0">
              {zh
                ? "仅当日有已发布排班且无已批准请假的员工可选。"
                : "Only employees scheduled on this day without approved leave can be assigned."}
            </p>
          </div>
        ) : (
          <p className="text-slate-500 text-sm mb-3">
            {zh
              ? "固定委派：所选员工在其有排班的日子自动承担该 Duty。"
              : "Fixed assignees automatically own this duty on days they are scheduled."}
          </p>
        )}
        <Form form={assigneeForm} layout="vertical">
          <Form.Item name="merchantAdminIds" label={zh ? "员工" : "Employees"}>
            <Select
              mode="multiple"
              options={assigneeOptions}
              optionFilterProp="label"
              notFoundContent={
                byDateModal && eligibleIds !== null && eligibleIds.length === 0
                  ? (zh ? "当日无可委派员工（无排班或均已请假）" : "No eligible employees on this day")
                  : undefined
              }
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

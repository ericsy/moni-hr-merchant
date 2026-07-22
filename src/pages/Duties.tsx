import { useEffect, useMemo, useState } from "react";
import {
  Button,
  DatePicker,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Select,
  Switch,
  Table,
  Tabs,
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
  type DutyCompletionApi,
  type DutyTemplateApi,
} from "../lib/merchantApi";

const TRIGGER_OPTIONS = [
  { value: "clock_in", zh: "上班必做", en: "Clock-in" },
  { value: "clock_out", zh: "下班必做", en: "Clock-out" },
  { value: "recurring", zh: "分钟重复", en: "Recurring" },
];

const APPLICATION_TYPE_META: Record<string, { color: string; zh: string; en: string }> = {
  store_shift: { color: "blue", zh: "店班", en: "Store Shift" },
  field_job: { color: "purple", zh: "外勤", en: "Field Job" },
};

function normalizeApplicationType(v?: string | null) {
  return v === "field_job" ? "field_job" : "store_shift";
}

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
  const [activeTab, setActiveTab] = useState<"store_shift" | "field_job" | "completions">("store_shift");
  const [calendarEntries, setCalendarEntries] = useState<DutyCalendarEntryApi[]>([]);
  const [loading, setLoading] = useState(false);
  const [calLoading, setCalLoading] = useState(false);
  const [weekStart, setWeekStart] = useState<Dayjs>(() => startOfWeekMonday(dayjs()));
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DutyTemplateApi | null>(null);
  const [form] = Form.useForm();
  const [assigneeForm] = Form.useForm();
  const [assignmentRange, setAssignmentRange] = useState<[Dayjs, Dayjs]>(() => [
    startOfWeekMonday(dayjs()),
    startOfWeekMonday(dayjs()).add(6, "day"),
  ]);
  const [assigneeModal, setAssigneeModal] = useState<DutyTemplateApi | null>(null);
  const [assigneeLoading, setAssigneeLoading] = useState(false);
  // 按日委派：区间内至少一天有排班且未请假的员工；null 表示未加载
  const [eligibleIds, setEligibleIds] = useState<number[] | null>(null);

  // 完成明细 Tab（含照片）
  const [completionDate, setCompletionDate] = useState<Dayjs>(() => dayjs());
  const [completionItems, setCompletionItems] = useState<DutyCompletionApi[]>([]);
  const [completionLoading, setCompletionLoading] = useState(false);
  const [completionAppType, setCompletionAppType] = useState<"all" | "store_shift" | "field_job">("all");
  const [completionStatus, setCompletionStatus] = useState<string>("all");
  const [completionEmployeeId, setCompletionEmployeeId] = useState<number | null>(null);

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

  // 范围委派下拉仅显示区间内至少一天有排班且未请假的员工；固定委派显示全店员工。
  // 已选中但已不可委派的人仍保留在选项中，便于看见并移除。
  const assigneeOptions = useMemo(() => {
    if (!byDateModal || eligibleIds === null) return employeeOptions;
    const allow = new Set(eligibleIds.map(Number));
    const selected = new Set((selectedAssigneeIds || []).map(Number));
    return employeeOptions
      .filter((o) => allow.has(o.value) || selected.has(o.value))
      .map((o) =>
        allow.has(o.value)
          ? o
          : { ...o, label: `${o.label}${zh ? "（区间内不可委派）" : " (unavailable in range)"}` },
      );
  }, [byDateModal, eligibleIds, employeeOptions, selectedAssigneeIds, zh]);

  const loadRangeAssignees = async (
    templateId: string,
    range: [Dayjs, Dayjs],
  ) => {
    if (!selectedStoreId || selectedStoreId === "all") return;
    const from = range[0].format("YYYY-MM-DD");
    const to = range[1].format("YYYY-MM-DD");
    setAssigneeLoading(true);
    try {
      const [eligible, assigned] = await Promise.all([
        merchantApi.listDutyEligibleAssigneesRange(String(selectedStoreId), from, to),
        merchantApi.listDutyDailyAssigneesRange(templateId, from, to),
      ]);
      setEligibleIds((eligible?.merchantAdminIds || []).map(Number));
      assigneeForm.setFieldsValue({
        merchantAdminIds: (assigned?.merchantAdminIds || []).map(Number),
      });
    } catch (err) {
      setEligibleIds(null);
      toast.error(err instanceof Error ? err.message : "Load failed");
    } finally {
      setAssigneeLoading(false);
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

  // 当前页签下的模板：店班 / 外勤分开管理
  const tabTemplates = useMemo(
    () => templates.filter((t) => normalizeApplicationType(t.applicationType) === activeTab),
    [templates, activeTab],
  );
  const isFieldTab = activeTab === "field_job";
  const isCompletionsTab = activeTab === "completions";
  const isTemplateTab = activeTab === "store_shift" || activeTab === "field_job";

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

  useEffect(() => {
    if (!isCompletionsTab || !hasConcreteStore) return;
    void loadCompletions(completionDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedStoreId, completionDate]);

  const reloadAll = async () => {
    const tasks: Promise<unknown>[] = [reloadTemplates(), reloadCalendar()];
    if (isCompletionsTab) {
      tasks.push(loadCompletions(completionDate));
    }
    await Promise.all(tasks);
  };

  const loadCompletions = async (date: Dayjs) => {
    if (!hasConcreteStore) {
      setCompletionItems([]);
      return;
    }
    setCompletionLoading(true);
    try {
      const items = await merchantApi.listDutyCompletions(
        String(selectedStoreId),
        date.format("YYYY-MM-DD"),
      );
      setCompletionItems(items);
    } catch (err) {
      setCompletionItems([]);
      toast.error(err instanceof Error ? err.message : "Load failed");
    } finally {
      setCompletionLoading(false);
    }
  };

  /** 切到「完成明细」Tab；可从日历带入日期/员工筛选 */
  const openCompletionsTab = (
    date: Dayjs,
    opts?: { merchantAdminId?: string; appType?: "store_shift" | "field_job" },
  ) => {
    setCompletionDate(date);
    setCompletionEmployeeId(
      opts?.merchantAdminId ? Number(opts.merchantAdminId) || null : null,
    );
    if (opts?.appType) {
      setCompletionAppType(opts.appType);
    } else {
      setCompletionAppType("all");
    }
    setCompletionStatus("all");
    setActiveTab("completions");
  };

  const formatDt = (v?: string | null) => {
    if (!v) return "—";
    const d = dayjs(v);
    if (!d.isValid()) return v;
    return d.format(zh ? "MM/DD HH:mm" : "MMM D HH:mm");
  };

  const filteredCompletionItems = useMemo(() => {
    let items = completionItems;
    if (completionAppType !== "all") {
      items = items.filter(
        (i) => normalizeApplicationType(i.applicationType) === completionAppType,
      );
    }
    if (completionStatus !== "all") {
      items = items.filter((i) => (i.status || "") === completionStatus);
    }
    if (completionEmployeeId != null && completionEmployeeId > 0) {
      items = items.filter((i) => Number(i.merchantAdminId) === completionEmployeeId);
    }
    return items;
  }, [completionItems, completionAppType, completionStatus, completionEmployeeId]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      applicationType: activeTab === "field_job" ? "field_job" : "store_shift",
      triggerType: "clock_in",
      assignmentMode: "fixed",
      required: true,
      requirePhoto: false,
      intervalMinutes: 30,
    });
    setModalOpen(true);
  };

  const openEdit = (row: DutyTemplateApi) => {
    setEditing(row);
    form.setFieldsValue({
      applicationType: normalizeApplicationType(row.applicationType),
      title: row.title,
      description: row.description,
      triggerType: row.triggerType,
      assignmentMode: row.assignmentMode || "fixed",
      required: row.required !== false,
      requirePhoto: row.requirePhoto === true,
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
    const isFieldJob = values.applicationType === "field_job";
    try {
      if (editing?.id) {
        // applicationType 创建后不可改，不随 PATCH 提交
        await merchantApi.patchDutyTemplate(String(editing.id), {
          title: values.title,
          description: values.description,
          triggerType: values.triggerType,
          ...(isFieldJob ? {} : { assignmentMode: values.assignmentMode }),
          required: values.required,
          requirePhoto: values.requirePhoto,
          intervalMinutes: values.triggerType === "recurring" ? values.intervalMinutes : null,
          status: values.status,
        });
      } else {
        await merchantApi.createDutyTemplate(String(selectedStoreId), {
          applicationType: values.applicationType || "store_shift",
          title: values.title,
          description: values.description,
          triggerType: values.triggerType,
          ...(isFieldJob ? {} : { assignmentMode: values.assignmentMode }),
          required: values.required,
          requirePhoto: values.requirePhoto,
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
      const range: [Dayjs, Dayjs] = presetDate
        ? [presetDate.startOf("day"), presetDate.startOf("day")]
        : [weekStart, weekStart.add(6, "day")];
      setAssignmentRange(range);
      setEligibleIds(null);
      await loadRangeAssignees(String(row.id), range);
    } else {
      assigneeForm.setFieldsValue({ merchantAdminIds: row.fixedAssigneeIds || [] });
    }
  };

  const saveAssignees = async () => {
    if (!assigneeModal?.id) return;
    const values = await assigneeForm.validateFields();
    try {
      if ((assigneeModal.assignmentMode || "fixed") === "by_date") {
        await merchantApi.replaceDutyDailyAssigneesRange(
          String(assigneeModal.id),
          assignmentRange[0].format("YYYY-MM-DD"),
          assignmentRange[1].format("YYYY-MM-DD"),
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

  const pageHint = isCompletionsTab
    ? zh
      ? "按日查看 Duty 完成情况与现场照片。"
      : "Review daily duty completion status and photos."
    : isFieldTab
      ? zh
        ? "此处仅维护外勤检查项模板。具体使用哪些检查项，请在创建/编辑外勤任务时勾选；人员自动跟随工单接单人，改派随之转移。"
        : "Maintain field-job checklist templates here. Pick templates when creating a field job; assignees always follow the job's workers."
      : zh
        ? "配置上班/下班必做与分钟重复任务；固定委派或按日分派。固定委派仅在该员工当天有排班时生效并落到日历。"
        : "Configure clock-in/out required duties and recurring tasks. Fixed assignees apply only on days the employee is scheduled, and are projected onto the calendar.";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold m-0">{zh ? "门店 Duties" : "Store Duties"}</h1>
          <p className="text-slate-500 text-sm m-0 mt-1">{pageHint}</p>
        </div>
        <div className="flex gap-2">
          <Button
            icon={<RefreshCw size={16} />}
            onClick={() => void reloadAll()}
            loading={loading || calLoading || (isCompletionsTab && completionLoading)}
          >
            {zh ? "刷新" : "Refresh"}
          </Button>
          {isTemplateTab ? (
            <Button type="primary" icon={<Plus size={16} />} onClick={openCreate}>
              {isFieldTab
                ? zh ? "新建外勤模板" : "New field template"
                : zh ? "新建模板" : "New template"}
            </Button>
          ) : null}
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(k) => {
          if (k === "field_job" || k === "completions" || k === "store_shift") {
            setActiveTab(k);
          }
        }}
        items={[
          { key: "store_shift", label: zh ? "店班 Duties" : "Store Shift Duties" },
          { key: "field_job", label: zh ? "外勤 Duty 模板" : "Field Job Templates" },
          { key: "completions", label: zh ? "完成明细" : "Completions" },
        ]}
      />

      {!hasConcreteStore ? (
        <div className="text-slate-500">{zh ? "请选择具体门店后管理 Duties" : "Select a concrete store to manage duties"}</div>
      ) : isCompletionsTab ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-slate-600 text-sm">{zh ? "日期" : "Date"}</span>
            <DatePicker
              value={completionDate}
              allowClear={false}
              onChange={(d) => {
                if (d) setCompletionDate(d);
              }}
            />
            <Select
              className="min-w-[120px]"
              value={completionAppType}
              onChange={(v) => setCompletionAppType(v)}
              options={[
                { value: "all", label: zh ? "全部类型" : "All types" },
                { value: "store_shift", label: zh ? "店班" : "Store shift" },
                { value: "field_job", label: zh ? "外勤" : "Field job" },
              ]}
            />
            <Select
              className="min-w-[120px]"
              value={completionStatus}
              onChange={(v) => setCompletionStatus(v)}
              options={[
                { value: "all", label: zh ? "全部状态" : "All status" },
                { value: "pending", label: zh ? "待完成" : "Pending" },
                { value: "completed", label: zh ? "已完成" : "Completed" },
                { value: "expired", label: zh ? "已过期" : "Expired" },
                { value: "skipped", label: zh ? "已跳过" : "Skipped" },
              ]}
            />
            <Select
              className="min-w-[160px]"
              allowClear
              placeholder={zh ? "全部员工" : "All employees"}
              value={completionEmployeeId ?? undefined}
              onChange={(v) => setCompletionEmployeeId(v ?? null)}
              options={employeeOptions}
              optionFilterProp="label"
              showSearch
            />
          </div>

          <Table
            rowKey={(r) => String(r.id)}
            loading={completionLoading}
            dataSource={filteredCompletionItems}
            pagination={{ pageSize: 15, hideOnSinglePage: true }}
            size="middle"
            locale={{
              emptyText: zh ? "当日暂无 Duty 实例" : "No duty instances for this day",
            }}
            columns={[
              {
                title: zh ? "员工" : "Employee",
                dataIndex: "merchantAdminId",
                width: 120,
                render: (v: number | string) => nameOf(v),
              },
              {
                title: zh ? "类型" : "Type",
                dataIndex: "applicationType",
                width: 90,
                render: (v: string) => {
                  const t = normalizeApplicationType(v);
                  const meta = APPLICATION_TYPE_META[t];
                  return <Tag color={meta.color}>{zh ? meta.zh : meta.en}</Tag>;
                },
              },
              {
                title: zh ? "任务" : "Duty",
                dataIndex: "title",
                ellipsis: true,
                render: (v: string, row: DutyCompletionApi) => {
                  const opt = TRIGGER_OPTIONS.find((o) => o.value === row.triggerType);
                  const seq =
                    row.triggerType === "recurring" && row.sequenceNo
                      ? ` #${row.sequenceNo}`
                      : "";
                  return (
                    <div>
                      <div className="font-medium">{v || "—"}</div>
                      <div className="text-xs text-slate-400">
                        {(zh ? opt?.zh : opt?.en) || row.triggerType}
                        {seq}
                        {row.fieldJobId ? ` · job#${row.fieldJobId}` : ""}
                      </div>
                    </div>
                  );
                },
              },
              {
                title: zh ? "状态" : "Status",
                dataIndex: "status",
                width: 100,
                render: (v: string) => {
                  const key = (v as CalStatus) in STATUS_META ? (v as CalStatus) : null;
                  const meta = key ? STATUS_META[key] : null;
                  return (
                    <Tag color={meta?.color || "default"}>
                      {meta ? (zh ? meta.zh : meta.en) : v || "—"}
                    </Tag>
                  );
                },
              },
              {
                title: zh ? "时间窗" : "Window",
                width: 150,
                render: (_: unknown, row: DutyCompletionApi) => (
                  <span className="text-xs text-slate-600">
                    {formatDt(row.windowStart)}
                    <br />
                    {formatDt(row.windowEnd)}
                  </span>
                ),
              },
              {
                title: zh ? "完成于" : "Completed",
                dataIndex: "completedAt",
                width: 120,
                render: (v: string | null | undefined) => (
                  <span className="text-xs">{formatDt(v)}</span>
                ),
              },
              {
                title: zh ? "备注" : "Note",
                dataIndex: "note",
                ellipsis: true,
                width: 140,
                render: (v: string | null | undefined) =>
                  v ? <span className="text-xs">{v}</span> : <span className="text-slate-300">—</span>,
              },
              {
                title: zh ? "照片" : "Photos",
                width: 200,
                render: (_: unknown, row: DutyCompletionApi) => {
                  const urls = (row.photoUrls || []).filter(Boolean);
                  if (urls.length === 0) {
                    return row.requirePhoto ? (
                      <span className="text-xs text-slate-400">
                        {zh ? "需拍照·无图" : "Required·none"}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    );
                  }
                  return (
                    <Image.PreviewGroup items={urls}>
                      <div className="flex gap-1 flex-wrap">
                        {urls.map((url) => (
                          <Image
                            key={url}
                            src={url}
                            width={48}
                            height={48}
                            className="rounded object-cover"
                            style={{ objectFit: "cover" }}
                          />
                        ))}
                      </div>
                    </Image.PreviewGroup>
                  );
                },
              },
            ]}
          />
        </>
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
                        className={`p-2 border-b border-l border-slate-200 text-center min-w-[130px] cursor-pointer hover:bg-slate-100 ${isToday ? "bg-blue-50" : ""}`}
                        title={zh ? "查看当日完成明细" : "View completions for this day"}
                        onClick={() =>
                          openCompletionsTab(d, {
                            appType: isFieldTab ? "field_job" : "store_shift",
                          })
                        }
                      >
                        <div className="font-medium">{d.format(zh ? "MM/DD" : "ddd")}</div>
                        <div className="text-xs text-slate-400">{d.format(zh ? "ddd" : "MM/DD")}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {tabTemplates.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-400">
                      {zh ? "暂无模板，请先新建" : "No templates yet"}
                    </td>
                  </tr>
                ) : (
                  tabTemplates.map((tpl) => {
                    const isFieldJob = normalizeApplicationType(tpl.applicationType) === "field_job";
                    const byDate = !isFieldJob && (tpl.assignmentMode || "fixed") === "by_date";
                    const perDate = calGrid.get(String(tpl.id));
                    return (
                      <tr key={String(tpl.id)} className="align-top">
                        <td className="p-2 border-b border-slate-100 sticky left-0 bg-white">
                          <div className="font-medium">{tpl.title}</div>
                          <div className="text-xs text-slate-400">
                            {isFieldJob
                              ? zh ? "随外勤任务" : "Via field jobs"
                              : byDate ? (zh ? "按时间段" : "By range") : zh ? "固定" : "Fixed"}
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
                                    const total = Number(en.total || 0);
                                    const done = Number(en.completed || 0);
                                    const countHint =
                                      total > 1 ? ` ${done}/${total}` : done === 1 && total === 1 ? "" : total > 0 ? ` ${done}/${total}` : "";
                                    const tip =
                                      total > 0
                                        ? `${zh ? meta.zh : meta.en} (${done}/${total}) · ${zh ? "点击查看明细" : "Click for details"}`
                                        : zh
                                          ? `${meta.zh} · 点击查看明细`
                                          : `${meta.en} · Click for details`;
                                    return (
                                      <Tooltip key={`${en.merchantAdminId}-${i}`} title={tip}>
                                        <Tag
                                          color={meta.color}
                                          className="m-0 truncate max-w-[120px] cursor-pointer"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openCompletionsTab(d, {
                                              merchantAdminId: String(en.merchantAdminId ?? ""),
                                              appType: isFieldTab ? "field_job" : "store_shift",
                                            });
                                          }}
                                        >
                                          {nameOf(en.merchantAdminId)}
                                          {countHint}
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
          {isFieldTab ? (
            <p className="text-slate-500 text-sm m-0">
              {zh
                ? "外勤模板不在此指定人员和日期：在「外勤管理」创建/编辑工单时勾选检查清单，任务自动落到该工单的接单人身上。"
                : "Field templates are not assigned here. Check them as the checklist when creating/editing a field job; duties follow the job's assignees automatically."}
            </p>
          ) : null}
          <Table
            rowKey={(r) => String(r.id)}
            loading={loading}
            dataSource={tabTemplates}
            pagination={false}
            columns={[
              {
                title: zh ? "标题" : "Title",
                dataIndex: "title",
              },
              {
                title: zh ? "触发" : "Trigger",
                dataIndex: "triggerType",
                render: (v: string, row: DutyTemplateApi) => {
                  const opt = TRIGGER_OPTIONS.find((o) => o.value === v);
                  return (
                    <span>
                      {zh ? opt?.zh : opt?.en}
                      {v === "recurring" ? ` / ${row.intervalMinutes || "-"}m` : ""}
                    </span>
                  );
                },
              },
              ...(isFieldTab
                ? []
                : [
                    {
                      title: zh ? "委派" : "Assign",
                      dataIndex: "assignmentMode",
                      render: (v: string) =>
                        v === "by_date" ? (zh ? "按时间段" : "By range") : zh ? "固定" : "Fixed",
                    },
                    {
                      title: zh ? "固定委派人" : "Fixed assignees",
                      dataIndex: "fixedAssigneeIds",
                      render: (_: unknown, row: DutyTemplateApi) => {
                        if ((row.assignmentMode || "fixed") === "by_date") {
                          return <span className="text-slate-400">{zh ? "按时间段分派" : "By range"}</span>;
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
                  ]),
              {
                title: zh ? "必做" : "Required",
                dataIndex: "required",
                render: (v: boolean, row: DutyTemplateApi) => (
                  <span className="inline-flex gap-1">
                    {v === false ? <Tag>optional</Tag> : <Tag color="blue">required</Tag>}
                    {row.requirePhoto ? <Tag color="orange">{zh ? "拍照" : "photo"}</Tag> : null}
                  </span>
                ),
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
                    {normalizeApplicationType(row.applicationType) !== "field_job" ? (
                      <Button size="small" onClick={() => void openAssignees(row)}>
                        {zh ? "委派" : "Assign"}
                      </Button>
                    ) : null}
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
        maskClosable={false}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="applicationType" hidden>
            <Input />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(p, c) => p.applicationType !== c.applicationType}>
            {() => {
              const at = normalizeApplicationType(form.getFieldValue("applicationType"));
              const meta = APPLICATION_TYPE_META[at];
              return (
                <Form.Item label={zh ? "应用类型" : "Application type"}>
                  <div className="flex items-center gap-2">
                    <Tag color={meta.color} className="m-0">
                      {zh ? meta.zh : meta.en}
                    </Tag>
                    <span className="text-slate-400 text-xs">
                      {at === "field_job"
                        ? zh
                          ? "由「外勤 Duty 模板」页签创建，创建后不可更改"
                          : "Created from the Field Job Templates tab; cannot be changed"
                        : zh
                          ? "由「店班 Duties」页签创建，创建后不可更改"
                          : "Created from the Store Shift Duties tab; cannot be changed"}
                    </span>
                  </div>
                </Form.Item>
              );
            }}
          </Form.Item>
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
          <Form.Item noStyle shouldUpdate={(p, c) => p.applicationType !== c.applicationType}>
            {() =>
              form.getFieldValue("applicationType") === "field_job" ? null : (
                <Form.Item name="assignmentMode" label={zh ? "委派模式" : "Assignment mode"}>
                  <Select
                    options={[
                      { value: "fixed", label: zh ? "固定人员" : "Fixed" },
                      { value: "by_date", label: zh ? "按时间段分派" : "By date range" },
                    ]}
                  />
                </Form.Item>
              )
            }
          </Form.Item>
          <Form.Item name="required" label={zh ? "必做" : "Required"} valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item
            name="requirePhoto"
            label={zh ? "完成需拍照" : "Photo required on completion"}
            valuePropName="checked"
            extra={
              zh
                ? "开启后员工完成该任务时必须现场拍照上传（仅可调起相机，不可选相册）"
                : "Employees must take a live photo (camera only) to complete this duty"
            }
          >
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
        okButtonProps={{ disabled: assigneeLoading }}
        maskClosable={false}
        destroyOnClose
      >
        {(assigneeModal?.assignmentMode || "fixed") === "by_date" ? (
          <div className="mb-3">
            <div className="mb-2">{zh ? "委派时间段" : "Assignment range"}</div>
            <DatePicker.RangePicker
              value={assignmentRange}
              allowClear={false}
              onChange={async (dates) => {
                if (!dates?.[0] || !dates?.[1] || !assigneeModal?.id) return;
                const range: [Dayjs, Dayjs] = [
                  dates[0].startOf("day"),
                  dates[1].startOf("day"),
                ];
                setAssignmentRange(range);
                setEligibleIds(null);
                await loadRangeAssignees(String(assigneeModal.id), range);
              }}
            />
            <p className="text-slate-500 text-xs mt-2 mb-0">
              {zh
                ? "只要员工在区间内至少有一天已发布排班且未请假，即可选择；保存后仅委派到该员工实际有班且未请假的日期，并覆盖区间内原有委派。"
                : "Employees with at least one eligible scheduled day in the range can be selected. Saving replaces existing assignments in the range and assigns each employee only on their eligible days."}
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
              loading={assigneeLoading}
              disabled={assigneeLoading}
              notFoundContent={
                byDateModal && eligibleIds !== null && eligibleIds.length === 0
                  ? (zh ? "该时间段无可委派员工（无排班或排班日均已请假）" : "No eligible employees in this range")
                  : undefined
              }
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

import { useRef, useState } from "react";
import {
  Button,
  Modal,
  Popconfirm,
  Select,
  Space,
} from "antd";
import {
  CalendarX,
  Clock,
  Edit2,
  LayoutTemplate,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { toast } from "sonner";
import { useData, type RosterTemplate, type ScheduleShift } from "../context/DataContext";
import { useLocale } from "../context/LocaleContext";
import { useStore } from "../context/StoreContext";
import { calcShiftHours } from "../lib/shift";

dayjs.extend(isoWeek);

const { Option } = Select;

const SHIFT_COLORS = [
  { key: "blue", label: "蓝色" },
  { key: "green", label: "绿色" },
  { key: "purple", label: "紫色" },
  { key: "orange", label: "橙色" },
  { key: "red", label: "红色" },
];

const DEFAULT_SHIFT_COLOR_MAP: Record<string, string> = {
  blue: "var(--primary)",
  green: "var(--chart-2)",
  purple: "var(--chart-5)",
  orange: "var(--chart-3)",
  red: "var(--destructive)",
};

const WEEKDAY_LABELS_ZH = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const WEEKDAY_LABELS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const isHexColor = (value: string) => /^#(?:[0-9A-Fa-f]{3}){1,2}$/.test(value);

const resolveShiftColor = (
  color: string,
  colorMap: Record<string, string> = DEFAULT_SHIFT_COLOR_MAP
) => {
  if (isHexColor(color)) return color;
  return colorMap[color] || DEFAULT_SHIFT_COLOR_MAP.blue;
};

interface TemplateShiftSummary {
  key: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  days: number[];
}

const getTemplateShiftSummaries = (template: RosterTemplate): TemplateShiftSummary[] => {
  const shiftMap: Record<string, TemplateShiftSummary> = {};

  template.cells.forEach((cell) => {
    const weekday = ((cell.dayIndex % 7) + 7) % 7;
    const key = `${cell.label || cell.startTime}|${cell.startTime}|${cell.endTime}|${cell.color}`;
    const existing = shiftMap[key];

    if (existing) {
      if (!existing.days.includes(weekday)) {
        existing.days.push(weekday);
      }
      return;
    }

    shiftMap[key] = {
      key,
      name: cell.label || cell.startTime,
      startTime: cell.startTime,
      endTime: cell.endTime,
      color: cell.color,
      days: [weekday],
    };
  });

  return Object.values(shiftMap).map((shift) => ({
    ...shift,
    days: [...shift.days].sort((a, b) => a - b),
  }));
};

const getTemplateWeekCells = (template: RosterTemplate) =>
  template.cells.filter((cell) => cell.dayIndex >= 0 && cell.dayIndex < 7);

interface ScheduleProps {
  initialTemplateId?: string;
}

export default function Schedule({ initialTemplateId = "" }: ScheduleProps) {
  const { t, locale } = useLocale();
  const { stores, scheduleShifts, setScheduleShifts, saveGlobalShift, deleteGlobalShift, templates } = useData();
  const { selectedStoreId } = useStore();

  const [selectedDate, setSelectedDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [modalOpen, setModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<ScheduleShift | null>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>(initialTemplateId || "");
  const [shiftName, setShiftName] = useState("");
  const [shiftStartTime, setShiftStartTime] = useState("09:00");
  const [shiftEndTime, setShiftEndTime] = useState("17:00");
  const [shiftColor, setShiftColor] = useState("blue");
  const [shiftType, setShiftType] = useState<"store" | "general">("store");
  const [shiftDate, setShiftDate] = useState(dayjs().format("YYYY-MM-DD"));

  const currentDate = dayjs(selectedDate);
  const currentDateStr = currentDate.format("YYYY-MM-DD");
  const selectedWeekStart = currentDate.startOf("isoWeek");

  const storeNameMap = Object.fromEntries(stores.map((store) => [store.id, store.name]));

  const enabledTemplates = templates.filter(
    (template) => template.status === "enabled" && (selectedStoreId === "all" || template.storeId === selectedStoreId)
  );
  const selectedTemplateValue = enabledTemplates.some((template) => template.id === selectedTemplate)
    ? selectedTemplate
    : "";
  const selectedTemplateData = enabledTemplates.find((template) => template.id === selectedTemplateValue);
  const selectedTemplateShifts = selectedTemplateData ? getTemplateShiftSummaries(selectedTemplateData) : [];

  const visibleDayShifts = scheduleShifts
    .filter((shift) => {
      const matchDate = shift.isGlobalPreset || shift.date === currentDateStr;
      const matchStore = selectedStoreId === "all" || shift.shiftType === "general" || shift.storeId === selectedStoreId;
      return matchDate && matchStore;
    })
    .sort((a, b) => {
      return (
        a.startTime.localeCompare(b.startTime) ||
        a.endTime.localeCompare(b.endTime) ||
        a.shiftName.localeCompare(b.shiftName)
      );
    });

  const draftCount = visibleDayShifts.filter((shift) => shift.status === "draft").length;
  const publishedCount = visibleDayShifts.filter((shift) => shift.status === "published").length;
  const storeCount = new Set(visibleDayShifts.map((shift) => shift.storeId).filter(Boolean)).size;
  const colorMap: Record<string, string> = DEFAULT_SHIFT_COLOR_MAP;

  const calcHours = (start: string, end: string, breakMinutes: number) => {
    return calcShiftHours(start, end, breakMinutes);
  };

  const resetShiftForm = (date = currentDateStr) => {
    setShiftName("");
    setShiftStartTime("09:00");
    setShiftEndTime("17:00");
    setShiftColor("blue");
    setShiftType("store");
    setShiftDate(date);
  };

  const handleAddShift = (date = currentDateStr) => {
    setEditingShift(null);
    resetShiftForm(date);
    setModalOpen(true);
  };

  const handleEditShift = (shift: ScheduleShift) => {
    setEditingShift(shift);
    setShiftName(shift.shiftName || "");
    setShiftStartTime(shift.startTime || "09:00");
    setShiftEndTime(shift.endTime || "17:00");
    setShiftColor(shift.color || "blue");
    setShiftType(shift.shiftType || "store");
    setShiftDate(shift.date || currentDateStr);
    setModalOpen(true);
  };

  const handleDeleteShift = async (shift: ScheduleShift) => {
    try {
      if (shift.isGlobalPreset && shift.shiftId) {
        await deleteGlobalShift(shift.shiftId);
      } else {
        setScheduleShifts((prev) => prev.filter((item) => item.id !== shift.id));
      }
      toast.success(t.schedule.deleteSuccess);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  };

  const handleSaveShift = async () => {
    if (!shiftDate) {
      toast.error(locale === "zh" ? "请选择班次日期" : "Please select a date");
      return;
    }

    if (!shiftStartTime || !shiftEndTime) {
      toast.error(locale === "zh" ? "请填写开始和结束时间" : "Please fill in start and end time");
      return;
    }

    const storeIdToUse =
      editingShift?.storeId ||
      (selectedStoreId !== "all" ? selectedStoreId : "");

    if (shiftType === "store" && !storeIdToUse) {
      toast.error(locale === "zh" ? "请先选择具体门店后再创建班次" : "Please choose a store before creating a shift");
      return;
    }

    const shiftData: ScheduleShift = {
      id: editingShift?.id || `sh${Date.now()}`,
      shiftId: editingShift?.shiftId,
      isGlobalPreset: true,
      employeeId: "",
      employeeIds: [],
      areaId: "",
      storeId: shiftType === "general" ? "" : storeIdToUse,
      shiftType,
      date: shiftDate,
      startTime: shiftStartTime,
      endTime: shiftEndTime,
      breakMinutes: editingShift?.breakMinutes ?? 30,
      shiftName: shiftName.trim() || (locale === "zh" ? "未命名班次" : "Untitled Shift"),
      color: shiftColor,
      note: editingShift?.note || "",
      status: editingShift?.status || "draft",
    };

    try {
      const saved = await saveGlobalShift(shiftData, editingShift?.shiftId);
      setSelectedDate(shiftData.date || currentDateStr);
      toast.success(t.schedule.saveSuccess);
      setModalOpen(false);
      if (!editingShift && saved.id) {
        setEditingShift(null);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    }
  };

  const handlePublishDay = () => {
    const draftIds = visibleDayShifts
      .filter((shift) => shift.status === "draft")
      .map((shift) => shift.id);

    setScheduleShifts((prev) =>
      prev.map((shift) => (
        draftIds.includes(shift.id)
          ? { ...shift, status: "published" as const }
          : shift
      ))
    );

    toast.success(t.schedule.publishSuccess);
  };

  const handleApplyTemplate = () => {
    const template = enabledTemplates.find((item) => item.id === selectedTemplate);
    if (!template) {
      toast.error(locale === "zh" ? "请先选择模版" : "Please select a template first");
      return;
    }

    const templateCells = getTemplateWeekCells(template);
    if (templateCells.length === 0) {
      toast.error(locale === "zh" ? "当前模版本周没有可应用的班次" : "This template has no shifts to apply for the current week");
      return;
    }

    const targetStoreId = template.storeId || (selectedStoreId !== "all" ? selectedStoreId : "");
    if (!targetStoreId) {
      toast.error(locale === "zh" ? "请先选择具体门店后再应用模版" : "Please choose a store before applying a template");
      return;
    }

    const coveredDates: Record<string, true> = {};
    templateCells.forEach((cell) => {
      coveredDates[selectedWeekStart.add(cell.dayIndex, "day").format("YYYY-MM-DD")] = true;
    });

    const newShifts: ScheduleShift[] = templateCells.map((cell, index) => ({
      id: `sh${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`,
      employeeId: "",
      employeeIds: [],
      areaId: "",
      storeId: targetStoreId,
      shiftType: "store",
      date: selectedWeekStart.add(cell.dayIndex, "day").format("YYYY-MM-DD"),
      startTime: cell.startTime,
      endTime: cell.endTime,
      breakMinutes: 30,
      shiftName: cell.label || cell.startTime,
      color: cell.color,
      note: locale === "zh" ? `来自模版: ${template.name}` : `From template: ${template.name}`,
      status: "draft",
    }));

    setScheduleShifts((prev) => {
      const preservedShifts = prev.filter(
        (shift) => shift.storeId !== targetStoreId || !coveredDates[shift.date]
      );
      return [...preservedShifts, ...newShifts];
    });

    setTemplateModalOpen(false);
    toast.success(
      `${locale === "zh" ? "已覆盖应用，生成" : "Overwritten — generated"} ${newShifts.length} ${locale === "zh" ? "个班次" : "shifts"}`
    );
  };

  const handleDeleteSelectedDay = () => {
    const count = visibleDayShifts.length;
    setScheduleShifts((prev) =>
      prev.filter((shift) => {
        const matchDate = shift.date === currentDateStr;
        const matchStore = selectedStoreId === "all" || shift.storeId === selectedStoreId;
        return !(matchDate && matchStore);
      })
    );

    toast.success(
      locale === "zh"
        ? `已删除 ${currentDateStr} 的 ${count} 个班次`
        : `Deleted ${count} shifts on ${currentDateStr}`
    );
  };

  return (
    <div data-cmp="Schedule" className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
            {t.schedule.title}
          </div>
        </div>

        <Space wrap>
          <Button
            icon={<LayoutTemplate size={15} />}
            onClick={() => setTemplateModalOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: 4, borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            {t.schedule.applyTemplate}
          </Button>
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={() => handleAddShift()}
            style={{ display: "flex", alignItems: "center", gap: 4 }}
          >
            {t.schedule.addShift}
          </Button>
          <Button
            type="primary"
            icon={<Send size={15} />}
            disabled={draftCount === 0}
            onClick={handlePublishDay}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: draftCount > 0 ? "var(--chart-2)" : undefined,
              borderColor: draftCount > 0 ? "var(--chart-2)" : undefined,
              opacity: draftCount === 0 ? 0.5 : 1,
            }}
          >
            {locale === "zh"
              ? `发布排班${draftCount > 0 ? ` (${draftCount})` : ""}`
              : `Publish${draftCount > 0 ? ` (${draftCount})` : ""}`}
          </Button>
        </Space>
      </div>

      <div
        className="rounded-3xl p-4 md:p-5"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
              {locale === "zh" ? "班次卡片" : "Shift Cards"}
            </div>
            <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              {locale === "zh"
                ? "班次独立维护，不再与员工和区域关联"
                : "Shifts are managed independently without employee or area links"}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
            <span>
              <Clock size={12} style={{ display: "inline", marginRight: 4 }} />
              {visibleDayShifts.length} {locale === "zh" ? "个班次" : "shifts"}
            </span>
            <span>
              {selectedStoreId === "all"
                ? locale === "zh"
                  ? `${storeCount} 个门店`
                  : `${storeCount} stores`
                : storeNameMap[selectedStoreId] || selectedStoreId}
            </span>
            <div
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                background: "var(--secondary)",
                color: "var(--primary)",
              }}
            >
              {publishedCount} {locale === "zh" ? "已发布" : "published"}
            </div>
            {visibleDayShifts.length > 0 && (
              <Button
                size="small"
                danger
                icon={<CalendarX size={14} />}
                onClick={handleDeleteSelectedDay}
              >
                {locale === "zh" ? "删除当日班次" : "Delete Day"}
              </Button>
            )}
          </div>
        </div>

        {visibleDayShifts.length === 0 ? (
          <div
            className="mt-5 flex min-h-[260px] flex-col items-center justify-center rounded-3xl border border-dashed"
            style={{ borderColor: "var(--border)", background: "rgba(148, 163, 184, 0.04)" }}
          >
            <CalendarX size={34} style={{ color: "var(--muted-foreground)", opacity: 0.45 }} />
            <div className="mt-4 text-base font-semibold" style={{ color: "var(--foreground)" }}>
              {locale === "zh" ? "这一天还没有班次" : "No shifts for this day"}
            </div>
            <div className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
              {locale === "zh" ? "点击右上角“添加班次”开始创建卡片" : "Use Add Shift to create the first card"}
            </div>
            <Button
              type="primary"
              icon={<Plus size={16} />}
              className="mt-5"
              onClick={() => handleAddShift()}
            >
              {t.schedule.addShift}
            </Button>
          </div>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleDayShifts.map((shift) => (
              <ShiftCard
                key={shift.id}
                shift={shift}
                locale={locale}
                colorMap={colorMap}
                storeName={selectedStoreId === "all" ? storeNameMap[shift.storeId] || shift.storeId : ""}
                calcHours={calcHours}
                onEdit={() => handleEditShift(shift)}
                onDelete={() => handleDeleteShift(shift)}
              />
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <AddShiftModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSave={handleSaveShift}
          isEdit={!!editingShift}
          shiftName={shiftName}
          onShiftNameChange={setShiftName}
          startTime={shiftStartTime}
          onStartTimeChange={setShiftStartTime}
          endTime={shiftEndTime}
          onEndTimeChange={setShiftEndTime}
          selectedType={shiftType}
          onTypeChange={setShiftType}
          selectedColor={shiftColor}
          onColorChange={setShiftColor}
          colorMap={colorMap}
          calcHours={calcHours}
          locale={locale}
        />
      )}

      <Modal
        title={t.schedule.applyTemplate}
        open={templateModalOpen}
        onCancel={() => setTemplateModalOpen(false)}
        onOk={handleApplyTemplate}
        okText={locale === "zh" ? "覆盖应用" : "Overwrite & Apply"}
        cancelText={t.cancel}
        width={520}
        destroyOnClose
      >
        <div className="mt-4 flex flex-col gap-3">
          <div
            className="rounded-2xl px-4 py-3"
            style={{ background: "var(--muted)", border: "1px solid var(--border)" }}
          >
            <div className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
              {locale === "zh" ? "覆盖范围" : "Overwrite scope"}
            </div>
            <div className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
              {locale === "zh"
                ? `将覆盖所选日期所在周 (${selectedWeekStart.format("MM/DD")} – ${selectedWeekStart.add(6, "day").format("MM/DD")}) 的现有班次`
                : `Will overwrite shifts in the selected week (${selectedWeekStart.format("MM/DD")} – ${selectedWeekStart.add(6, "day").format("MM/DD")})`}
            </div>
          </div>

          <Select
            value={selectedTemplateValue || undefined}
            onChange={setSelectedTemplate}
            placeholder={t.schedule.selectTemplate}
            style={{ width: "100%" }}
          >
            {enabledTemplates.map((template) => {
              const templateShifts = getTemplateShiftSummaries(template);
              return (
                <Option key={template.id} value={template.id}>
                  {template.name} ({templateShifts.length} {locale === "zh" ? "班次" : "shifts"})
                </Option>
              );
            })}
          </Select>

          {selectedTemplateData && (
            <div
              className="rounded-2xl p-4"
              style={{ background: "var(--muted)", border: "1px solid var(--border)" }}
            >
              <div className="mb-3 text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                {selectedTemplateData.name}
              </div>
              <div className="flex flex-col gap-2">
                {selectedTemplateShifts.map((shift) => (
                  <div
                    key={shift.key}
                    className="flex items-center justify-between gap-3 rounded-xl px-3 py-2"
                    style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="rounded-full"
                        style={{
                          width: 10,
                          height: 10,
                          background: resolveShiftColor(shift.color, colorMap),
                          flexShrink: 0,
                        }}
                      />
                      <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                        {shift.name}
                      </span>
                    </div>
                    <div className="text-right text-xs" style={{ color: "var(--muted-foreground)" }}>
                      <div>{shift.startTime} – {shift.endTime}</div>
                      <div>
                        {shift.days.map((day) => (locale === "zh" ? WEEKDAY_LABELS_ZH[day] : WEEKDAY_LABELS_EN[day])).join(" / ")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

interface ShiftCardProps {
  shift: ScheduleShift;
  colorMap: Record<string, string>;
  calcHours: (start: string, end: string, breakMinutes: number) => string;
  locale: string;
  storeName?: string;
  onEdit: () => void;
  onDelete: () => void;
}

function ShiftCard({
  shift,
  colorMap,
  calcHours,
  locale,
  storeName = "",
  onEdit,
  onDelete,
}: ShiftCardProps) {
  const color = resolveShiftColor(shift.color, colorMap);
  const hours = calcHours(shift.startTime, shift.endTime, shift.breakMinutes);
  const isOvernight = shift.endTime <= shift.startTime;
  const shiftTypeLabel = shift.shiftType === "general"
    ? (locale === "zh" ? "通用" : "General")
    : (locale === "zh" ? "门店专属" : "Store");
  const statusLabel = shift.status === "published"
    ? (locale === "zh" ? "已发布" : "Published")
    : (locale === "zh" ? "草稿" : "Draft");

  return (
    <div
      className="group relative overflow-hidden rounded-[24px] p-4"
      style={{
        background: "var(--card)",
        border: `1.5px solid color-mix(in srgb, ${color} 68%, white)`,
        boxShadow: `
          0 16px 36px color-mix(in srgb, ${color} 14%, transparent),
          0 8px 18px rgba(15, 23, 42, 0.06)
        `,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div
              className="rounded-full"
              style={{ width: 12, height: 12, background: color, flexShrink: 0 }}
            />
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{
                background: shift.shiftType === "general" ? "rgba(59, 130, 246, 0.14)" : "rgba(100, 116, 139, 0.14)",
                color: shift.shiftType === "general" ? "rgb(29, 78, 216)" : "rgb(71, 85, 105)",
              }}
            >
              {shiftTypeLabel}
            </span>
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{
                background: shift.status === "published" ? "rgba(34, 197, 94, 0.14)" : "rgba(245, 158, 11, 0.16)",
                color: shift.status === "published" ? "rgb(21, 128, 61)" : "rgb(180, 83, 9)",
              }}
            >
              {statusLabel}
            </span>
          </div>

          <div className="mt-3 text-lg font-bold" style={{ color: "var(--foreground)" }}>
            {shift.shiftName || (locale === "zh" ? "未命名班次" : "Untitled Shift")}
          </div>

          <div className="mt-1.5 flex items-center gap-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
            <Clock size={13} />
            <span>{shift.startTime} – {shift.endTime}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            className="flex items-center justify-center rounded-full"
            style={{
              width: 30,
              height: 30,
              border: "1px solid var(--border)",
              background: "var(--card)",
              cursor: "pointer",
              color: "var(--muted-foreground)",
            }}
            onClick={onEdit}
          >
            <Edit2 size={14} />
          </button>

          <Popconfirm
            title={locale === "zh" ? "删除此班次？" : "Delete this shift?"}
            onConfirm={onDelete}
            okText={locale === "zh" ? "删除" : "Delete"}
            cancelText={locale === "zh" ? "取消" : "Cancel"}
            placement="topRight"
          >
            <button
              type="button"
              className="flex items-center justify-center rounded-full"
              style={{
                width: 30,
                height: 30,
                border: "1px solid var(--border)",
                background: "var(--card)",
                cursor: "pointer",
                color: "var(--destructive)",
              }}
            >
              <Trash2 size={14} />
            </button>
          </Popconfirm>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <div
          className="rounded-2xl px-3 py-2.5"
          style={{ background: "var(--muted)", border: "1px solid var(--border)" }}
        >
          <div className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>
            {locale === "zh" ? "时长" : "Duration"}
          </div>
          <div className="mt-1.5 text-base font-bold" style={{ color }}>
            {hours}h
          </div>
        </div>

        <div
          className="rounded-2xl px-3 py-2.5"
          style={{ background: "var(--muted)", border: "1px solid var(--border)" }}
        >
          <div className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>
            {locale === "zh" ? "类型" : "Type"}
          </div>
          <div className="mt-1.5 text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            {isOvernight ? (locale === "zh" ? "跨天班次" : "Overnight") : (locale === "zh" ? "当日班次" : "Same day")}
          </div>
        </div>
      </div>

      {(storeName || shift.note) && (
        <div className="mt-3 flex flex-col gap-1.5">
          {storeName && (
            <div
              className="rounded-2xl px-3 py-1.5 text-xs"
              style={{ background: "var(--secondary)", color: "var(--foreground)" }}
            >
              {locale === "zh" ? "门店" : "Store"}: {storeName}
            </div>
          )}
          {shift.note && (
            <div
              className="rounded-2xl px-3 py-1.5 text-xs"
              style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
            >
              {shift.note}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface AddShiftModalProps {
  open?: boolean;
  onClose?: () => void;
  onSave?: () => void;
  isEdit?: boolean;
  shiftName?: string;
  onShiftNameChange?: (value: string) => void;
  startTime?: string;
  onStartTimeChange?: (value: string) => void;
  endTime?: string;
  onEndTimeChange?: (value: string) => void;
  selectedType?: "store" | "general";
  onTypeChange?: (value: "store" | "general") => void;
  selectedColor?: string;
  onColorChange?: (value: string) => void;
  colorMap?: Record<string, string>;
  calcHours?: (start: string, end: string, breakMinutes: number) => string;
  locale?: string;
}

function ModalTimeInput({
  value = "09:00",
  onChange = () => {},
  label = "",
}: {
  value?: string;
  onChange?: (value: string) => void;
  label?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5" style={{ flex: 1 }}>
      <label className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
        {label}
      </label>
      <div
        className="flex items-center justify-between rounded-xl px-3"
        style={{
          height: 46,
          border: "1px solid var(--border)",
          background: "var(--card)",
        }}
      >
        <input
          type="time"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="flex-1 bg-transparent text-sm font-medium outline-none"
          style={{ color: "var(--foreground)", border: "none" }}
        />
        <Clock size={16} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
      </div>
    </div>
  );
}

function AddShiftModal({
  open = false,
  onClose = () => {},
  onSave = () => {},
  isEdit = false,
  shiftName = "",
  onShiftNameChange = () => {},
  startTime = "09:00",
  onStartTimeChange = () => {},
  endTime = "17:00",
  onEndTimeChange = () => {},
  selectedType = "store",
  onTypeChange = () => {},
  selectedColor = "blue",
  onColorChange = () => {},
  colorMap = DEFAULT_SHIFT_COLOR_MAP,
  calcHours = (start: string, end: string, breakMinutes: number) => calcShiftHours(start, end, breakMinutes),
  locale = "zh",
}: AddShiftModalProps) {
  const colorInputRef = useRef<HTMLInputElement>(null);
  const durationHours = calcHours(startTime, endTime, 0);
  const mergedColorMap = { ...DEFAULT_SHIFT_COLOR_MAP, ...colorMap };
  const isCustomColorSelected = isHexColor(selectedColor);
  const customColorValue = isCustomColorSelected ? selectedColor : "#ffffff";

  if (!open) return null;

  return (
    <div
      data-cmp="AddShiftModal"
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 1050, background: "rgba(15, 23, 42, 0.45)" }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[90vh] flex-col overflow-y-auto rounded-[28px]"
        style={{
          width: 520,
          maxWidth: "95vw",
          background: "var(--card)",
        }}
      >
        <div
          className="flex items-center justify-between px-6 pt-6 pb-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <span className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
            {isEdit
              ? locale === "zh" ? "编辑班次" : "Edit Shift"
              : locale === "zh" ? "添加班次" : "Add Shift"}
          </span>
          <button
            type="button"
            className="flex items-center justify-center rounded-full transition-opacity hover:opacity-70"
            style={{
              width: 32,
              height: 32,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--muted-foreground)",
              padding: 0,
            }}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-5 px-6 py-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              {locale === "zh" ? "班次名称" : "Shift Name"}
            </label>
            <input
              type="text"
              value={shiftName}
              onChange={(event) => onShiftNameChange(event.target.value)}
              placeholder={locale === "zh" ? "例：早班、晚班..." : "e.g. Morning, Evening..."}
              className="rounded-xl px-4 text-sm outline-none"
              style={{
                height: 46,
                border: "1px solid var(--border)",
                background: "var(--card)",
                color: "var(--foreground)",
                width: "100%",
              }}
            />
          </div>

          <div className="flex gap-4">
            <ModalTimeInput
              label={locale === "zh" ? "开始时间" : "Start Time"}
              value={startTime}
              onChange={onStartTimeChange}
            />
            <ModalTimeInput
              label={locale === "zh" ? "结束时间" : "End Time"}
              value={endTime}
              onChange={onEndTimeChange}
            />
          </div>

          <div
            className="flex items-center gap-2 rounded-2xl px-4"
            style={{
              height: 52,
              background: "var(--secondary)",
              border: "1px solid var(--ring)",
            }}
          >
            <Clock size={16} style={{ color: "var(--primary)", flexShrink: 0 }} />
            <span className="text-sm font-semibold" style={{ color: "var(--primary)" }}>
              {durationHours} {locale === "zh" ? "小时" : "hours"}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              {locale === "zh" ? "班次类型" : "Shift Type"}
            </label>
            <div
              className="grid grid-cols-2 gap-2 rounded-2xl p-2"
              style={{ background: "var(--muted)", border: "1px solid var(--border)" }}
            >
              {[
                {
                  key: "store" as const,
                  label: locale === "zh" ? "门店专属" : "Store Only",
                  desc: locale === "zh" ? "仅用于当前门店" : "Only for this store",
                },
                {
                  key: "general" as const,
                  label: locale === "zh" ? "通用" : "General",
                  desc: locale === "zh" ? "作为通用班次类型" : "Use as a general type",
                },
              ].map((option) => {
                const active = selectedType === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    className="rounded-2xl px-4 py-3 text-left transition-all"
                    style={{
                      border: active ? "1px solid var(--primary)" : "1px solid transparent",
                      background: active ? "rgba(59, 130, 246, 0.10)" : "transparent",
                      cursor: "pointer",
                    }}
                    onClick={() => onTypeChange(option.key)}
                  >
                    <div
                      className="text-sm font-semibold"
                      style={{ color: active ? "var(--primary)" : "var(--foreground)" }}
                    >
                      {option.label}
                    </div>
                    <div className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
                      {option.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              {locale === "zh" ? "颜色标识" : "Color Label"}
            </label>
            <div className="flex items-center gap-3">
              {SHIFT_COLORS.map((color) => (
                <button
                  key={color.key}
                  type="button"
                  onClick={() => onColorChange(color.key)}
                  title={color.label}
                  className="flex items-center justify-center rounded-full transition-all"
                  style={{
                    width: 42,
                    height: 42,
                    background: mergedColorMap[color.key] || DEFAULT_SHIFT_COLOR_MAP[color.key],
                    border: selectedColor === color.key ? "3px solid var(--foreground)" : "3px solid transparent",
                    outline: selectedColor === color.key
                      ? `2.5px solid ${mergedColorMap[color.key] || DEFAULT_SHIFT_COLOR_MAP[color.key]}`
                      : "none",
                    outlineOffset: 1,
                    cursor: "pointer",
                    padding: 0,
                    flexShrink: 0,
                  }}
                />
              ))}

              <button
                type="button"
                title={locale === "zh" ? "自定义颜色" : "Custom color"}
                className="flex items-center justify-center transition-all"
                style={{
                  width: 42,
                  height: 42,
                  background: isCustomColorSelected ? customColorValue : "var(--card)",
                  border: "2px solid var(--border)",
                  outline: isCustomColorSelected ? `2.5px solid ${customColorValue}` : "none",
                  outlineOffset: 1,
                  cursor: "pointer",
                  padding: 0,
                  flexShrink: 0,
                }}
                onClick={() => colorInputRef.current?.click()}
              />
              <input
                ref={colorInputRef}
                type="color"
                value={customColorValue}
                onChange={(event) => onColorChange(event.target.value)}
                style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
                tabIndex={-1}
                aria-hidden="true"
              />
            </div>
          </div>
        </div>

        <div
          className="flex items-center justify-end gap-3 px-6 py-4"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <button
            type="button"
            className="rounded-xl px-6 text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              height: 44,
              background: "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
              cursor: "pointer",
            }}
            onClick={onClose}
          >
            {locale === "zh" ? "取消" : "Cancel"}
          </button>
          <button
            type="button"
            className="rounded-xl px-6 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{
              height: 44,
              background: "var(--primary)",
              border: "1px solid var(--primary)",
              color: "var(--primary-foreground)",
              cursor: "pointer",
            }}
            onClick={onSave}
          >
            {locale === "zh" ? "保存" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

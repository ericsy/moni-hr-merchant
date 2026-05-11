import { useRef, useState } from "react";
import {
  Button,
  Input,
  Modal,
  Select,
  Tooltip,
  Popconfirm,
  Tag,
  TimePicker,
  InputNumber,
  Avatar,
} from "antd";
import {
  Plus,
  Minus,
  Search,
  Trash2,
  Edit2,
  Clock,
  Save,
  ChevronDown,
  GripVertical,
  X,
  AlertTriangle,
} from "lucide-react";
import { useData, type Area, type Employee, type RosterTemplate, type RosterTemplateCell } from "../context/DataContext";
import { useLocale } from "../context/LocaleContext";
import { useStore } from "../context/StoreContext";
import { EmployeeModal } from "./Employees";
import { calcShiftHours, indexedShiftsOverlap } from "../lib/shift";
import { isStoreClosedOnDayIndex } from "../lib/storeHours";
import { ColorSwatchPicker, DEFAULT_COLOR_KEY, getSoftColorStyle } from "../components/ColorSwatchPicker";
import { toast } from "sonner";
import dayjs from "dayjs";

const { Option } = Select;

// ─── Types ────────────────────────────────────────────────────────────────────

type RosterShiftCell = RosterTemplateCell;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const calcHours = (start: string, end: string) => Number.parseFloat(calcShiftHours(start, end, 0));

const WEEKDAY_LABELS_ZH = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const WEEKDAY_LABELS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const formatTime12 = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")}${ampm}`;
};

const getWeekdayLabel = (dayIndex: number, locale: "zh" | "en") => {
  const labels = locale === "zh" ? WEEKDAY_LABELS_ZH : WEEKDAY_LABELS_EN;
  return labels[((dayIndex % 7) + 7) % 7];
};

const getDetailedDayLabel = (dayIndex: number, locale: "zh" | "en") => {
  const weekNumber = Math.floor(dayIndex / 7) + 1;
  const weekdayLabel = getWeekdayLabel(dayIndex, locale);
  return locale === "zh" ? `第${weekNumber}周 ${weekdayLabel}` : `Week ${weekNumber} ${weekdayLabel}`;
};

const getCycleWeek = (dayIndex: number) => Math.floor(dayIndex / 7) + 1;

const getTemplateWeekdayIndex = (dayIndex: number) => ((dayIndex % 7) + 7) % 7;

const getEmployeeAvailabilityWarning = (
  employee: Pick<Employee, "firstName" | "lastName" | "workDayPattern">,
  dayIndex: number,
  locale: "zh" | "en"
) => {
  const weekdayIndex = getTemplateWeekdayIndex(dayIndex);
  const workDay = employee.workDayPattern?.find((item) => item.dayIndex === weekdayIndex);
  if (!workDay || (workDay.state === "on" && workDay.hours > 0)) return null;

  const employeeName = `${employee.firstName} ${employee.lastName}`.trim();
  const dayLabel = getDetailedDayLabel(dayIndex, locale);
  const stateLabel = workDay.state === "off"
    ? (locale === "zh" ? "休息" : "off")
    : workDay.state === "none"
    ? (locale === "zh" ? "未设置" : "not set")
    : (locale === "zh" ? `${workDay.hours} 小时` : `${workDay.hours} hours`);

  return locale === "zh"
    ? `${employeeName} 在 ${dayLabel} 的工作日配置为${stateLabel}，请确认是否需要排班。`
    : `${employeeName} is marked as ${stateLabel} on ${dayLabel}. Confirm this assignment.`;
};

const formatDurationLabel = (days: number, locale: "zh" | "en") => {
  if (days % 7 === 0) {
    const weeks = days / 7;
    return locale === "zh" ? `${weeks}周` : `${weeks} ${weeks === 1 ? "week" : "weeks"}`;
  }
  return locale === "zh" ? `${days}天` : `${days} days`;
};

const getShiftColor = (key: string) => getSoftColorStyle(key);

const makeShiftPresetKey = ({
  shiftType = "store",
  storeId = "",
  shiftName = "",
  startTime,
  endTime,
  color,
}: {
  shiftType?: string;
  storeId?: string;
  shiftName?: string;
  startTime: string;
  endTime: string;
  color: string;
}) => `${shiftType}::${storeId}::${shiftName}::${startTime}::${endTime}::${color}`;

// ─── Sub-component: Employee Panel Card ───────────────────────────────────────

interface EmployeeCardProps {
  employeeId?: string;
  firstName?: string;
  lastName?: string;
  color?: string;
  hoursPerDay?: number[];
  onDragStart?: (empId: string) => void;
}

function EmployeeCard({
  employeeId = "",
  firstName = "",
  lastName = "",
  color = "var(--primary)",
  hoursPerDay = [],
  onDragStart = () => {},
}: EmployeeCardProps) {
  const total = hoursPerDay.reduce((s, h) => s + h, 0);

  return (
    <div
      data-cmp="EmployeeCard"
      draggable
      onDragStart={() => onDragStart(employeeId)}
      className="rounded-lg p-3 mb-2 cursor-grab active:cursor-grabbing"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Avatar size={28} style={{ background: color, flexShrink: 0, fontSize: 11 }}>
            {firstName.charAt(0)}{lastName.charAt(0)}
          </Avatar>
          <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            {firstName} {lastName}
          </span>
        </div>
        <span className="text-xs font-semibold" style={{ color: "var(--primary)" }}>
          {total}h
        </span>
      </div>
    </div>
  );
}

// ─── Sub-component: Shift Cell (multi-employee) ───────────────────────────────

interface ShiftCellProps {
  cell?: RosterShiftCell;
  employees?: { id: string; name: string; color: string; availabilityWarning?: string | null }[];
  onEdit?: () => void;
  onDelete?: () => void;
  onDrop?: (empId: string) => void;
  onRemoveEmployee?: (empId: string) => void;
}

function ShiftCell({
  cell,
  employees = [],
  onEdit = () => {},
  onDelete = () => {},
  onDrop = () => {},
  onRemoveEmployee = () => {},
}: ShiftCellProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  if (!cell) return null;

  const sc = getShiftColor(cell.color);
  const hrs = calcHours(cell.startTime, cell.endTime);

  return (
    <div
      data-cmp="ShiftCell"
      className="rounded-lg mb-1 relative group"
      style={{
        background: isDragOver ? "var(--secondary)" : sc.bg,
        border: `1.5px solid ${isDragOver ? "var(--primary)" : sc.border}`,
        padding: "4px 6px",
        transition: "all 0.15s",
      }}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const id = e.dataTransfer.getData("employeeId");
        if (id) onDrop(id);
      }}
    >
      {/* Top row: employees + action buttons */}
      <div className="flex items-center justify-between mb-0.5">
        <div className="flex items-center gap-0.5 min-w-0 flex-1">
          {employees.length > 0 ? (
            <div className="flex items-center gap-0.5 flex-wrap min-w-0">
              {employees.map((emp) => (
                <Tooltip key={emp.id} title={emp.availabilityWarning || undefined}>
                  <div
                    className="flex items-center gap-0.5 rounded-md px-1 py-0.5"
                    style={{
                      background: "var(--card)",
                      border: emp.availabilityWarning ? "1px solid var(--destructive)" : "1px solid transparent",
                    }}
                  >
                    <Avatar size={13} style={{ background: emp.color, flexShrink: 0, fontSize: 7 }}>
                      {emp.name.charAt(0)}
                    </Avatar>
                    <span
                      className="text-xs truncate"
                      style={{
                        color: emp.availabilityWarning ? "var(--destructive)" : "var(--foreground)",
                        maxWidth: 80,
                        fontSize: 10,
                        fontWeight: emp.availabilityWarning ? 700 : 400,
                      }}
                    >
                      {emp.name}
                    </span>
                    {emp.availabilityWarning && (
                      <AlertTriangle size={9} style={{ color: "var(--destructive)", flexShrink: 0 }} />
                    )}
                    <button
                      onClick={() => onRemoveEmployee(emp.id)}
                      className="rounded-full hover:opacity-70"
                      style={{ color: "var(--muted-foreground)", flexShrink: 0 }}
                    >
                      <X size={9} />
                    </button>
                  </div>
                </Tooltip>
              ))}
            </div>
          ) : (
            <span className="text-xs font-semibold truncate" style={{ color: sc.text, maxWidth: 90, fontSize: 10 }}>
              {cell.label || formatTime12(cell.startTime)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={onEdit}
            className="rounded p-0.5 hover:opacity-70"
            style={{ color: "var(--muted-foreground)" }}
          >
            <Edit2 size={10} />
          </button>
          <button
            onClick={onDelete}
            className="rounded p-0.5 hover:opacity-70"
            style={{ color: "var(--destructive)" }}
          >
            <Trash2 size={10} />
          </button>
        </div>
      </div>

      {/* Time row */}
      <div className="flex items-center gap-1">
        <Clock size={8} style={{ color: sc.text }} />
        <span style={{ fontSize: 9, color: sc.text }}>
          {formatTime12(cell.startTime)} – {formatTime12(cell.endTime)}
        </span>
        <span
          className="rounded-full px-1 ml-auto font-semibold"
          style={{ fontSize: 8, background: sc.border, color: "var(--primary-foreground)" }}
        >
          {hrs}h
        </span>
      </div>

      {/* Shift label (when employees present) */}
      {employees.length > 0 && cell.label && (
        <div className="mt-0.5 truncate" style={{ fontSize: 9, color: sc.text, fontWeight: 600 }}>
          {cell.label}
        </div>
      )}

      {/* Drop hint */}
      <div
        className="flex items-center justify-center rounded-md mt-0.5"
        style={{
          border: `1px dashed ${isDragOver ? "var(--primary)" : sc.border}`,
          padding: "2px 4px",
          background: isDragOver ? "var(--secondary)" : "transparent",
        }}
      >
        <span style={{ color: isDragOver ? "var(--primary)" : sc.text, fontSize: 9 }}>
          {employees.length > 0 ? `+ 拖拽添加员工` : `拖拽员工到此处`}
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface RosterTemplatePageProps {
  onSave?: () => void;
}

export default function RosterTemplatePage({ onSave = () => {} }: RosterTemplatePageProps) {
  const {
    employees,
    saveEmployee,
    stores,
    areas,
    workAreas,
    scheduleShifts,
    rosterTemplates: allTemplates,
    setRosterTemplates: setTemplates,
    saveRosterTemplate,
    deleteRosterTemplate,
  } = useData();
  const { locale, t } = useLocale();
  const { selectedStoreId } = useStore();

  // ── State ──────────────────────────────────────────────────────────────────
  // templates & setTemplates come from DataContext (rosterTemplates / setRosterTemplates)
  const [activeTemplateId, setActiveTemplateId] = useState<string>(allTemplates[0]?.id || "");
  const [searchText, setSearchText] = useState("");
  const [dragEmpId, setDragEmpId] = useState<string | null>(null);
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);

  // Modals
  const [addAreaOpen, setAddAreaOpen] = useState(false);
  const [selectedAreaId, setSelectedAreaId] = useState("");
  const [cellModalOpen, setCellModalOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<RosterShiftCell | null>(null);
  const [editingAreaId, setEditingAreaId] = useState<string>("");
  const [editingDayIndex, setEditingDayIndex] = useState<number>(0);
  const [cellForm, setCellForm] = useState({
    presetKey: "",
    shiftId: "",
    startTime: "09:00",
    endTime: "17:00",
    label: "",
    color: DEFAULT_COLOR_KEY,
    employeeIds: [] as string[],
  });

  // Duration selector
  const [customDaysOpen, setCustomDaysOpen] = useState(false);
  const [customDaysInput, setCustomDaysInput] = useState<number>(14);

  // Template name edit
  const [nameEditing, setNameEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const nextCreatedCellIdRef = useRef(0);

  const visibleTemplates = allTemplates.filter(
    (template) => !selectedStoreId || template.storeId === selectedStoreId
  );
  const resolvedActiveTemplateId = visibleTemplates.some((template) => template.id === activeTemplateId)
    ? activeTemplateId
    : visibleTemplates[0]?.id || "";
  const activeTemplate = visibleTemplates.find((template) => template.id === resolvedActiveTemplateId) || null;
  const activeTemplateStoreId = activeTemplate?.storeId || selectedStoreId;
  const activeTemplateStore = stores.find((store) => store.id === activeTemplateStoreId);
  const activeTemplateTotalDays = activeTemplate?.totalDays || 7;
  const activeTemplateVisibleCells = (activeTemplate?.cells || []).filter(
    (cell) => cell.dayIndex >= 0 && cell.dayIndex < activeTemplateTotalDays
  );

  // ── Computed ──────────────────────────────────────────────────────────────

  const templateAreaMap: Record<string, Area> = {};
  areas.forEach((area) => {
    templateAreaMap[area.id] = area;
  });

  const templateAreas = (activeTemplate?.areaIds || [])
    .map((areaId) => templateAreaMap[areaId])
    .filter(Boolean) as Area[];

  const selectableAreas = areas
    .filter((area) => {
      if ((area.areaType || "store") === "general") return true;
      if (activeTemplateStoreId) return area.storeId === activeTemplateStoreId;
      return !selectedStoreId || area.storeId === selectedStoreId;
    })
    .filter((area) => !(activeTemplate?.areaIds || []).includes(area.id))
    .sort((a, b) => a.order - b.order);

  const shiftPresetMap: Record<string, {
    key: string;
    shiftId?: string;
    shiftName: string;
    startTime: string;
    endTime: string;
    color: string;
    shiftType: "store" | "general";
  }> = {};

  scheduleShifts.forEach((shift) => {
    if (!shift.isGlobalPreset) return;

    const shiftType = shift.shiftType || "store";
    const belongsToTemplate = shiftType === "general" || shift.storeId === activeTemplateStoreId;
    if (!belongsToTemplate) return;

    const shiftName = (shift.shiftName || "").trim();
    if (!shiftName) return;

    const key = makeShiftPresetKey({
      shiftType,
      storeId: shift.storeId,
      shiftName,
      startTime: shift.startTime,
      endTime: shift.endTime,
      color: shift.color,
    });

    if (!shiftPresetMap[key]) {
      shiftPresetMap[key] = {
        key,
        shiftId: shift.shiftId,
        shiftName,
        startTime: shift.startTime,
        endTime: shift.endTime,
        color: shift.color,
        shiftType,
      };
    }
  });

  const shiftPresetOptions = Object.values(shiftPresetMap).sort((a, b) => {
    return (
      a.shiftName.localeCompare(b.shiftName) ||
      a.startTime.localeCompare(b.startTime) ||
      a.endTime.localeCompare(b.endTime)
    );
  });

  const modalShiftPresetOptions = [...shiftPresetOptions];
  const currentShiftName = (cellForm.label || "").trim();

  if (currentShiftName) {
    const currentKey = makeShiftPresetKey({
      shiftType: "store",
      storeId: activeTemplateStoreId,
      shiftName: currentShiftName,
      startTime: cellForm.startTime,
      endTime: cellForm.endTime,
      color: cellForm.color,
    });

    if (!modalShiftPresetOptions.some((option) => option.key === currentKey)) {
      modalShiftPresetOptions.unshift({
        key: currentKey,
        shiftId: cellForm.shiftId,
        shiftName: currentShiftName,
        startTime: cellForm.startTime,
        endTime: cellForm.endTime,
        color: cellForm.color,
        shiftType: "store",
      });
    }
  }

  const activeEmployees = employees.filter((e) => e.status === "active");
  const filteredEmployees = activeEmployees.filter((e) =>
    !searchText || `${e.firstName} ${e.lastName}`.toLowerCase().includes(searchText.toLowerCase())
  );

  // Hours per employee per day — iterate employeeIds array
  const empHoursMap: Record<string, number[]> = {};
  activeEmployees.forEach((e) => {
    empHoursMap[e.id] = Array.from({ length: activeTemplateTotalDays }).map(() => 0);
  });
  activeTemplateVisibleCells.forEach((cell) => {
    const hrs = calcHours(cell.startTime, cell.endTime);
    cell.employeeIds.forEach((eid) => {
      if (empHoursMap[eid]) {
        empHoursMap[eid][cell.dayIndex] += hrs;
      }
    });
  });

  const totalDaysList = Array.from({ length: activeTemplateTotalDays }, (_, i) => i + 1);

  const empNameMap: Record<string, string> = {};
  const empColorMap: Record<string, string> = {};
  employees.forEach((e) => {
    empNameMap[e.id] = `${e.firstName} ${e.lastName}`;
    empColorMap[e.id] = e.employeeColor || "var(--primary)";
  });

  // ── Conflict detection ─────────────────────────────────────────────────────

  /**
   * Check if adding `empId` to the given shift would conflict with another shift
   * across the template timeline, including overnight shifts spilling into the next day.
   */
  const findConflict = (
    empId: string,
    dayIndex: number,
    startTime: string,
    endTime: string,
    excludeCellId?: string
  ): RosterShiftCell | null => {
    for (const cell of activeTemplateVisibleCells) {
      if (cell.id === excludeCellId) continue;
      if (!cell.employeeIds.includes(empId)) continue;
      if (indexedShiftsOverlap(
        { dayIndex, startTime, endTime },
        { dayIndex: cell.dayIndex, startTime: cell.startTime, endTime: cell.endTime }
      )) {
        return cell;
      }
    }
    return null;
  };

  // ── Template CRUD ─────────────────────────────────────────────────────────

  const createDraftTemplate = (initialAreaIds: string[] = []) => {
    const uniqueAreaIds = Array.from(new Set(initialAreaIds.filter(Boolean)));
    const firstArea = uniqueAreaIds
      .map((areaId) => templateAreaMap[areaId])
      .find(Boolean);
    const inferredStoreId = firstArea && (firstArea.areaType || "store") !== "general"
      ? firstArea.storeId
      : "";
    const defaultStoreId = selectedStoreId || inferredStoreId || stores[0]?.id || "";
    const newTemplate: RosterTemplate = {
      id: `rt-${Date.now()}`,
      name: locale === "zh" ? `新排班模版 ${allTemplates.length + 1}` : `New Roster Template ${allTemplates.length + 1}`,
      storeId: defaultStoreId,
      totalDays: 7,
      areaIds: uniqueAreaIds,
      cells: [],
    };

    setTemplates((prev) => [...prev, newTemplate]);
    setActiveTemplateId(newTemplate.id);
    return newTemplate;
  };

  const updateTemplate = (updater: (t: RosterTemplate) => RosterTemplate) => {
    if (!resolvedActiveTemplateId) return;
    setTemplates((prev) => prev.map((t) => (t.id === resolvedActiveTemplateId ? updater(t) : t)));
  };

  const handleSetDays = (days: number) => {
    const normalizedDays = Math.max(7, Math.floor(days));
    updateTemplate((t) => ({
      ...t,
      totalDays: normalizedDays,
      cells: t.cells.map((cell) => ({ ...cell, cycleWeek: getCycleWeek(cell.dayIndex) })),
    }));
    toast.success(
      locale === "zh"
        ? `已设置为 ${formatDurationLabel(normalizedDays, locale)}`
        : `Set to ${formatDurationLabel(normalizedDays, locale)}`
    );
  };

  const handleAddArea = () => {
    if (!selectedAreaId) return;

    if (!activeTemplate) {
      createDraftTemplate([selectedAreaId]);
      setSelectedAreaId("");
      setAddAreaOpen(false);
      toast.success(locale === "zh" ? "已创建模版并加入区域" : "Template created and area linked");
      return;
    }

    updateTemplate((t) => ({
      ...t,
      areaIds: t.areaIds.includes(selectedAreaId) ? t.areaIds : [...t.areaIds, selectedAreaId],
    }));
    setSelectedAreaId("");
    setAddAreaOpen(false);
    toast.success(locale === "zh" ? "区域已加入模版" : "Area linked to template");
  };

  const handleDeleteArea = (areaId: string) => {
    updateTemplate((t) => ({
      ...t,
      areaIds: t.areaIds.filter((id) => id !== areaId),
      cells: t.cells.filter((c) => c.areaId !== areaId),
    }));
    toast.success(locale === "zh" ? "区域已从模版移除" : "Area removed from template");
  };

  const openAddEmployeeModal = () => {
    setAddEmployeeOpen(true);
  };

  const handleAddEmployee = async (employee: Employee) => {
    try {
      await saveEmployee(employee);
      setSearchText("");
      setAddEmployeeOpen(false);
      toast.success(locale === "zh" ? "员工已添加" : "Employee added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Employee save failed");
    }
  };

  // ── Cell CRUD ─────────────────────────────────────────────────────────────

  const openAddCell = (areaId: string, dayIndex: number) => {
    setEditingCell(null);
    setEditingAreaId(areaId);
    setEditingDayIndex(dayIndex);
    setCellForm({ presetKey: "", shiftId: "", startTime: "09:00", endTime: "17:00", label: "", color: DEFAULT_COLOR_KEY, employeeIds: [] });
    setCellModalOpen(true);
  };

  const openEditCell = (cell: RosterShiftCell) => {
    const presetKey = makeShiftPresetKey({
      shiftType: "store",
      storeId: activeTemplateStoreId,
      shiftName: cell.label,
      startTime: cell.startTime,
      endTime: cell.endTime,
      color: cell.color,
    });

    setEditingCell(cell);
    setEditingAreaId(cell.areaId);
    setEditingDayIndex(cell.dayIndex);
    setCellForm({
      presetKey,
      shiftId: cell.shiftId || "",
      startTime: cell.startTime,
      endTime: cell.endTime,
      label: cell.label,
      color: cell.color,
      employeeIds: [...cell.employeeIds],
    });
    setCellModalOpen(true);
  };

  const handleSaveCell = () => {
    if (!cellForm.label.trim()) {
      toast.error(locale === "zh" ? "请选择班次" : "Please choose a shift");
      return;
    }

    // Validate no conflicts for all selected employees
    for (const empId of cellForm.employeeIds) {
      const conflict = findConflict(
        empId,
        editingDayIndex,
        cellForm.startTime,
        cellForm.endTime,
        editingCell?.id
      );
      if (conflict) {
        const empName = empNameMap[empId] || empId;
        toast.error(
          locale === "zh"
            ? `${empName} 在 ${getDetailedDayLabel(editingDayIndex, locale)} ${conflict.label || conflict.startTime} 已有排班冲突`
            : `${empName} has a scheduling conflict on ${getDetailedDayLabel(editingDayIndex, locale)} (${conflict.label || conflict.startTime})`
        );
        return;
      }
    }

    if (editingCell) {
      updateTemplate((t) => ({
        ...t,
        cells: t.cells.map((c) =>
          c.id === editingCell.id
            ? {
                ...c,
                shiftId: cellForm.shiftId || undefined,
                startTime: cellForm.startTime,
                endTime: cellForm.endTime,
                label: cellForm.label,
                color: cellForm.color,
                employeeIds: cellForm.employeeIds,
              }
            : c
        ),
      }));
    } else {
      nextCreatedCellIdRef.current += 1;
      const newCell: RosterShiftCell = {
        id: `cell-new-${nextCreatedCellIdRef.current}`,
        shiftId: cellForm.shiftId || undefined,
        areaId: editingAreaId,
        dayIndex: editingDayIndex,
        cycleWeek: getCycleWeek(editingDayIndex),
        startTime: cellForm.startTime,
        endTime: cellForm.endTime,
        label: cellForm.label,
        color: cellForm.color,
        employeeIds: cellForm.employeeIds,
      };
      updateTemplate((t) => ({ ...t, cells: [...t.cells, newCell] }));
    }
    setCellModalOpen(false);
    toast.success(locale === "zh" ? "班次已保存" : "Shift saved");
  };

  const handleDeleteCell = (cellId: string) => {
    updateTemplate((t) => ({ ...t, cells: t.cells.filter((c) => c.id !== cellId) }));
    toast.success(locale === "zh" ? "班次已删除" : "Shift deleted");
  };

  /** Drop an employee onto a cell: add to employeeIds if not already present, with conflict check */
  const handleDropEmployee = (cellId: string, empId: string) => {
    const cell = (activeTemplate?.cells || []).find((c) => c.id === cellId);
    if (!cell) return;

    if (cell.employeeIds.includes(empId)) {
      toast.warning(locale === "zh" ? "该员工已在此班次中" : "Employee already assigned to this shift");
      setDragEmpId(null);
      return;
    }

    const conflict = findConflict(empId, cell.dayIndex, cell.startTime, cell.endTime, cellId);
    if (conflict) {
      const empName = empNameMap[empId] || empId;
      toast.error(
        locale === "zh"
          ? `${empName} 在 ${getDetailedDayLabel(cell.dayIndex, locale)} ${conflict.label || conflict.startTime} 已有排班冲突`
          : `${empName} has a scheduling conflict on ${getDetailedDayLabel(cell.dayIndex, locale)} (${conflict.label || conflict.startTime})`
      );
      setDragEmpId(null);
      return;
    }

    updateTemplate((t) => ({
      ...t,
      cells: t.cells.map((c) =>
        c.id === cellId ? { ...c, employeeIds: [...c.employeeIds, empId] } : c
      ),
    }));
    setDragEmpId(null);
    console.log("[RosterTemplate] drop employee", empId, "onto cell", cellId);
    toast.success(locale === "zh" ? "员工已添加到班次" : "Employee added to shift");
  };

  const handleRemoveEmployee = (cellId: string, empId: string) => {
    updateTemplate((t) => ({
      ...t,
      cells: t.cells.map((c) =>
        c.id === cellId ? { ...c, employeeIds: c.employeeIds.filter((id) => id !== empId) } : c
      ),
    }));
  };

  // ── Name save ─────────────────────────────────────────────────────────────

  const handleSaveName = () => {
    if (!nameDraft.trim()) return;
    updateTemplate((t) => ({ ...t, name: nameDraft.trim() }));
    setNameEditing(false);
  };

  // ── New template ──────────────────────────────────────────────────────────

  const handleNewTemplate = () => {
    const defaultStoreId = selectedStoreId || stores[0]?.id || "";
    const defaultAreaId = areas.find((area) => (area.areaType || "store") === "general" || area.storeId === defaultStoreId)?.id || "";
    createDraftTemplate(defaultAreaId ? [defaultAreaId] : []);
    toast.success(locale === "zh" ? "新模版已创建" : "New template created");
  };

  const handleSaveTemplate = async () => {
    if (!activeTemplate) return;
    try {
      const saved = await saveRosterTemplate(activeTemplate);
      setActiveTemplateId(saved.id);
      onSave();
      toast.success(locale === "zh" ? "模版已保存" : "Template saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Template save failed");
    }
  };

  const handleDeleteTemplate = async () => {
    if (!activeTemplate) return;
    const deletedTemplateId = activeTemplate.id;
    const nextTemplateId = visibleTemplates.find((template) => template.id !== deletedTemplateId)?.id || "";

    try {
      await deleteRosterTemplate(deletedTemplateId);
      setActiveTemplateId(nextTemplateId);
      setNameEditing(false);
      onSave();
      toast.success(locale === "zh" ? "模版已删除" : "Template deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Template delete failed");
    }
  };

  // ── Duration buttons ───────────────────────────────────────────────────────

  const durationOptions = [
    { label: locale === "zh" ? "1周" : "1 Week", days: 7 },
    { label: locale === "zh" ? "2周" : "2 Weeks", days: 14 },
    { label: locale === "zh" ? "3周" : "3 Weeks", days: 21 },
    { label: locale === "zh" ? "4周" : "4 Weeks", days: 28 },
  ];

  const visibleTemplateCount = visibleTemplates.length;

  console.log("[RosterTemplatePage] activeTemplate:", activeTemplate?.id, "totalDays:", activeTemplate?.totalDays);

  return (
    <div data-cmp="RosterTemplatePage" className="flex flex-col" style={{ height: "calc(100vh - 88px)", overflow: "hidden" }}>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}
      >
        {/* Left: template tabs */}
        <div className="flex items-center gap-2">
          {visibleTemplates.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTemplateId(t.id)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: resolvedActiveTemplateId === t.id ? "var(--primary)" : "var(--muted)",
                color: resolvedActiveTemplateId === t.id ? "var(--primary-foreground)" : "var(--muted-foreground)",
              }}
            >
              {t.name}
            </button>
          ))}
          {visibleTemplateCount === 0 && (
            <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              {locale === "zh" ? "当前店面暂无模版" : "No templates for this store"}
            </span>
          )}
          <Tooltip title={locale === "zh" ? "新建模版" : "New template"}>
            <button
              onClick={handleNewTemplate}
              className="flex items-center justify-center rounded-lg"
              style={{ width: 30, height: 30, background: "var(--muted)", color: "var(--muted-foreground)" }}
            >
              <Plus size={14} />
            </button>
          </Tooltip>
        </div>

        {/* Right: duration selector + save */}
        <div className="flex items-center gap-2">
          {durationOptions.map((opt) => (
            <button
              key={opt.days}
              onClick={() => handleSetDays(opt.days)}
              className="px-3 py-1.5 rounded-lg text-sm transition-all"
              style={{
                background: activeTemplate?.totalDays === opt.days ? "var(--secondary)" : "var(--muted)",
                color: activeTemplate?.totalDays === opt.days ? "var(--primary)" : "var(--muted-foreground)",
                border: activeTemplate?.totalDays === opt.days ? "1px solid var(--primary)" : "1px solid var(--border)",
                fontWeight: activeTemplate?.totalDays === opt.days ? 600 : 400,
              }}
            >
              {opt.label}
            </button>
          ))}

          {/* Custom days */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCustomDaysOpen(!customDaysOpen)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-all"
              style={{
                background: "var(--muted)",
                color: "var(--muted-foreground)",
                border: "1px solid var(--border)",
              }}
            >
              {locale === "zh" ? "自定义" : "Custom"}
              <ChevronDown size={12} />
            </button>
            {customDaysOpen && (
              <div
                className="flex items-center gap-1 rounded-lg px-2 py-1"
                style={{ background: "var(--card)", border: "1px solid var(--border)" }}
              >
                <InputNumber
                  size="small"
                  min={7}
                  max={84}
                  step={7}
                  value={customDaysInput}
                  onChange={(v) => setCustomDaysInput(Math.max(7, Number(v) || 7))}
                  style={{ width: 60 }}
                />
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {locale === "zh" ? "天" : "days"}
                </span>
                <Button
                  size="small"
                  type="primary"
                  onClick={() => { handleSetDays(customDaysInput); setCustomDaysOpen(false); }}
                >
                  {locale === "zh" ? "确定" : "OK"}
                </Button>
              </div>
            )}
          </div>

          <Button
            type="primary"
            icon={<Save size={14} />}
            onClick={handleSaveTemplate}
            disabled={!activeTemplate}
            style={{ display: "flex", alignItems: "center", gap: 4 }}
          >
            {locale === "zh" ? "保存模版" : "Save Template"}
          </Button>
          <Popconfirm
            title={locale === "zh" ? "删除排班模版" : "Delete roster template"}
            description={
              locale === "zh"
                ? "删除后不可恢复，确定继续？"
                : "This cannot be undone. Continue?"
            }
            okText={locale === "zh" ? "删除" : "Delete"}
            cancelText={locale === "zh" ? "取消" : "Cancel"}
            okButtonProps={{ danger: true }}
            onConfirm={handleDeleteTemplate}
            disabled={!activeTemplate}
          >
            <Button
              danger
              icon={<Trash2 size={14} />}
              disabled={!activeTemplate}
              style={{ display: "flex", alignItems: "center", gap: 4 }}
            >
              {locale === "zh" ? "删除模版" : "Delete Template"}
            </Button>
          </Popconfirm>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left Panel: Employees ────────────────────────────────────────── */}
        <div
          className="flex flex-col flex-shrink-0"
          style={{ width: 260, background: "var(--card)", borderRight: "1px solid var(--border)", overflow: "hidden" }}
        >
          {/* Search */}
          <div className="px-3 py-3 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
            <Input
              prefix={<Search size={13} style={{ color: "var(--muted-foreground)" }} />}
              placeholder={locale === "zh" ? "搜索员工..." : "Search employees..."}
              size="small"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                {locale === "zh" ? "显示所有职位" : "Show All Positions"}
              </span>
              <span className="text-xs font-medium" style={{ color: "var(--primary)" }}>
                {filteredEmployees.length} {locale === "zh" ? "人" : "staff"}
              </span>
            </div>
          </div>

          {/* Sort label */}
          <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              {locale === "zh" ? "按姓名排序 A-Z" : "Sort by First Name A-Z"}
            </span>
          </div>

          {/* Employee list */}
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {filteredEmployees.map((emp) => (
              <div
                key={emp.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("employeeId", emp.id);
                  setDragEmpId(emp.id);
                  console.log("[RosterTemplate] drag start:", emp.id);
                }}
                onDragEnd={() => setDragEmpId(null)}
              >
                <EmployeeCard
                  employeeId={emp.id}
                  firstName={emp.firstName}
                  lastName={emp.lastName}
                  color={emp.employeeColor || "var(--primary)"}
                  hoursPerDay={empHoursMap[emp.id] || []}
                  onDragStart={(id) => setDragEmpId(id)}
                />
              </div>
            ))}

            {/* Add Employee placeholder */}
            <button
              type="button"
              onClick={openAddEmployeeModal}
              className="w-full rounded-lg text-sm py-2.5 mt-1"
              style={{
                border: "1.5px dashed var(--border)",
                color: "var(--primary)",
                background: "transparent",
              }}
            >
              <Plus size={13} className="inline mr-1" />
              {locale === "zh" ? "添加员工" : "Add Employee"}
            </button>
          </div>
        </div>

        {/* ── Right Panel: Schedule Grid ───────────────────────────────────── */}
        <div className="flex-1 overflow-auto relative">

          {/* Template name header */}
          <div
            className="px-4 py-2 flex items-center justify-between flex-shrink-0 sticky top-0 left-0 z-10"
            style={{ background: "var(--card)", borderBottom: "1px solid var(--border)", zIndex: 40, width: "100%" }}
          >
            {nameEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  size="small"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onPressEnter={handleSaveName}
                  style={{ width: 200 }}
                  autoFocus
                />
                <Button size="small" type="primary" onClick={handleSaveName}>{locale === "zh" ? "确定" : "OK"}</Button>
                <Button size="small" onClick={() => setNameEditing(false)}>{locale === "zh" ? "取消" : "Cancel"}</Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-semibold" style={{ color: "var(--foreground)" }}>{activeTemplate?.name}</span>
                <button onClick={() => { setNameEditing(true); setNameDraft(activeTemplate?.name || ""); }}>
                  <Edit2 size={13} style={{ color: "var(--muted-foreground)" }} />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                {activeTemplate?.totalDays} {locale === "zh" ? "天" : "days"}
              </span>
              <Tag style={{ background: "var(--secondary)", color: "var(--primary)", border: "none" }}>
                {templateAreas.length} {locale === "zh" ? "个区域" : "areas"}
              </Tag>
              {/* Multi-employee tip */}
              <div
                className="flex items-center gap-1 rounded-md px-2 py-0.5"
                style={{ background: "var(--secondary)", border: "1px solid var(--border)" }}
              >
                <AlertTriangle size={10} style={{ color: "var(--primary)" }} />
                <span style={{ color: "var(--primary)", fontSize: 10 }}>
                  {locale === "zh" ? "每班次支持多名员工" : "Multiple employees per shift"}
                </span>
              </div>
            </div>
          </div>

          {/* Grid */}
          <div style={{ minWidth: Math.max(700, totalDaysList.length * 160 + 120) }}>

            {/* Day header row */}
            <div className="flex sticky top-10 z-20" style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
              {/* Area column header */}
              <div
                className="sticky left-0 flex-shrink-0 flex items-center px-4"
                style={{
                  width: 120,
                  borderRight: "1px solid var(--border)",
                  minHeight: 44,
                  background: "var(--card)",
                  zIndex: 30,
                }}
              >
                <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>
                  {locale === "zh" ? "区域" : "Area"}
                </span>
              </div>

              {/* Day columns */}
              {totalDaysList.map((day) => {
                const dayIndex = day - 1;
                const isStoreClosed = isStoreClosedOnDayIndex(activeTemplateStore, dayIndex);

                return (
                  <div
                    key={day}
                    className="flex-shrink-0 flex items-center justify-center"
                    style={{
                      width: 160,
                      minHeight: 44,
                      borderRight: "1px solid var(--border)",
                      background: isStoreClosed ? "var(--workday-weekend-header)" : "var(--card)",
                    }}
                  >
                    <span
                      className="text-sm font-semibold"
                      style={{ color: isStoreClosed ? "var(--workday-weekend-text)" : "var(--foreground)" }}
                    >
                      {getWeekdayLabel(dayIndex, locale)}
                    </span>
                  </div>
                );
              })}

              {/* +/- columns */}
              <div className="flex items-center px-2" style={{ minWidth: 44, minHeight: 44 }}>
                <Tooltip title={locale === "zh" ? "删除/增减列" : "Manage columns"}>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => activeTemplate && activeTemplate.totalDays > 7 && handleSetDays(activeTemplate.totalDays - 7)}
                      className="flex items-center justify-center rounded-md"
                      style={{ width: 20, height: 20, background: "var(--destructive)", color: "var(--primary-foreground)" }}
                    >
                      <Minus size={10} />
                    </button>
                    <button
                      onClick={() => handleSetDays((activeTemplate?.totalDays || 7) + 7)}
                      className="flex items-center justify-center rounded-md"
                      style={{ width: 20, height: 20, background: "var(--primary)", color: "var(--primary-foreground)" }}
                    >
                      <Plus size={10} />
                    </button>
                  </div>
                </Tooltip>
              </div>
            </div>

            {/* Area rows */}
            {templateAreas.map((area) => (
              <div key={area.id} className="flex" style={{ borderBottom: "1px solid var(--border)" }}>
                {/* Area name cell */}
                <div
                  className="sticky left-0 flex-shrink-0 flex items-start justify-between px-3 py-3 group"
                  style={{
                    width: 120,
                    borderRight: "1px solid var(--border)",
                    minHeight: 88,
                    background: "var(--muted)",
                    zIndex: 10,
                  }}
                >
                  <div className="flex items-center gap-1">
                    <GripVertical size={12} style={{ color: "var(--muted-foreground)" }} />
                    <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{area.name}</span>
                  </div>
                  <Popconfirm
                    title={locale === "zh" ? "删除此区域？" : "Delete this area?"}
                    onConfirm={() => handleDeleteArea(area.id)}
                    okText={locale === "zh" ? "是" : "Yes"}
                    cancelText={locale === "zh" ? "否" : "No"}
                  >
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--destructive)" }}>
                      <Trash2 size={11} />
                    </button>
                  </Popconfirm>
                </div>

                {/* Day cells */}
                {totalDaysList.map((day) => {
                  const dayIndex = day - 1;
                  const isStoreClosed = isStoreClosedOnDayIndex(activeTemplateStore, dayIndex);
                  const cellsInSlot = activeTemplateVisibleCells.filter(
                    (c) => c.areaId === area.id && c.dayIndex === dayIndex
                  );

                  return (
                    <div
                      key={day}
                      className="flex-shrink-0 p-1.5"
                      style={{
                        width: 160,
                        borderRight: "1px solid var(--border)",
                        minHeight: 88,
                        background: isStoreClosed ? "var(--workday-weekend-header)" : "transparent",
                      }}
                      onDragOver={(e) => e.preventDefault()}
                    >
                      {cellsInSlot.map((cell) => {
                        const cellEmployees = cell.employeeIds
                          .map((eid) => {
                            const emp = activeEmployees.find((employee) => employee.id === eid);
                            if (!emp) return null;
                            return {
                              id: eid,
                              name: empNameMap[eid],
                              color: empColorMap[eid] || "var(--primary)",
                              availabilityWarning: getEmployeeAvailabilityWarning(emp, cell.dayIndex, locale),
                            };
                          })
                          .filter(Boolean) as { id: string; name: string; color: string; availabilityWarning: string | null }[];
                        return (
                          <ShiftCell
                            key={cell.id}
                            cell={cell}
                            employees={cellEmployees}
                            onEdit={() => openEditCell(cell)}
                            onDelete={() => handleDeleteCell(cell.id)}
                            onDrop={(empId) => handleDropEmployee(cell.id, empId)}
                            onRemoveEmployee={(empId) => handleRemoveEmployee(cell.id, empId)}
                          />
                        );
                      })}

                      {/* Add shift button */}
                      <button
                        onClick={() => openAddCell(area.id, dayIndex)}
                        className="w-full rounded-lg flex items-center justify-center transition-all hover:opacity-80"
                        style={{
                          height: 22,
                          border: "1.5px dashed var(--border)",
                          color: "var(--muted-foreground)",
                          background: "transparent",
                          fontSize: 10,
                        }}
                      >
                        <Plus size={10} />
                      </button>
                    </div>
                  );
                })}

                {/* spacer */}
                <div style={{ minWidth: 44 }} />
              </div>
            ))}

            {/* Add Area row */}
            <div
              className="flex items-center px-4 py-3"
              style={{ borderBottom: "1px solid var(--border)", background: "var(--muted)" }}
            >
                <button
                onClick={() => {
                  setSelectedAreaId(selectableAreas[0]?.id || "");
                  setAddAreaOpen(true);
                }}
                className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all"
                style={{
                  background: "var(--primary)",
                  color: "var(--primary-foreground)",
                }}
              >
                <Plus size={13} />
                {locale === "zh" ? "添加区域" : "Add Area"}
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* ── Add Area Modal ───────────────────────────────────────────────────── */}
      <EmployeeModal
        open={addEmployeeOpen}
        employee={null}
        stores={stores}
        defaultStoreIds={activeTemplateStoreId ? [activeTemplateStoreId] : []}
        onSave={handleAddEmployee}
        onCancel={() => setAddEmployeeOpen(false)}
        t={t}
        locale={locale}
      />

      <Modal
        title={locale === "zh" ? "添加区域" : "Add Area"}
        open={addAreaOpen}
        onCancel={() => { setAddAreaOpen(false); setSelectedAreaId(""); }}
        onOk={handleAddArea}
        maskClosable={false}
        okText={locale === "zh" ? "添加" : "Add"}
        cancelText={locale === "zh" ? "取消" : "Cancel"}
        destroyOnHidden
        width={400}
      >
        <div className="py-3">
          <div className="text-sm mb-2" style={{ color: "var(--muted-foreground)" }}>
            {locale === "zh" ? "选择基础区域" : "Select Base Area"}
          </div>
          <Select
            value={selectedAreaId || undefined}
            onChange={setSelectedAreaId}
            style={{ width: "100%" }}
            placeholder={locale === "zh" ? "从区域管理中选择..." : "Choose from area management..."}
          >
            {selectableAreas.map((area) => (
              <Option key={area.id} value={area.id}>
                {area.name}
              </Option>
            ))}
          </Select>
          {selectableAreas.length === 0 && (
            <div className="text-xs mt-2" style={{ color: "var(--muted-foreground)" }}>
              {locale === "zh" ? "当前店面没有可加入的区域，请先到区域管理新增" : "No available areas for this store. Add them in Area Management first."}
            </div>
          )}
        </div>
      </Modal>

      {/* ── Cell Edit Modal (multi-employee) ────────────────────────────────── */}
      <Modal
        title={locale === "zh" ? "设置班次" : "Configure Shift"}
        open={cellModalOpen}
        onCancel={() => setCellModalOpen(false)}
        onOk={handleSaveCell}
        maskClosable={false}
        okText={locale === "zh" ? "保存" : "Save"}
        cancelText={locale === "zh" ? "取消" : "Cancel"}
        destroyOnHidden
        width={500}
      >
        <div className="flex flex-col gap-4 py-3">
          {/* Preset select */}
          <div>
            <div className="text-sm mb-1.5" style={{ color: "var(--foreground)" }}>
              {locale === "zh" ? "选择班次" : "Select Shift"}
            </div>
            <Select
              showSearch
              value={cellForm.presetKey || undefined}
              onChange={(value) => {
                const preset = modalShiftPresetOptions.find((option) => option.key === value);
                if (!preset) {
                  setCellForm((form) => ({ ...form, presetKey: value }));
                  return;
                }

                setCellForm((form) => ({
                  ...form,
                  presetKey: preset.key,
                  shiftId: preset.shiftId || "",
                  label: preset.shiftName,
                  startTime: preset.startTime,
                  endTime: preset.endTime,
                  color: preset.color,
                }));
              }}
              placeholder={locale === "zh" ? "请选择班次" : "Please choose a shift"}
              style={{ width: "100%" }}
              optionFilterProp="label"
              options={modalShiftPresetOptions.map((option) => ({
                value: option.key,
                label: `${option.shiftName} (${option.startTime} - ${option.endTime})`,
              }))}
            />
            {shiftPresetOptions.length === 0 && (
              <div className="text-xs mt-2" style={{ color: "var(--muted-foreground)" }}>
                {locale === "zh" ? "暂无可选班次，请先到班次管理创建班次" : "No shifts available yet. Create shifts in Shift Management first."}
              </div>
            )}
          </div>

          {/* Time */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="text-sm mb-1.5" style={{ color: "var(--foreground)" }}>
                {locale === "zh" ? "开始时间" : "Start Time"}
              </div>
              <TimePicker
                disabled
                format="HH:mm"
                value={dayjs(cellForm.startTime, "HH:mm")}
                onChange={(v) => setCellForm((f) => ({ ...f, startTime: v ? v.format("HH:mm") : "09:00" }))}
                style={{ width: "100%" }}
              />
            </div>
            <div className="flex-1">
              <div className="text-sm mb-1.5" style={{ color: "var(--foreground)" }}>
                {locale === "zh" ? "结束时间" : "End Time"}
              </div>
              <TimePicker
                disabled
                format="HH:mm"
                value={dayjs(cellForm.endTime, "HH:mm")}
                onChange={(v) => setCellForm((f) => ({ ...f, endTime: v ? v.format("HH:mm") : "17:00" }))}
                style={{ width: "100%" }}
              />
            </div>
          </div>

          {/* Duration preview */}
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ background: "var(--secondary)" }}
          >
            <Clock size={14} style={{ color: "var(--primary)" }} />
            <span className="text-sm" style={{ color: "var(--primary)" }}>
              {calcHours(cellForm.startTime, cellForm.endTime)}{locale === "zh" ? " 小时" : " hours"}
            </span>
          </div>

          {/* Color */}
          <div>
            <div className="text-sm mb-1.5" style={{ color: "var(--foreground)" }}>
              {locale === "zh" ? "颜色标识" : "Color"}
            </div>
            <ColorSwatchPicker value={cellForm.color} onChange={(color) => setCellForm((f) => ({ ...f, color }))} locale={locale} />
          </div>

          {/* Multi-employee assignment */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-sm" style={{ color: "var(--foreground)" }}>
                {locale === "zh" ? "分配员工（支持多人）" : "Assign Employees (multi-select)"}
              </div>
              <span
                className="text-xs rounded-md px-1.5 py-0.5"
                style={{ background: "var(--secondary)", color: "var(--primary)" }}
              >
                {cellForm.employeeIds.length} {locale === "zh" ? "人" : "assigned"}
              </span>
            </div>
            <Select
              mode="multiple"
              value={cellForm.employeeIds}
              onChange={(v: string[]) => setCellForm((f) => ({ ...f, employeeIds: v }))}
              placeholder={locale === "zh" ? "选择员工（可多选）..." : "Select employees..."}
              style={{ width: "100%" }}
              maxTagCount="responsive"
              tagRender={(props) => {
                const emp = activeEmployees.find((employee) => employee.id === props.value);
                const warning = emp ? getEmployeeAvailabilityWarning(emp, editingDayIndex, locale) : null;
                return (
                  <Tooltip title={warning || undefined}>
                    <Tag
                      closable={props.closable}
                      onClose={props.onClose}
                      style={{
                        marginInlineEnd: 4,
                        color: warning ? "var(--destructive)" : undefined,
                        borderColor: warning ? "var(--destructive)" : undefined,
                        fontWeight: warning ? 700 : undefined,
                      }}
                    >
                      {props.label}
                      {warning && <AlertTriangle size={10} style={{ display: "inline", marginLeft: 4, verticalAlign: -1 }} />}
                    </Tag>
                  </Tooltip>
                );
              }}
              optionRender={(option) => {
                const emp = activeEmployees.find((e) => e.id === option.value);
                if (!emp) return <span>{option.label}</span>;
                const warning = getEmployeeAvailabilityWarning(emp, editingDayIndex, locale);
                return (
                  <Tooltip title={warning || undefined} placement="right">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar
                          size={18}
                          style={{ background: emp.employeeColor || "var(--primary)", fontSize: 9, flexShrink: 0 }}
                        >
                          {emp.firstName.charAt(0)}{emp.lastName.charAt(0)}
                        </Avatar>
                        <span
                          className="truncate"
                          style={{
                            color: warning ? "var(--destructive)" : "var(--foreground)",
                            fontWeight: warning ? 700 : 400,
                          }}
                        >
                          {emp.firstName} {emp.lastName}
                        </span>
                      </div>
                      {warning && <AlertTriangle size={13} style={{ color: "var(--destructive)", flexShrink: 0 }} />}
                    </div>
                  </Tooltip>
                );
              }}
            >
              {activeEmployees.map((e) => (
                <Option key={e.id} value={e.id}>
                  {e.firstName} {e.lastName}
                </Option>
              ))}
            </Select>
            {/* Conflict hint */}
            <div className="flex items-start gap-1.5 mt-2 rounded-md px-2 py-1.5" style={{ background: "var(--muted)" }}>
              <AlertTriangle size={12} style={{ color: "var(--chart-3)", flexShrink: 0, marginTop: 1 }} />
              <span style={{ color: "var(--muted-foreground)", fontSize: 11 }}>
                {locale === "zh"
                  ? "保存时将自动检测同一员工是否存在时间冲突（含跨天班次）"
                  : "Conflict detection runs on save, including overnight shifts"}
              </span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
